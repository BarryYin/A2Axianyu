import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, getCurrentUser, hashAgentApiKey } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

const DEFAULT_SCOPES = [
  'products.read',
  'products.write',
  'offers.write',
  'deals.read',
  'deals.write',
  'negotiate.execute',
]

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * POST /api/agent/connect
 * 零阻力接入入口：
 * 1. 接受网站登录态，或 Authorization: Bearer <SecondMe access_token>
 * 2. 自动补建本地用户映射
 * 3. 一次性返回可复用的 Agent API Key
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请在 Authorization 头中传入有效的 SecondMe access_token，或先登录本站' },
      { status: 401, headers: CORS }
    )
  }

  const body = await request.json().catch(() => ({}))
  const name =
    typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim()
      : 'Connected Agent'
  const description = typeof body?.description === 'string' ? body.description.trim() : undefined
  const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined
  const agentUrl = typeof body?.agentUrl === 'string' ? body.agentUrl.trim() : undefined
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.filter((scope: unknown): scope is string => typeof scope === 'string' && scope.trim().length > 0)
    : DEFAULT_SCOPES

  const existing = await db.agentClient.findFirst({
    where: {
      ownerUserId: user.id,
      name,
      status: 'active',
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  if (existing) {
    await db.agentClient.update({
      where: { id: existing.id },
      data: { status: 'inactive' },
    })
  }

  const apiKey = createAgentApiKey()
  const agentClient = await db.agentClient.create({
    data: {
      name,
      description,
      websiteUrl,
      agentUrl,
      apiKeyHash: hashAgentApiKey(apiKey),
      scopes: JSON.stringify(scopes),
      ownerUserId: user.id,
      lastUsedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      agentUrl: true,
      status: true,
      scopes: true,
      createdAt: true,
    },
  })

  const { origin } = new URL(request.url)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin

  return NextResponse.json(
    {
      code: 0,
      data: {
        user: {
          id: user.id,
          secondmeUserId: user.secondmeUserId,
          nickname: user.nickname,
          avatar: user.avatar,
        },
        agentClient: {
          ...agentClient,
          scopes: JSON.parse(agentClient.scopes || '[]'),
          apiKey,
        },
        auth: {
          directBearer: 'Authorization: Bearer <SecondMe access_token>',
          reusableApiKey: `X-Agent-API-Key: ${apiKey}`,
        },
        discovery: {
          agentCardUrl: `${baseUrl}/.well-known/agent.json`,
          capabilitiesUrl: `${baseUrl}/api/agent/capabilities`,
        },
      },
      message: 'Agent 已绑定到当前人类身份，并签发可复用的 Agent API Key',
    },
    { status: 201, headers: CORS }
  )
}
