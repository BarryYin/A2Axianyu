import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const product = await db.product.findUnique({
    where: { id },
    include: {
      seller: {
        select: { id: true, nickname: true, avatar: true }
      },
      _count: { select: { offers: true } }
    }
  })
  if (!product) {
    return NextResponse.json({ code: 404, message: '商品不存在' }, { status: 404 })
  }
  const data = {
    ...product,
    images: typeof product.images === 'string' ? JSON.parse(product.images || '[]') : product.images
  }
  return NextResponse.json({ code: 0, data })
}
