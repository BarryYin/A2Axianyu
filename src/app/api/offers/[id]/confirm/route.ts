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

  // 更新 offer 和商品状态
  await db.offer.update({
    where: { id: offerId },
    data: { status: 'accepted' },
  })
  await db.product.update({
    where: { id: offer.productId },
    data: { status: 'sold' },
  })

  // 创建订单
  const order = await db.order.create({
    data: {
      productId: offer.productId,
      buyerId: offer.buyerId,
      negotiatedPrice: offer.price,
      originalPrice: offer.product.price,
      status: 'PENDING',
    },
  })

  // 创建订单通知
  await db.notification.create({
    data: {
      orderId: order.id,
      type: 'PURCHASE_SUCCESS',
      message: `订单已生成：${offer.product.title}，成交价 ¥${offer.price}`,
    },
  })

  return NextResponse.json({
    code: 0,
    message: '交易确认成功',
    data: { orderId: order.id, price: order.negotiatedPrice },
  })
}
