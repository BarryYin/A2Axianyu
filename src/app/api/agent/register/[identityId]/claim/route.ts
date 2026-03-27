import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, hashAgentApiKey } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ identityId: string }> }
) {
  const { identityId } = await params
  const body = await request.json().catch(() => ({}))
  const bindCode = typeof body?.bindCode === 'string' ? body.bindCode.trim() : ''

  if (!bindCode) {
    return NextResponse.json(
      { code: 400, message: '缺少 bindCode' },
      { status: 400, headers: CORS }
    )
  }

  const registration = await db.agentRegistration.findFirst({
    where: {
      agentIdentityId: identityId,
      bindCode,
    },
  })

  if (!registration) {
    return NextResponse.json(
      { code: 404, message: '注册记录不存在' },
      { status: 404, headers: CORS }
    )
  }

  if (registration.expiresAt < new Date()) {
    return NextResponse.json(
      { code: 400, message: '注册记录已过期，请重新注册' },
      { status: 400, headers: CORS }
    )
  }

  if (!registration.ownerUserId || registration.status === 'pending') {
    return NextResponse.json(
      { code: 409, message: '人类尚未完成绑定' },
      { status: 409, headers: CORS }
    )
  }

  if (registration.status === 'claimed' && registration.claimedClientId) {
    return NextResponse.json(
      { code: 409, message: '该注册记录已经领取过 API Key，如需新 key 请重新注册' },
      { status: 409, headers: CORS }
    )
  }

  const apiKey = createAgentApiKey()

  const agentClient = await db.agentClient.create({
    data: {
      name: registration.name,
      description: registration.description,
      websiteUrl: registration.websiteUrl,
      agentUrl: registration.agentUrl,
      apiKeyHash: hashAgentApiKey(apiKey),
      scopes: registration.scopes,
      ownerUserId: registration.ownerUserId,
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

  await db.agentRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'claimed',
      claimedClientId: agentClient.id,
      claimedAt: new Date(),
    },
  })

  return NextResponse.json(
    {
      code: 0,
      data: {
        agentIdentityId: identityId,
        apiKey,
        agentClient: {
          ...agentClient,
          scopes: JSON.parse(agentClient.scopes || '[]'),
        },
      },
      message: '绑定已完成，API Key 领取成功',
    },
    { status: 201, headers: CORS }
  )
}
