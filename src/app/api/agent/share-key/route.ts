import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, getCurrentUser, hashAgentApiKey } from '@/lib/auth'
import { db } from '@/lib/db'

// GET: 只返回用户现有的 active API Key，不创建新的
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录' },
      { status: 401 }
    )
  }

  // 查找用户最新的 active API Key
  const existingClient = await db.agentClient.findFirst({
    where: {
      ownerUserId: user.id,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existingClient) {
    return NextResponse.json({
      code: 0,
      data: {
        clientId: existingClient.id,
        name: existingClient.name,
        hasKey: true,
      },
    })
  }

  // 没有现有 key
  return NextResponse.json({
    code: 0,
    data: {
      hasKey: false,
      message: '没有可用的 API Key，请先创建',
    },
  })
}

// POST: 创建新的 API Key
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录' },
      { status: 401 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const name = body.name || `分享用 ${new Date().toLocaleDateString()}`

  const apiKey = createAgentApiKey()
  const newClient = await db.agentClient.create({
    data: {
      name,
      apiKeyHash: hashAgentApiKey(apiKey),
      scopes: JSON.stringify(['products.read', 'products.write', 'offers.write']),
      ownerUserId: user.id,
    },
  })

  return NextResponse.json({
    code: 0,
    data: {
      apiKey,
      clientId: newClient.id,
      message: '已创建新的 API Key',
    },
  })
}
