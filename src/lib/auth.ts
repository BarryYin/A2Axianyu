import { NextRequest } from 'next/server'
import { db } from './db'

export interface SecondMeUser {
  id: string
  nickname: string
  avatar: string
}

function getTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('token')?.value
  if (cookieToken) return cookieToken
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace(/^Bearer\s+/i, '') ?? null
}

export async function getCurrentUser(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return null

  try {
    const user = await db.user.findFirst({
      where: {
        accessToken: token,
        tokenExpiresAt: {
          gt: new Date()
        }
      }
    })

    return user
  } catch (error) {
    console.error('获取用户失败:', error)
    return null
  }
}

export async function refreshAccessToken(refreshToken: string) {
  const url =
    process.env.SECONDME_TOKEN_REFRESH_ENDPOINT ??
    process.env.SECONDME_TOKEN_ENDPOINT!.replace('/token/code', '/token/refresh')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SECONDME_CLIENT_ID!,
      client_secret: process.env.SECONDME_CLIENT_SECRET!,
    }),
  })
  const json = await response.json()
  const data = json.code === 0 ? json.data : null
  const accessToken = data?.accessToken ?? json.access_token
  const newRefreshToken = data?.refreshToken ?? json.refresh_token ?? refreshToken
  const expiresIn = data?.expiresIn ?? json.expires_in ?? 7200
  if (accessToken) {
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    }
  }
  throw new Error('刷新 token 失败')
}