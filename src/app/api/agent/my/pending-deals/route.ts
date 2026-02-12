import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/my/pending-deals
 * 获取我的待确认交易（需 Bearer Token）
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '认证失败' },
      { status: 401, headers: CORS }
    )
  }

  const offers = await db.offer.findMany({
    where: {
      status: 'pending_confirmation',
      OR: [{ buyerId: user.id }, { product: { sellerId: user.id } }],
    },
    include: {
      product: { select: { id: true, title: true, price: true } },
      buyer: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const data = offers.map((o) => ({
    offerId: o.id,
    role: o.buyerId === user.id ? 'buyer' : 'seller',
    negotiatedPrice: o.price,
    listPrice: o.product.price,
    productId: o.product.id,
    productTitle: o.product.title,
    counterpart: o.buyerId === user.id ? 'seller' : o.buyer.nickname,
    createdAt: o.createdAt,
  }))

  return NextResponse.json(
    { code: 0, data, message: `${data.length} 笔待确认交易` },
    { headers: CORS }
  )
}
