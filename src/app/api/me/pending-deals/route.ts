import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getPlaceholderImageUrl } from '@/lib/placeholder'

/** 获取当前用户相关的待确认交易（作为买家或卖家） */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }

  const productSelect = { id: true, title: true, price: true, images: true, category: true }

  const buyerDeals = await db.offer.findMany({
    where: { buyerId: user.id, status: 'pending_confirmation' },
    include: {
      product: {
        select: { ...productSelect, seller: { select: { nickname: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const sellerDeals = await db.offer.findMany({
    where: {
      product: { sellerId: user.id },
      status: 'pending_confirmation',
    },
    include: {
      product: { select: productSelect },
      buyer: { select: { nickname: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const format = (o: any, role: 'buyer' | 'seller') => {
    let img: string | null = null
    try {
      const imgs = typeof o.product.images === 'string' ? JSON.parse(o.product.images || '[]') : o.product.images
      img = Array.isArray(imgs) && imgs[0] ? imgs[0] : null
    } catch { /* ignore */ }
    const category = o.product.category || '其他'
    const title = o.product.title
    return {
      id: o.id,
      price: o.price,
      message: o.message,
      role,
      product: {
        id: o.product.id,
        title,
        listPrice: o.product.price,
        image: img || getPlaceholderImageUrl(category, title),
      },
      counterpart: role === 'buyer' ? (o.product.seller?.nickname ?? '未知') : (o.buyer?.nickname ?? '未知'),
      createdAt: o.createdAt,
    }
  }

  const data = [
    ...buyerDeals.map((o) => format(o, 'buyer')),
    ...sellerDeals.map((o) => format(o, 'seller')),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return NextResponse.json({ code: 0, data })
}
