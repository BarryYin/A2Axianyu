import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'

// 获取平台商品列表（公开）
export async function GET() {
  try {
    const products = await db.product.findMany({
      where: {
        platformListed: true,
        status: 'active',
      },
      include: {
        seller: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            isPlatformSeller: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, products })
  } catch (error) {
    console.error('Get platform products error:', error)
    return NextResponse.json(
      { error: '获取商品列表失败' },
      { status: 500 }
    )
  }
}

// 创建平台商品（需要平台卖家权限）
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser()
    if (!session?.isPlatformSeller) {
      return NextResponse.json(
        { error: '无权操作，需要平台卖家权限' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      title,
      description,
      price,
      category,
      condition,
      images,
      minPrice,
      maxPrice,
      autoAcceptPrice,
      xianyuUrl,
    } = body

    if (!title || !price || !category) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      )
    }

    const product = await db.product.create({
      data: {
        title,
        description: description || '',
        price,
        category,
        condition: condition || '95新',
        images: JSON.stringify(images || []),
        minPrice: minPrice || price * 0.8,
        maxPrice: maxPrice || price * 1.2,
        autoAcceptPrice: autoAcceptPrice || price * 0.9,
        xianyuUrl,
        source: xianyuUrl ? 'xianyu' : 'manual',
        platformListed: true,
        sellerId: session.userId,
        aiPersonality: '平台官方AI代理，专业、友好、善于协商',
      }
    })

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error('Create platform product error:', error)
    return NextResponse.json(
      { error: '创建商品失败' },
      { status: 500 }
    )
  }
}
