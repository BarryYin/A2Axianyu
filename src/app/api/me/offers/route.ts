import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }
  const offers = await db.offer.findMany({
    where: { buyerId: user.id },
    include: {
      product: {
        select: { id: true, title: true, price: true, status: true, images: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  const data = offers.map((o) => ({
    ...o,
    product: o.product
      ? {
          ...o.product,
          images: typeof o.product.images === 'string' ? JSON.parse(o.product.images || '[]') : o.product.images
        }
      : null
  }))
  return NextResponse.json({ code: 0, data })
}
