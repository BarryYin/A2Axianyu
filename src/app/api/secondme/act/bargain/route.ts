import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { actBargain } from '@/lib/secondme'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }
  if (user.tokenExpiresAt < new Date()) {
    return NextResponse.json({ code: 401, message: '登录已过期' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { productTitle, productPrice, minPrice } = body
    if (!productTitle || productPrice == null) {
      return NextResponse.json(
        { code: 400, message: '缺少商品信息' },
        { status: 400 }
      )
    }
    const result = await actBargain(user.accessToken, {
      productTitle,
      productPrice: Number(productPrice),
      minPrice: minPrice != null ? Number(minPrice) : undefined
    })
    return NextResponse.json({ code: 0, data: result })
  } catch (err) {
    console.error('Act bargain error:', err)
    return NextResponse.json(
      { code: 500, message: 'AI 砍价失败' },
      { status: 500 }
    )
  }
}
