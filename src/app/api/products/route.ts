import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// 获取商品列表
export async function GET(request: NextRequest) {
  try {
    const products = await db.product.findMany({
      where: { status: 'active' },
      include: {
        seller: {
          select: { id: true, nickname: true, avatar: true }
        },
        _count: { select: { offers: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    const data = products.map((p) => ({
      ...p,
      images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : p.images
    }))
    return NextResponse.json({ code: 0, data })
  } catch (error) {
    console.error('获取商品列表失败:', error)
    return NextResponse.json(
      { code: 500, message: '获取商品列表失败' },
      { status: 500 }
    )
  }
}

// 发布商品
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
    }

    const {
      title,
      description,
      price,
      category,
      condition,
      images,
      aiPersonality,
      minPrice,
    } = await request.json()

    const imagesStr = Array.isArray(images) ? JSON.stringify(images) : (images ?? '[]')
    const product = await db.product.create({
      data: {
        title,
        description,
        price,
        category,
        condition,
        images: imagesStr,
        aiPersonality,
        minPrice,
        sellerId: user.id,
      },
      include: {
        seller: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          }
        }
      }
    })

    return NextResponse.json({ code: 0, data: product })
  } catch (error) {
    console.error('发布商品失败:', error)
    return NextResponse.json(
      { code: 500, message: '发布商品失败' },
      { status: 500 }
    )
  }
}