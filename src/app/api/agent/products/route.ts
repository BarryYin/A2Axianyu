import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { searchProductImage } from '@/lib/image-search'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/** OPTIONS — CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/products
 * 浏览市场商品（无需认证）
 */
export async function GET() {
  const products = await db.product.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      condition: true,
      images: true,
      createdAt: true,
      seller: { select: { id: true, nickname: true } },
      _count: { select: { offers: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const data = products.map((p) => ({
    ...p,
    images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : p.images,
  }))

  return NextResponse.json(
    { code: 0, data, message: `共 ${data.length} 件在售商品` },
    { headers: CORS }
  )
}

/**
 * POST /api/agent/products
 * Agent 发布商品（需 Bearer Token）
 *
 * Body: { title, description?, price, minPrice?, category?, condition? }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '认证失败，请在 Authorization 头传入 SecondMe access_token' },
      { status: 401, headers: CORS }
    )
  }

  const body = await request.json()
  const { title, description, price, minPrice, category, condition } = body

  if (!title || !price) {
    return NextResponse.json(
      { code: 400, message: '缺少必填字段：title, price' },
      { status: 400, headers: CORS }
    )
  }

  // 搜索并下载商品图片
  const imageUrl = await searchProductImage(undefined, title, category || '其他')

  const product = await db.product.create({
    data: {
      title,
      description: description || '',
      price: Number(price),
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      category: category || '其他',
      condition: condition || '轻微使用痕迹',
      images: JSON.stringify([imageUrl]),
      sellerId: user.id,
      aiPersonality: 'Agent 发布',
    },
  })

  return NextResponse.json(
    {
      code: 0,
      data: { id: product.id, title: product.title, price: product.price },
      message: '商品发布成功',
    },
    { status: 201, headers: CORS }
  )
}
