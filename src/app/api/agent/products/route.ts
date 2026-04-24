import { NextRequest, NextResponse } from 'next/server'
import { authorizeAgentActor } from '@/lib/auth'
import { db } from '@/lib/db'
import { searchProductImage } from '@/lib/image-search'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

/** OPTIONS — CORS preflight */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/products
 * 浏览市场商品（无需认证）
 *
 * Query params:
 *   page   - 页码（默认 1）
 *   limit  - 每页数量（默认 20，最大 100）
 *   category - 按分类筛选（数码/服饰/家居/图书/其他）
 *   keyword  - 搜索关键词（匹配标题和描述）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const category = searchParams.get('category')
  const keyword = searchParams.get('keyword')

  const where: Record<string, unknown> = { status: 'active' }
  if (category) {
    where.category = category
  }
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
    ]
  }

  const total = await db.product.count({ where })

  const products = await db.product.findMany({
    where,
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
    skip: (page - 1) * limit,
    take: limit,
  })

  const data = products.map((p) => ({
    ...p,
    images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : p.images,
  }))

  return NextResponse.json(
    {
      code: 0,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: `第 ${page}/${Math.ceil(total / limit) || 1} 页，共 ${total} 件在售商品`,
    },
    { headers: CORS }
  )
}

/**
 * POST /api/agent/products
 * Agent 发布商品（需 Bearer Token）
 *
 * Body: { title, description?, price, minPrice?, category?, condition?, images?, imagePrompt? }
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeAgentActor(request, ['products.write'])
  if (!auth.actor) {
    return NextResponse.json(
      { code: auth.status, message: auth.message },
      { status: auth.status, headers: CORS }
    )
  }
  const { actor } = auth

  const body = await request.json()
  const { title, description, price, minPrice, category, condition, images, imagePrompt } = body

  if (!title || !price) {
    return NextResponse.json(
      { code: 400, message: '缺少必填字段：title, price' },
      { status: 400, headers: CORS }
    )
  }

  const normalizedImages = Array.isArray(images)
    ? images
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => /^https?:\/\//i.test(item) || item.startsWith('/'))
        .slice(0, 9)
    : []

  let productImages = normalizedImages
  if (productImages.length === 0) {
    const imageUrl = await searchProductImage(
      typeof imagePrompt === 'string' && imagePrompt.trim() ? imagePrompt.trim() : undefined,
      title,
      category || '其他'
    )
    productImages = [imageUrl]
  }

  const product = await db.product.create({
    data: {
      title,
      description: description || '',
      price: Number(price),
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      category: category || '其他',
      condition: condition || '轻微使用痕迹',
      images: JSON.stringify(productImages),
      sellerId: actor.user.id,
      aiPersonality: actor.agentClient ? `${actor.agentClient.name} 发布` : 'Agent 发布',
    },
  })

  return NextResponse.json(
    {
      code: 0,
      data: {
        id: product.id,
        title: product.title,
        price: product.price,
        images: productImages,
        actorType: actor.agentClient ? 'agent_client' : 'user',
        agentClientId: actor.agentClient?.id ?? null,
      },
      message: '商品发布成功',
    },
    { status: 201, headers: CORS }
  )
}
