import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/** 买家或卖家确认成交 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }
  const { id: offerId } = await params

  const offer = await db.offer.findUnique({
    where: { id: offerId },
    include: { product: true },
  })
  if (!offer) {
    return NextResponse.json({ code: 404, message: '出价不存在' }, { status: 404 })
  }
  if (offer.status !== 'pending_confirmation') {
    return NextResponse.json({ code: 400, message: '该出价当前状态不允许确认' }, { status: 400 })
  }
  // 买家或卖家都可以确认
  if (offer.buyerId !== user.id && offer.product.sellerId !== user.id) {
    return NextResponse.json({ code: 403, message: '无权操作' }, { status: 403 })
  }

  await db.offer.update({
    where: { id: offerId },
    data: { status: 'accepted' },
  })
  // 商品标记为已售
  await db.product.update({
    where: { id: offer.productId },
    data: { status: 'sold' },
  })

  return NextResponse.json({ code: 0, message: '交易确认成功' })
}
