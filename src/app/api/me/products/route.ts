import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }
  const products = await db.product.findMany({
    where: { sellerId: user.id },
    include: {
      _count: { select: { offers: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  const data = products.map((p) => ({
    ...p,
    images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : p.images
  }))
  return NextResponse.json({ code: 0, data })
}
