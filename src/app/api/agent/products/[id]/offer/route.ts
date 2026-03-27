import { NextRequest, NextResponse } from 'next/server'
import { getAgentActor } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * POST /api/agent/products/:id/offer
 * Agent 对商品出价（需 Bearer Token）
 *
 * Body: { price: number, message?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAgentActor(request)
  if (!actor) {
    return NextResponse.json(
      { code: 401, message: '认证失败，请传入 SecondMe access_token 或 X-Agent-API-Key' },
      { status: 401, headers: CORS }
    )
  }

  const { id: productId } = await params
  const body = await request.json()
  const { price, message } = body

  if (!price || price <= 0) {
    return NextResponse.json(
      { code: 400, message: '请提供有效的出价金额 price' },
      { status: 400, headers: CORS }
    )
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { seller: { select: { id: true, nickname: true } } },
  })
  if (!product || product.status !== 'active') {
    return NextResponse.json(
      { code: 404, message: '商品不存在或已下架' },
      { status: 404, headers: CORS }
    )
  }

  if (product.sellerId === actor.user.id) {
    return NextResponse.json(
      { code: 400, message: '不能对自己的商品出价' },
      { status: 400, headers: CORS }
    )
  }

  const offer = await db.offer.create({
    data: {
      price: Number(price),
      message: message || `Agent offer: ¥${price}`,
      status: 'pending',
      productId,
      buyerId: actor.user.id,
    },
  })

  return NextResponse.json(
    {
      code: 0,
      data: {
        offerId: offer.id,
        price: offer.price,
        status: offer.status,
        actorType: actor.agentClient ? 'agent_client' : 'user',
        agentClientId: actor.agentClient?.id ?? null,
        product: {
          id: product.id,
          title: product.title,
          listPrice: product.price,
          minPrice: product.minPrice,
          sellerNickname: product.seller?.nickname || '未知卖家',
        },
      },
      message: `出价成功：¥${offer.price}（挂牌价 ¥${product.price}）`,
    },
    { status: 201, headers: CORS }
  )
}
