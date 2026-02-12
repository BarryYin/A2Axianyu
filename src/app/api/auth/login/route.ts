import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const switchAccount = searchParams.get('switch') === '1'

  const params = new URLSearchParams({
    client_id: process.env.SECONDME_CLIENT_ID!,
    redirect_uri: process.env.SECONDME_REDIRECT_URI!,
    response_type: 'code',
    scope: 'user.info user.info.shades user.info.softmemory chat note.add',
    state: Math.random().toString(36).substring(7),
  })
  // 切换账号时带上 prompt，让授权页尽量展示账号选择（若 SecondMe 支持）
  if (switchAccount) {
    params.set('prompt', 'select_account')
  }

  const authUrl = `${process.env.SECONDME_OAUTH_URL}?${params.toString()}`
  const res = NextResponse.redirect(authUrl)

  // 切换账号：先清除本站登录态，再跳转授权页，方便用户选其他账号
  if (switchAccount) {
    res.cookies.set('token', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 0, path: '/' })
  }

  return res
}