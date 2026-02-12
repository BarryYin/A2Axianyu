import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUserInfo } from '@/lib/secondme'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
    }

    // 检查token是否过期
    if (user.tokenExpiresAt < new Date()) {
      return NextResponse.json({ code: 401, message: 'Token已过期' }, { status: 401 })
    }

    const userInfo = await getUserInfo(user.accessToken)

    return NextResponse.json(userInfo)
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json(
      { code: 500, message: '获取用户信息失败' },
      { status: 500 }
    )
  }
}