import { NextRequest, NextResponse } from 'next/server'
import { authorizeAgentActor } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/my/pending-deals
 * 获取我的待确认交易（需 Bearer Token）
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeAgentActor(request, ['deals.read'])
  if (!auth.actor) {
    return NextResponse.json(
      { code: auth.status, message: auth.message },
      { status: auth.status, headers: CORS }
    )
  }
  const { actor } = auth

  const offers = await db.offer.findMany({
    where: {
      status: 'pending_confirmation',
      OR: [{ buyerId: actor.user.id }, { product: { sellerId: actor.user.id } }],
    },
    include: {
      product: { select: { id: true, title: true, price: true } },
      buyer: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const data = offers.map((o) => ({
    offerId: o.id,
    role: o.buyerId === actor.user.id ? 'buyer' : 'seller',
    negotiatedPrice: o.price,
    listPrice: o.product.price,
    productId: o.product.id,
    productTitle: o.product.title,
    counterpart: o.buyerId === actor.user.id ? 'seller' : o.buyer.nickname,
    createdAt: o.createdAt,
  }))

  return NextResponse.json(
    { code: 0, data, message: `${data.length} 笔待确认交易` },
    { headers: CORS }
  )
}
