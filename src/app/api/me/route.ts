import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

/** 获取当前登录用户身份信息 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
  }

  return NextResponse.json({
    code: 0,
    data: {
      userId: user.id,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      isPlatformSeller: user.isPlatformSeller,
    },
  })
}
