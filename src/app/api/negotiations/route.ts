import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/negotiations/start - Start a negotiation
// GET /api/negotiations?productId=xxx - Get negotiation history for a product
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const orderId = searchParams.get('orderId')

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (orderId) where.orderId = orderId

    const logs = await db.negotiationLog.findMany({
      where,
      orderBy: { round: 'asc' },
    })

    return NextResponse.json({ negotiations: logs })
  } catch (error) {
    console.error('Failed to fetch negotiations:', error)
    return NextResponse.json({ error: 'Failed to fetch negotiations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, buyerAgentId, sellerAgentId, offerPrice } = body

    if (!productId || !buyerAgentId || !offerPrice) {
      return NextResponse.json({ error: 'productId, buyerAgentId, and offerPrice are required' }, { status: 400 })
    }

    // Get product to check auto-accept threshold
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Count existing rounds for this product+buyer
    const existingRounds = await db.negotiationLog.count({
      where: { productId, buyerAgentId },
    })

    const MAX_ROUNDS = 5
    if (existingRounds >= MAX_ROUNDS) {
      const log = await db.negotiationLog.create({
        data: {
          productId,
          buyerAgentId,
          sellerAgentId: sellerAgentId || 'platform',
          round: existingRounds + 1,
          offerPrice,
          status: 'TIMEOUT',
        },
      })
      return NextResponse.json({ negotiation: log, outcome: 'MAX_ROUNDS_REACHED' })
    }

    // Check auto-accept
    const autoAcceptPrice = product.autoAcceptPrice || (product.price * 0.9)
    if (offerPrice >= autoAcceptPrice) {
      // Auto-accept: create order
      const log = await db.negotiationLog.create({
        data: {
          productId,
          buyerAgentId,
          sellerAgentId: sellerAgentId || 'platform',
          round: existingRounds + 1,
          offerPrice,
          status: 'ACCEPTED',
        },
      })

      const order = await db.order.create({
        data: {
          productId,
          buyerId: buyerAgentId, // TODO: map agent to actual user
          status: 'PENDING',
          negotiatedPrice: offerPrice,
          originalPrice: product.price,
          xianyuUrl: product.xianyuUrl || '',
        },
      })

      // Link negotiation to order
      await db.negotiationLog.update({
        where: { id: log.id },
        data: { orderId: order.id },
      })

      return NextResponse.json({ negotiation: log, order, outcome: 'ACCEPTED' }, { status: 201 })
    }

    // Counter-offer: calculate counter price
    const minPrice = product.minPrice || (product.price * 0.7)
    const counterPrice = Math.max(minPrice, offerPrice * 1.05) // 5% markup

    if (counterPrice <= offerPrice * 1.1 && counterPrice >= minPrice) {
      // Within acceptable range, counter-offer
      const log = await db.negotiationLog.create({
        data: {
          productId,
          buyerAgentId,
          sellerAgentId: sellerAgentId || 'platform',
          round: existingRounds + 1,
          offerPrice,
          counterPrice,
          status: 'COUNTER_OFFERED',
        },
      })
      return NextResponse.json({ negotiation: log, counterPrice, outcome: 'COUNTER_OFFERED' })
    }

    // Below minimum, reject
    const log = await db.negotiationLog.create({
      data: {
        productId,
        buyerAgentId,
        sellerAgentId: sellerAgentId || 'platform',
        round: existingRounds + 1,
        offerPrice,
        status: 'REJECTED',
      },
    })
    return NextResponse.json({ negotiation: log, outcome: 'REJECTED' })
  } catch (error) {
    console.error('Failed to create negotiation:', error)
    return NextResponse.json({ error: 'Failed to create negotiation' }, { status: 500 })
  }
}
