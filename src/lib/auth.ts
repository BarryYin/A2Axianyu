import { createHash, randomBytes } from 'crypto'
import { AgentClient, User } from '@prisma/client'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { db } from './db'
import { getUserInfo } from './secondme'

export interface SecondMeUser {
  id: string
  nickname: string
  avatar: string
}

export interface SessionUser {
  userId: string
  phone: string
  nickname: string | null
  isPlatformSeller: boolean
}

const AGENT_KEY_PREFIX = 'agt_'
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.replace(/^Bearer\s+/i, '').trim() ?? null
}

function getUserTokenFromRequest(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('token')?.value
  if (cookieToken) return cookieToken

  const bearerToken = getBearerToken(request)
  if (!bearerToken || bearerToken.startsWith(AGENT_KEY_PREFIX)) return null

  return bearerToken
}

// 从 session cookie 获取用户信息（新登录方式）
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) return null

  try {
    const session = JSON.parse(sessionCookie) as SessionUser
    return session
  } catch {
    return null
  }
}

export function getAgentApiKeyFromRequest(request: NextRequest): string | null {
  const directKey = request.headers.get('x-agent-api-key')?.trim()
  if (directKey) return directKey

  const bearerToken = getBearerToken(request)
  if (bearerToken?.startsWith(AGENT_KEY_PREFIX)) return bearerToken

  return null
}

export function hashCredential(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export function hashAgentApiKey(apiKey: string) {
  return hashCredential(apiKey)
}

export function createAgentApiKey() {
  return `${AGENT_KEY_PREFIX}${randomBytes(24).toString('hex')}`
}

function parseScopes(rawScopes: string) {
  try {
    const parsed = JSON.parse(rawScopes || '[]')
    return Array.isArray(parsed)
      ? parsed.filter((scope: unknown): scope is string => typeof scope === 'string' && scope.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function needsTokenRefresh(user: Pick<User, 'tokenExpiresAt'>) {
  if (!user.tokenExpiresAt) return false
  return user.tokenExpiresAt.getTime() <= Date.now() + TOKEN_REFRESH_BUFFER_MS
}

function extractSecondMeProfile(payload: unknown): SecondMeUser | null {
  if (!payload || typeof payload !== 'object') return null

  const data =
    'code' in payload && (payload as { code?: unknown }).code === 0
      ? (payload as { data?: unknown }).data
      : payload

  if (!data || typeof data !== 'object') return null

  const rawId = (data as { id?: unknown; userId?: unknown }).id ?? (data as { userId?: unknown }).userId
  if (rawId == null) return null

  const nickname =
    (data as { nickname?: unknown; name?: unknown; email?: unknown }).nickname ??
    (data as { name?: unknown }).name ??
    (data as { email?: unknown }).email ??
    ''

  const avatar =
    (data as { avatar?: unknown; avatarUrl?: unknown }).avatar ??
    (data as { avatarUrl?: unknown }).avatarUrl ??
    ''

  return {
    id: String(rawId),
    nickname: typeof nickname === 'string' ? nickname : '',
    avatar: typeof avatar === 'string' ? avatar : '',
  }
}

async function provisionUserFromAccessToken(accessToken: string) {
  try {
    const payload = await getUserInfo(accessToken)
    const profile = extractSecondMeProfile(payload)
    if (!profile) return null

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)

    return await db.user.upsert({
      where: { secondmeUserId: profile.id },
      update: {
        accessToken,
        tokenExpiresAt: expiresAt,
        nickname: profile.nickname || undefined,
        avatar: profile.avatar || undefined,
      },
      create: {
        secondmeUserId: profile.id,
        accessToken,
        refreshToken: '',
        tokenExpiresAt: expiresAt,
        nickname: profile.nickname || undefined,
        avatar: profile.avatar || undefined,
      },
    })
  } catch (error) {
    console.error('通过 access token 补建用户失败:', error)
    return null
  }
}

export async function getCurrentUser(request: NextRequest) {
  // 先尝试从 session 获取（新登录方式）
  const sessionUser = await getSessionUser()
  if (sessionUser) {
    const user = await db.user.findUnique({
      where: { id: sessionUser.userId }
    })
    if (user) return user
  }

  // 回退到旧版 SecondMe token 方式
  const token = getUserTokenFromRequest(request)
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

    if (user) return user

    return await provisionUserFromAccessToken(token)
  } catch (error) {
    console.error('获取用户失败:', error)
    return null
  }
}

export async function getCurrentAgentClient(request: NextRequest) {
  const apiKey = getAgentApiKeyFromRequest(request)
  if (!apiKey) return null

  try {
    const agentClient = await db.agentClient.findFirst({
      where: {
        apiKeyHash: hashAgentApiKey(apiKey),
        status: 'active',
      },
      include: {
        ownerUser: true,
      },
    })

    if (!agentClient) return null

    await db.agentClient.update({
      where: { id: agentClient.id },
      data: { lastUsedAt: new Date() },
    })

    return agentClient
  } catch (error) {
    console.error('获取 Agent Client 失败:', error)
    return null
  }
}

export interface AgentActor {
  user: User
  agentClient: AgentClient | null
}

export interface AgentAuthorizationResult {
  actor: AgentActor | null
  status?: number
  message?: string
}

export async function getAgentActor(request: NextRequest): Promise<AgentActor | null> {
  const agentClient = await getCurrentAgentClient(request)
  if (agentClient?.ownerUser) {
    return {
      user: agentClient.ownerUser,
      agentClient,
    }
  }

  const user = await getCurrentUser(request)
  if (!user) return null

  return {
    user,
    agentClient: null,
  }
}

export function getAgentClientScopes(agentClient: AgentClient | null) {
  if (!agentClient) return []
  return parseScopes(agentClient.scopes)
}

export function agentClientHasScopes(agentClient: AgentClient | null, requiredScopes: string[]) {
  if (!agentClient || requiredScopes.length === 0) return true
  const grantedScopes = new Set(getAgentClientScopes(agentClient))
  return requiredScopes.every((scope) => grantedScopes.has(scope))
}

export async function authorizeAgentActor(
  request: NextRequest,
  requiredScopes: string[] = []
): Promise<AgentAuthorizationResult> {
  const actor = await getAgentActor(request)
  if (!actor) {
    return {
      actor: null,
      status: 401,
      message: '认证失败，请传入 SecondMe access_token 或 X-Agent-API-Key',
    }
  }

  if (actor.agentClient && !agentClientHasScopes(actor.agentClient, requiredScopes)) {
    return {
      actor: null,
      status: 403,
      message: `当前 Agent Client 缺少权限：${requiredScopes.join(', ')}`,
    }
  }

  return { actor }
}

export async function getUsableSecondMeAccess(user: User) {
  if (!needsTokenRefresh(user)) {
    return {
      user,
      accessToken: user.accessToken,
      refreshed: false,
    }
  }

  if (!user.refreshToken) {
    return {
      user,
      accessToken: user.accessToken,
      refreshed: false,
    }
  }

  try {
    const refreshed = await refreshAccessToken(user.refreshToken)
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
      },
    })

    return {
      user: updatedUser,
      accessToken: updatedUser.accessToken,
      refreshed: true,
    }
  } catch (error) {
    console.error('刷新 SecondMe access token 失败:', error)
    return {
      user,
      accessToken: user.accessToken,
      refreshed: false,
    }
  }
}

export async function requireUsableSecondMeAccess(user: User) {
  const access = await getUsableSecondMeAccess(user)
  if (!access.user.tokenExpiresAt || access.user.tokenExpiresAt.getTime() <= Date.now()) {
    return null
  }
  return access
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
