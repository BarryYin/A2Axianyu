import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { actBargain, actSellerDecision, actBuyerResponse } from '@/lib/secondme'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * POST /api/agent/products/:id/negotiate
 * Agent 发起 AI-to-AI 自动谈判（需 Bearer Token）
 *
 * 买方 Agent 调用，系统会调用买方和卖方的 SecondMe Act API 多轮谈判
 * 谈成后进入 pending_confirmation 等待人类确认
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '认证失败，请在 Authorization 头传入 SecondMe access_token' },
      { status: 401, headers: CORS }
    )
  }

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

  if (product.sellerId === user.id) {
    return NextResponse.json(
      { code: 400, message: '不能对自己的商品谈判' },
      { status: 400, headers: CORS }
    )
  }

  const seller = product.seller
  if (!seller.accessToken) {
    return NextResponse.json(
      { code: 400, message: '卖家 Agent 不在线（无 token）' },
      { status: 400, headers: CORS }
    )
  }

  const MAX_ROUNDS = 5
  const logs: { role: string; action: string; price?: number; reason?: string }[] = []

  const buyerToken = user.accessToken
  const sellerToken = seller.accessToken
  const productTitle = product.title
  const listPrice = product.price
  const minPrice = product.minPrice ?? undefined

  try {
    // 第 1 轮：买家 AI 先判断要不要买、出多少
    const firstBid = await actBargain(buyerToken, {
      productTitle,
      productPrice: listPrice,
      minPrice,
    })

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
        buyerId: user.id,
        price: offerPrice,
        message: firstBid.reason || undefined,
        status: 'pending',
      },
    })

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // 卖家 AI 决策
      const sellerRes = await actSellerDecision(sellerToken, {
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
        return NextResponse.json(
          {
            code: 0,
            data: {
              outcome: 'pending_confirmation',
              finalPrice: offer.price,
              offerId: offer.id,
              rounds: round,
              logs,
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
            data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs },
            message: '卖家 AI 拒绝了出价',
          },
          { headers: CORS }
        )
      }

      // 卖家还价 → 买家 AI 回应
      const counterPrice = sellerRes.counterPrice ?? offer.price
      const buyerRes = await actBuyerResponse(buyerToken, {
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
        return NextResponse.json(
          {
            code: 0,
            data: {
              outcome: 'pending_confirmation',
              finalPrice: counterPrice,
              offerId: pendingOffer.id,
              rounds: round,
              logs,
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
            data: { outcome: 'rejected', offerId: offer.id, rounds: round, logs },
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
          buyerId: user.id,
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
