import { NextRequest, NextResponse } from 'next/server'
import { authorizeAgentActor, requireUsableSecondMeAccess } from '@/lib/auth'
import { db } from '@/lib/db'
import { actBargain, actSellerDecision, actBuyerResponse } from '@/lib/secondme'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * 本地模拟 AI 谈判逻辑 - 当 SecondMe 不可用时使用
 */
function simulateBargain(productTitle: string, listPrice: number, minPrice?: number) {
  // 买方 AI：根据价格决定是否购买，出价在 60%-90% 之间
  const discount = 0.6 + Math.random() * 0.3 // 60%-90%
  const suggestedPrice = Math.round(listPrice * discount)

  if (suggestedPrice < (minPrice ?? listPrice * 0.5)) {
    return {
      suggestedPrice: suggestedPrice,
      reason: `对产品感兴趣，出价 ¥${suggestedPrice}（${Math.round(discount * 100)}%）`,
    }
  }

  return {
    suggestedPrice,
    reason: `愿意购买 ${productTitle}，出价 ¥${suggestedPrice}`,
  }
}

function simulateSellerDecision(
  listPrice: number,
  minPrice: number | undefined,
  offerPrice: number
): { decision: 'accept' | 'reject' | 'counter'; counterPrice?: number; reason: string } {
  const effectiveMin = minPrice ?? listPrice * 0.7

  // 如果出价高于最低接受价，80% 概率接受
  if (offerPrice >= effectiveMin) {
    if (Math.random() > 0.2) {
      return {
        decision: 'accept',
        reason: `出价 ¥${offerPrice} 符合心理预期，接受！`,
      }
    }
  }

  // 如果出价太低，直接拒绝
  if (offerPrice < effectiveMin * 0.8) {
    return {
      decision: 'reject',
      reason: `出价 ¥${offerPrice} 太低，低于底线 ¥${Math.round(effectiveMin * 0.8)}，拒绝`,
    }
  }

  // 还价：在最低接受价和出价之间
  const counterPrice = Math.round((effectiveMin + offerPrice) / 2)
  return {
    decision: 'counter',
    counterPrice,
    reason: `出价 ¥${offerPrice} 偏低，还价 ¥${counterPrice}`,
  }
}

function simulateBuyerResponse(
  listPrice: number,
  sellerCounterPrice: number
): { decision: 'accept' | 'reject' | 'counter'; counterPrice?: number; reason: string } {
  // 如果卖家还价在接受范围内（低于原价85%），接受
  if (sellerCounterPrice <= listPrice * 0.85) {
    return {
      decision: 'accept',
      reason: `还价 ¥${sellerCounterPrice} 合理，接受！`,
    }
  }

  // 如果还价太高，有 50% 概率放弃，50% 概率继续还价
  if (Math.random() > 0.5) {
    return {
      decision: 'reject',
      reason: `还价 ¥${sellerCounterPrice} 仍偏高，放弃购买`,
    }
  }

  // 继续还价
  const counterPrice = Math.round(sellerCounterPrice * 0.9)
  return {
    decision: 'counter',
    counterPrice,
    reason: `还价 ¥${sellerCounterPrice} 还是高了，再出价 ¥${counterPrice}`,
  }
}

/**
 * POST /api/agent/products/:id/negotiate
 * Agent 发起 AI-to-AI 自动谈判
 *
 * 优先使用 SecondMe AI，如果 token 过期则使用本地模拟逻辑
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeAgentActor(request, ['negotiate.execute'])
  if (!auth.actor) {
    return NextResponse.json(
      { code: auth.status, message: auth.message },
      { status: auth.status, headers: CORS }
    )
  }
  const { actor } = auth

  const { id: productId } = await params

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { seller: true },
  })

  if (!product || product.status !== 'active') {
    return NextResponse.json(
      { code: 404, message: '商品不存在或已下架' },
      { status: 404, headers: CORS }
    )
  }

  if (product.sellerId === actor.user.id) {
    return NextResponse.json(
      { code: 400, message: '不能对自己的商品谈判' },
      { status: 400, headers: CORS }
    )
  }

  const seller = product.seller

  // 检查是否使用 SecondMe（可选）
  const buyerAccess = await requireUsableSecondMeAccess(actor.user)
  const sellerAccess = await requireUsableSecondMeAccess(seller)
  const useSecondMe = buyerAccess && sellerAccess

  const MAX_ROUNDS = 5
  const logs: { role: string; action: string; price?: number; reason?: string }[] = []

  const productTitle = product.title
  const listPrice = product.price
  const minPrice = product.minPrice ?? undefined

  try {
    // 第 1 轮：买家 AI 先判断要不要买、出多少
    let firstBid
    if (useSecondMe) {
      firstBid = await actBargain(buyerAccess.accessToken, {
        productTitle,
        productPrice: listPrice,
        minPrice,
      })
    } else {
      firstBid = simulateBargain(productTitle, listPrice, minPrice)
    }

    // AI 不感兴趣（suggestedPrice 为 0 或 null）
    if (firstBid.suggestedPrice == null || firstBid.suggestedPrice <= 0) {
      return NextResponse.json(
        {
          code: 0,
          data: {
            outcome: 'skipped',
            reason: firstBid.reason || 'AI 暂不感兴趣',
            rounds: 0,
            logs: [{ role: 'buyer', action: '跳过', reason: firstBid.reason || '暂不感兴趣' }],
            mode: useSecondMe ? 'secondme' : 'simulated',
          },
          message: '买方 AI 对该商品不感兴趣',
        },
        { headers: CORS }
      )
    }

    const offerPrice = firstBid.suggestedPrice
    logs.push({ role: 'buyer', action: '出价', price: offerPrice, reason: firstBid.reason })

    let offer = await db.offer.create({
      data: {
        productId,
        buyerId: actor.user.id,
        price: offerPrice,
        message: firstBid.reason || undefined,
        status: 'pending',
      },
    })

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // 卖家 AI 决策
      let sellerRes
      if (useSecondMe) {
        sellerRes = await actSellerDecision(sellerAccess.accessToken, {
          productTitle,
          listPrice,
          minPrice,
          offerPrice: offer.price,
        })
      } else {
        sellerRes = simulateSellerDecision(listPrice, minPrice, offer.price)
      }

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
        return NextResponse.json(
          {
            code: 0,
            data: {
              outcome: 'pending_confirmation',
              finalPrice: offer.price,
              offerId: offer.id,
              rounds: round,
              logs,
              mode: useSecondMe ? 'secondme' : 'simulated',
            },
            message: `谈判成功！成交价 ¥${offer.price}，等待人类确认`,
          },
          { headers: CORS }
        )
      }
      if (sellerRes.decision === 'reject') {
        await db.offer.update({
          where: { id: offer.id },
          data: { status: 'rejected' },
        })
        return NextResponse.json(
          {
            code: 0,
            data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs, mode: useSecondMe ? 'secondme' : 'simulated' },
            message: '卖家 AI 拒绝了出价',
          },
          { headers: CORS }
        )
      }

      // 卖家还价 → 买家 AI 回应
      const counterPrice = sellerRes.counterPrice ?? offer.price
      let buyerRes
      if (useSecondMe) {
        buyerRes = await actBuyerResponse(buyerAccess.accessToken, {
          productTitle,
          listPrice,
          sellerCounterPrice: counterPrice,
        })
      } else {
        buyerRes = simulateBuyerResponse(listPrice, counterPrice)
      }

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
            buyerId: actor.user.id,
            price: counterPrice,
            message: buyerRes.reason || undefined,
            status: 'pending_confirmation',
            inReplyToId: offer.id,
            sellerDecision: 'accept',
          },
        })
        return NextResponse.json(
          {
            code: 0,
            data: {
              outcome: 'pending_confirmation',
              finalPrice: counterPrice,
              offerId: pendingOffer.id,
              rounds: round,
              logs,
              mode: useSecondMe ? 'secondme' : 'simulated',
            },
            message: `谈判成功！成交价 ¥${counterPrice}，等待人类确认`,
          },
          { headers: CORS }
        )
      }
      if (buyerRes.decision === 'reject') {
        return NextResponse.json(
          {
            code: 0,
            data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs, mode: useSecondMe ? 'secondme' : 'simulated' },
            message: '买方 AI 放弃了谈判',
          },
          { headers: CORS }
        )
      }

      // 买家继续还价 → 创建新一轮出价
      const nextPrice = buyerRes.counterPrice ?? counterPrice
      offer = await db.offer.create({
        data: {
          productId,
          buyerId: actor.user.id,
          price: nextPrice,
          message: buyerRes.reason || undefined,
          status: 'pending',
          inReplyToId: offer.id,
        },
      })
    }

    return NextResponse.json(
      {
        code: 0,
        data: {
          outcome: 'no_deal',
          offerId: offer.id,
          rounds: MAX_ROUNDS,
          logs,
          mode: useSecondMe ? 'secondme' : 'simulated',
        },
        message: '达到最大轮次，未成交',
      },
      { headers: CORS }
    )
  } catch (err) {
    console.error('Agent negotiate error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : 'AI 谈价失败' },
      { status: 500, headers: CORS }
    )
  }
}
