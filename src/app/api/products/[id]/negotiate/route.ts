import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireUsableSecondMeAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { actBargain, actSellerDecision, actBuyerResponse } from '@/lib/secondme'

const MAX_ROUNDS = 5

// 模拟 AI 买家决策（无 SecondMe 时使用）
async function mockBuyerAIBargain(productPrice: number, minPrice?: number) {
  // 随机出价 75%-90%
  const discount = 0.75 + Math.random() * 0.15
  const suggestedPrice = Math.round(productPrice * discount)
  return {
    suggestedPrice,
    reason: '诚心要，能便宜点吗？这个价格我觉得比较合适',
  }
}

// 模拟 AI 卖家决策（无 SecondMe 时使用）
async function mockSellerAIDecision(
  listPrice: number,
  offerPrice: number,
  minPrice?: number
) {
  const min = minPrice || listPrice * 0.85
  const autoAccept = listPrice * 0.92

  if (offerPrice >= autoAccept) {
    return { decision: 'accept' as const, reason: '价格合理，成交！' }
  }
  if (offerPrice < min) {
    const counter = Math.round((listPrice + offerPrice) / 2)
    return {
      decision: 'counter' as const,
      counterPrice: counter,
      reason: '这个价格太低了，最低只能到' + counter,
    }
  }
  const counter = Math.round(listPrice * 0.95)
  return {
    decision: 'counter' as const,
    counterPrice: counter,
    reason: '接近心理价位了，再让一点',
  }
}

// 模拟 AI 买家回应（无 SecondMe 时使用）
async function mockBuyerAIResponse(sellerCounterPrice: number, listPrice: number) {
  const acceptable = listPrice * 0.9
  if (sellerCounterPrice <= acceptable) {
    return { decision: 'accept' as const, reason: '这个价格可以接受' }
  }
  const myCounter = Math.round((sellerCounterPrice + listPrice * 0.88) / 2)
  return {
    decision: 'counter' as const,
    counterPrice: myCounter,
    reason: '还是有点贵，' + myCounter + '可以吗？',
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }
  const { id: productId } = await params

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { seller: true },
  })
  if (!product) {
    return NextResponse.json({ code: 404, message: '商品不存在' }, { status: 404 })
  }
  if (product.sellerId === user.id) {
    return NextResponse.json({ code: 400, message: '不能对自己的商品出价' }, { status: 400 })
  }

  // 检查是否有 SecondMe access，没有则使用模拟 AI
  const buyerAccess = await requireUsableSecondMeAccess(user)
  const sellerAccess = product.seller.isPlatformSeller
    ? null // 平台卖家不使用 SecondMe
    : await requireUsableSecondMeAccess(product.seller)

  const useMockAI = !buyerAccess || !sellerAccess
  const buyerToken = buyerAccess?.accessToken
  const sellerToken = sellerAccess?.accessToken
  const productTitle = product.title
  const listPrice = product.price
  const minPrice = product.minPrice ?? undefined

  const logs: { role: 'buyer' | 'seller'; action: string; price?: number; reason?: string }[] = []

  try {
    // 第 1 轮：买家 AI 先判断要不要买、出多少
    const firstBid = useMockAI || !buyerToken
      ? await mockBuyerAIBargain(listPrice, minPrice)
      : await actBargain(buyerToken, {
          productTitle,
          productPrice: listPrice,
          minPrice,
        })
    const offerPrice = firstBid.suggestedPrice != null && firstBid.suggestedPrice > 0
      ? firstBid.suggestedPrice
      : Math.round(listPrice * 0.8)

    // AI 不感兴趣（无建议价或为 0）则直接跳过，不创建出价、不找卖家谈
    if (firstBid.suggestedPrice == null || firstBid.suggestedPrice <= 0) {
      return NextResponse.json({
        code: 0,
        data: {
          outcome: 'skipped',
          reason: firstBid.reason || 'AI 暂不感兴趣',
          logs: [{ role: 'buyer' as const, action: '跳过', reason: firstBid.reason || '暂不感兴趣' }],
        },
      })
    }

    logs.push({ role: 'buyer', action: '出价', price: offerPrice, reason: firstBid.reason })

    let offer = await db.offer.create({
      data: {
        productId,
        buyerId: user.id,
        price: offerPrice,
        message: firstBid.reason || undefined,
        status: 'pending',
      },
    })

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // 卖家 AI 决策
      const sellerRes = useMockAI || !sellerToken
        ? await mockSellerAIDecision(listPrice, offer.price, minPrice)
        : await actSellerDecision(sellerToken, {
            productTitle,
            listPrice,
            minPrice,
            offerPrice: offer.price,
          })
      logs.push({
        role: 'seller',
        action: sellerRes.decision,
        price: sellerRes.counterPrice,
        reason: sellerRes.reason,
      })

      await db.offer.update({
        where: { id: offer.id },
        data: {
          sellerDecision: sellerRes.decision,
          counterPrice: sellerRes.counterPrice ?? undefined,
        },
      })

      if (sellerRes.decision === 'accept') {
        await db.offer.update({
          where: { id: offer.id },
          data: { status: 'pending_confirmation' },
        })
        return NextResponse.json({
          code: 0,
          data: {
            outcome: 'pending_confirmation',
            finalPrice: offer.price,
            offerId: offer.id,
            rounds: round,
            logs,
          },
        })
      }
      if (sellerRes.decision === 'reject') {
        await db.offer.update({
          where: { id: offer.id },
          data: { status: 'rejected' },
        })
        return NextResponse.json({
          code: 0,
          data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs },
        })
      }

      // 卖家还价 → 买家 AI 回应
      const counterPrice = sellerRes.counterPrice ?? offer.price
      const buyerRes = useMockAI || !buyerToken
        ? await mockBuyerAIResponse(counterPrice, listPrice)
        : await actBuyerResponse(buyerToken, {
            productTitle,
            listPrice,
            sellerCounterPrice: counterPrice,
          })
      logs.push({
        role: 'buyer',
        action: buyerRes.decision,
        price: buyerRes.counterPrice,
        reason: buyerRes.reason,
      })

      if (buyerRes.decision === 'accept') {
        const pendingOffer = await db.offer.create({
          data: {
            productId,
            buyerId: user.id,
            price: counterPrice,
            message: buyerRes.reason || undefined,
            status: 'pending_confirmation',
            inReplyToId: offer.id,
            sellerDecision: 'accept',
          },
        })
        return NextResponse.json({
          code: 0,
          data: {
            outcome: 'pending_confirmation',
            finalPrice: counterPrice,
            offerId: pendingOffer.id,
            rounds: round + 0.5,
            logs,
          },
        })
      }
      if (buyerRes.decision === 'reject') {
        return NextResponse.json({
          code: 0,
          data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs },
        })
      }

      // 买家继续还价 → 创建新一轮出价，下一轮卖家回应
      const nextPrice = buyerRes.counterPrice ?? counterPrice
      offer = await db.offer.create({
        data: {
          productId,
          buyerId: user.id,
          price: nextPrice,
          message: buyerRes.reason || undefined,
          status: 'pending',
          inReplyToId: offer.id,
        },
      })
    }

    return NextResponse.json({
      code: 0,
      data: {
        outcome: 'no_deal',
        message: '达到最大轮次，未成交',
        offerId: offer.id,
        rounds: MAX_ROUNDS,
        logs,
      },
    })
  } catch (err) {
    console.error('Negotiate error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : 'AI 谈价失败' },
      { status: 500 }
    )
  }
}
