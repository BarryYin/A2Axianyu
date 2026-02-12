import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

// 获取商品的所有出价
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const offers = await db.offer.findMany({
      where: {
        productId: id,
      },
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ code: 0, data: offers })
  } catch (error) {
    console.error('获取出价列表失败:', error)
    return NextResponse.json(
      { code: 500, message: '获取出价列表失败' },
      { status: 500 }
    )
  }
}

// 创建出价
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
    }

    const { price, message } = await request.json()

    // 检查商品是否存在
    const product = await db.product.findUnique({
      where: { id },
      include: { seller: true }
    })

    if (!product) {
      return NextResponse.json({ code: 404, message: '商品不存在' }, { status: 404 })
    }

    if (product.sellerId === user.id) {
      return NextResponse.json({ code: 400, message: '不能对自己的商品出价' }, { status: 400 })
    }

    const offer = await db.offer.create({
      data: {
        price,
        message,
        productId: id,
        buyerId: user.id,
      },
      include: {
        buyer: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
          }
        }
      }
    })

    return NextResponse.json({ code: 0, data: offer })
  } catch (error) {
    console.error('创建出价失败:', error)
    return NextResponse.json(
      { code: 500, message: '创建出价失败' },
      { status: 500 }
    )
  }
}