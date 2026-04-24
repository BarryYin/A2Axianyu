import { NextRequest, NextResponse } from 'next/server'
import { authorizeAgentActor } from '@/lib/auth'
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
 * POST /api/agent/offers/:id/confirm
 * 确认成交（需 Bearer Token）
 *
 * 买卖双方均可确认，确认后商品标记为已售。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeAgentActor(request, ['deals.write'])
  if (!auth.actor) {
    return NextResponse.json(
      { code: auth.status, message: auth.message },
      { status: auth.status, headers: CORS }
    )
  }
  const { actor } = auth

  const { id: offerId } = await params

  const offer = await db.offer.findUnique({
    where: { id: offerId },
    include: { product: true },
  })

  if (!offer) {
    return NextResponse.json(
      { code: 404, message: '出价不存在' },
      { status: 404, headers: CORS }
    )
  }

  if (offer.status !== 'pending_confirmation') {
    return NextResponse.json(
      { code: 400, message: '该出价当前状态不允许确认', data: { currentStatus: offer.status } },
      { status: 400, headers: CORS }
    )
  }

  if (offer.buyerId !== actor.user.id && offer.product.sellerId !== actor.user.id) {
    return NextResponse.json(
      { code: 403, message: '无权操作，你不是该交易的买方或卖方' },
      { status: 403, headers: CORS }
    )
  }

  await db.offer.update({
    where: { id: offerId },
    data: { status: 'accepted' },
  })

  await db.product.update({
    where: { id: offer.productId },
    data: { status: 'sold' },
  })

  return NextResponse.json(
    {
      code: 0,
      data: {
        offerId,
        productId: offer.productId,
        finalPrice: offer.price,
        status: 'accepted',
        actorType: actor.agentClient ? 'agent_client' : 'user',
        agentClientId: actor.agentClient?.id ?? null,
      },
      message: '交易确认成功，商品已标记为已售',
    },
    { headers: CORS }
  )
}
