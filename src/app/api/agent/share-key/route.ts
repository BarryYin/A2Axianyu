import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, getCurrentUser, hashAgentApiKey } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录' },
      { status: 401 }
    )
  }

  // 查找用户已有的 active API Key
  const existingClient = await db.agentClient.findFirst({
    where: {
      ownerUserId: user.id,
      status: 'active',
    },
    orderBy: { lastUsedAt: 'desc' },
  })

  if (existingClient) {
    // 如果有现有的，返回提示让用户去分享页面查看
    // 但为了简化，我们创建一个新的专门用于分享
    const apiKey = createAgentApiKey()
    const newClient = await db.agentClient.create({
      data: {
        name: `分享用 ${new Date().toLocaleDateString()}`,
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
        message: '已创建新的分享 API Key',
      },
    })
  }

  // 如果没有现有的，创建一个
  const apiKey = createAgentApiKey()
  const newClient = await db.agentClient.create({
    data: {
      name: 'AI Agent',
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
