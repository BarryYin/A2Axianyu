import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getProductImageUrl } from '@/lib/placeholder'

/** 获取当前用户的订单列表（作为买家或卖家） */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }

  // 查询作为买家的订单
  const buyerOrders = await db.order.findMany({
    where: { buyerId: user.id },
    include: {
      product: { select: { id: true, title: true, images: true, category: true, sellerId: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // 查询作为卖家的订单（通过产品关联）
  const sellerOrders = await db.order.findMany({
    where: {
      product: {
        sellerId: user.id
      }
    },
    include: {
      product: { select: { id: true, title: true, images: true, category: true, sellerId: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const format = (o: any, role: 'buyer' | 'seller') => {
    const imgs = typeof o.product.images === 'string' ? JSON.parse(o.product.images || '[]') : o.product.images
    return {
      id: o.id,
      price: o.negotiatedPrice,
      originalPrice: o.originalPrice,
      status: o.status,
      role,
      product: {
        id: o.product.id,
        title: o.product.title,
        image: getProductImageUrl(imgs || [], o.product.category || '其他', o.product.title),
      },
      counterpart: role === 'buyer' ? '卖家' : '买家',
      createdAt: o.createdAt,
    }
  }

  const orders = [
    ...buyerOrders.map((o) => format(o, 'buyer')),
    ...sellerOrders.map((o) => format(o, 'seller'))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ code: 0, data: orders })
}
