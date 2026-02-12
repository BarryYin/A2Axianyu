import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return redirectTo('/?error=no_code', request)
  }

  try {
    const tokenRes = await fetch(process.env.SECONDME_TOKEN_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SECONDME_REDIRECT_URI!,
        client_id: process.env.SECONDME_CLIENT_ID!,
        client_secret: process.env.SECONDME_CLIENT_SECRET!,
      }),
    })
    const tokenJson = await tokenRes.json()
    const tokenData = tokenJson.code === 0 ? tokenJson.data : null
    const accessToken = tokenData?.accessToken ?? tokenJson.access_token
    const refreshToken = tokenData?.refreshToken ?? tokenJson.refresh_token ?? ''
    const expiresIn = tokenData?.expiresIn ?? tokenJson.expires_in ?? 7200

    if (!accessToken) {
      console.error('Token 交换失败:', tokenJson)
      return redirectTo('/?error=auth_failed', request)
    }

    const userRes = await fetch(
      `${process.env.SECONDME_API_BASE_URL}/api/secondme/user/info`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const userData = await userRes.json()
    if (userData.code !== 0) throw new Error('Failed to get user info')

    const d = userData.data
    const secondmeUserId = d.id ?? d.userId ?? String(d.id)
    const nickname = d.nickname ?? d.name ?? d.email ?? ''
    const avatar = d.avatar ?? d.avatarUrl ?? ''

    const expiresAt = new Date(Date.now() + expiresIn * 1000)

    await db.user.upsert({
      where: { secondmeUserId },
      update: {
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        nickname,
        avatar,
      },
      create: {
        secondmeUserId,
        accessToken,
        refreshToken,
        tokenExpiresAt: expiresAt,
        nickname,
        avatar,
      },
    })

    const res = NextResponse.redirect(new URL('/dashboard', request.url))
    res.cookies.set('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('OAuth callback error:', err)
    return redirectTo('/?error=auth_failed', request)
  }
}