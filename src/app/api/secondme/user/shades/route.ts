import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireUsableSecondMeAccess } from '@/lib/auth'
import { getUserShades } from '@/lib/secondme'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
    }

    const access = await requireUsableSecondMeAccess(user)
    if (!access) {
      return NextResponse.json({ code: 401, message: 'Token已过期且刷新失败' }, { status: 401 })
    }

    const shades = await getUserShades(access.accessToken)

    return NextResponse.json(shades)
  } catch (error) {
    console.error('获取用户兴趣标签失败:', error)
    return NextResponse.json(
      { code: 500, message: '获取用户兴趣标签失败' },
      { status: 500 }
    )
  }
}
