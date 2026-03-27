import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, getCurrentUser, hashAgentApiKey } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录网站，或在 Authorization 头中传入有效的 SecondMe access_token' },
      { status: 401, headers: CORS }
    )
  }

  const clients = await db.agentClient.findMany({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      agentUrl: true,
      status: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    {
      code: 0,
      data: clients.map((client) => ({
        ...client,
        scopes: JSON.parse(client.scopes || '[]'),
      })),
    },
    { headers: CORS }
  )
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录网站，或在 Authorization 头中传入有效的 SecondMe access_token' },
      { status: 401, headers: CORS }
    )
  }

  const body = await request.json()
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : undefined
  const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined
  const agentUrl = typeof body?.agentUrl === 'string' ? body.agentUrl.trim() : undefined
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.filter((scope: unknown): scope is string => typeof scope === 'string' && scope.trim().length > 0)
    : DEFAULT_SCOPES

  if (!name) {
    return NextResponse.json(
      { code: 400, message: '缺少必填字段：name' },
      { status: 400, headers: CORS }
    )
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

  return NextResponse.json(
    {
      code: 0,
      data: {
        ...agentClient,
        scopes: JSON.parse(agentClient.scopes || '[]'),
        apiKey,
      },
      message: 'Agent Client 创建成功。请保存好 apiKey，后续不会再次明文返回。',
    },
    { status: 201, headers: CORS }
  )
}
