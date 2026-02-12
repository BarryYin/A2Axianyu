import { NextRequest, NextResponse } from 'next/server'
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
 * GET /api/agent/products/:id
 * 获取商品详情 + 出价历史（无需认证）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const product = await db.product.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, nickname: true } },
      offers: {
        select: {
          id: true,
          price: true,
          status: true,
          message: true,
          createdAt: true,
          buyer: { select: { id: true, nickname: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!product) {
    return NextResponse.json(
      { code: 404, message: '商品不存在' },
      { status: 404, headers: CORS }
    )
  }

  return NextResponse.json(
    {
      code: 0,
      data: {
        ...product,
        images: typeof product.images === 'string' ? JSON.parse(product.images || '[]') : product.images,
      },
    },
    { headers: CORS }
  )
}
