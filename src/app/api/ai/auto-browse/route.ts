import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { actPickProducts, actBargain, actSellerDecision, actBuyerResponse } from '@/lib/secondme'

const MAX_ROUNDS = 3

interface NegLog { role: 'buyer' | 'seller'; action: string; price?: number; reason?: string }
interface NegResult {
  productId: string
  productTitle: string
  outcome: string
  finalPrice?: number
  offerId?: string
  reason?: string
  logs: NegLog[]
}

/**
 * AI 自动扫货 → 挑选 → 逐个谈判
 * POST /api/ai/auto-browse
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }

  try {
    // 1. 获取市场上不是自己的、仍在售的商品
    const products = await db.product.findMany({
      where: {
        status: 'active',
        sellerId: { not: user.id },
      },
      include: { seller: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    if (products.length === 0) {
      return NextResponse.json({
        code: 0,
        data: { results: [], message: '市场上暂无其他人的商品' },
      })
    }

    // 2. AI 挑选感兴趣的
    const picks = await actPickProducts(
      user.accessToken,
      products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        condition: p.condition,
      }))
    )

    if (picks.length === 0) {
      return NextResponse.json({
        code: 0,
        data: { results: [], message: 'AI 看了一圈，暂时没有感兴趣的商品' },
      })
    }

    // 3. 对每个感兴趣的商品发起谈判
    const results: NegResult[] = []

    for (const pick of picks.slice(0, 5)) {
      const product = products.find((p) => p.id === pick.id)
      if (!product) continue
      // 卖家 token 过期则跳过
      if (product.seller.tokenExpiresAt < new Date()) {
        results.push({
          productId: product.id,
          productTitle: product.title,
          outcome: 'skipped',
          reason: '卖家登录已过期',
          logs: [],
        })
        continue
      }

      const negResult = await negotiateForProduct(
        user,
        product,
        product.seller
      )
      results.push(negResult)
    }

    return NextResponse.json({ code: 0, data: { results } })
  } catch (err) {
    console.error('Auto-browse error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : 'AI 自动扫货失败' },
      { status: 500 }
    )
  }
}

async function negotiateForProduct(
  buyer: { id: string; accessToken: string },
  product: { id: string; title: string; price: number; minPrice: number | null },
  seller: { accessToken: string }
): Promise<NegResult> {
  const logs: NegLog[] = []
  const buyerToken = buyer.accessToken
  const sellerToken = seller.accessToken
  const { title: productTitle, price: listPrice, minPrice } = product

  try {
    // 买家 AI 首轮出价
    const firstBid = await actBargain(buyerToken, {
      productTitle,
      productPrice: listPrice,
      minPrice: minPrice ?? undefined,
    })

    if (firstBid.suggestedPrice == null || firstBid.suggestedPrice <= 0) {
      return {
        productId: product.id,
        productTitle,
        outcome: 'skipped',
        reason: firstBid.reason || '细看后不感兴趣',
        logs: [{ role: 'buyer', action: '跳过', reason: firstBid.reason || '不感兴趣' }],
      }
    }

    const offerPrice = firstBid.suggestedPrice
    logs.push({ role: 'buyer', action: '出价', price: offerPrice, reason: firstBid.reason })

    let offer = await db.offer.create({
      data: {
        productId: product.id,
        buyerId: buyer.id,
        price: offerPrice,
        message: firstBid.reason || undefined,
        status: 'pending',
      },
    })

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const sellerRes = await actSellerDecision(sellerToken, {
        productTitle,
        listPrice,
        minPrice: minPrice ?? undefined,
        offerPrice: offer.price,
      })
      logs.push({ role: 'seller', action: sellerRes.decision, price: sellerRes.counterPrice, reason: sellerRes.reason })

      await db.offer.update({
        where: { id: offer.id },
        data: { sellerDecision: sellerRes.decision, counterPrice: sellerRes.counterPrice ?? undefined },
      })

      if (sellerRes.decision === 'accept') {
        await db.offer.update({ where: { id: offer.id }, data: { status: 'pending_confirmation' } })
        return {
          productId: product.id,
          productTitle,
          outcome: 'pending_confirmation',
          finalPrice: offer.price,
          offerId: offer.id,
          logs,
        }
      }
      if (sellerRes.decision === 'reject') {
        await db.offer.update({ where: { id: offer.id }, data: { status: 'rejected' } })
        return { productId: product.id, productTitle, outcome: 'rejected', offerId: offer.id, logs }
      }

      const counterPrice = sellerRes.counterPrice ?? offer.price
      const buyerRes = await actBuyerResponse(buyerToken, {
        productTitle,
        listPrice,
        sellerCounterPrice: counterPrice,
      })
      logs.push({ role: 'buyer', action: buyerRes.decision, price: buyerRes.counterPrice, reason: buyerRes.reason })

      if (buyerRes.decision === 'accept') {
        const pendingOffer = await db.offer.create({
          data: {
            productId: product.id,
            buyerId: buyer.id,
            price: counterPrice,
            message: buyerRes.reason || undefined,
            status: 'pending_confirmation',
            inReplyToId: offer.id,
            sellerDecision: 'accept',
          },
        })
        return {
          productId: product.id,
          productTitle,
          outcome: 'pending_confirmation',
          finalPrice: counterPrice,
          offerId: pendingOffer.id,
          logs,
        }
      }
      if (buyerRes.decision === 'reject') {
        return { productId: product.id, productTitle, outcome: 'rejected', offerId: offer.id, logs }
      }

      const nextPrice = buyerRes.counterPrice ?? counterPrice
      offer = await db.offer.create({
        data: {
          productId: product.id,
          buyerId: buyer.id,
          price: nextPrice,
          message: buyerRes.reason || undefined,
          status: 'pending',
          inReplyToId: offer.id,
        },
      })
    }

    return {
      productId: product.id,
      productTitle,
      outcome: 'no_deal',
      offerId: offer.id,
      logs,
    }
  } catch (err) {
    return {
      productId: product.id,
      productTitle,
      outcome: 'error',
      reason: err instanceof Error ? err.message : '谈判出错',
      logs,
    }
  }
}
