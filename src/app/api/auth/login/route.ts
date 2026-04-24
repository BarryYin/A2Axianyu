import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: '手机号和密码不能为空' },
        { status: 400 }
      )
    }

    // 查找用户
    const user = await db.user.findUnique({
      where: { phone }
    })

    if (!user) {
      return NextResponse.json(
        { error: '手机号或密码错误' },
        { status: 401 }
      )
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: '手机号或密码错误' },
        { status: 401 }
      )
    }

    // 设置 session cookie
    const cookieStore = await cookies()
    cookieStore.set('session', JSON.stringify({
      userId: user.id,
      phone: user.phone,
      nickname: user.nickname,
      isPlatformSeller: user.isPlatformSeller,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30天
      path: '/',
    })

    return NextResponse.json({
      success: true,
      message: '登录成功',
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
        isPlatformSeller: user.isPlatformSeller,
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '登录失败，请重试' },
      { status: 500 }
    )
  }
}

// 保留旧版 SecondMe OAuth 登录（可选）
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const switchAccount = searchParams.get('switch') === '1'

  const redirectUri =
    process.env.SECONDME_REDIRECT_URI || `${origin}/api/auth/callback`

  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user.info user.info.shades user.info.softmemory chat note.add',
    state: Math.random().toString(36).substring(7),
  })

  if (switchAccount) {
    params.set('prompt', 'select_account')
  }

  const authUrl = `${process.env.SECONDME_OAUTH_URL}?${params.toString()}`
  const res = NextResponse.redirect(authUrl)

  if (switchAccount) {
    res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
  }

  return res
}
