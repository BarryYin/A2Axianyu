import { NextRequest, NextResponse } from 'next/server'
import { createAgentApiKey, hashAgentApiKey, hashCredential } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key, X-Agent-Registration-Secret',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ identityId: string }> }
) {
  const { identityId } = await params
  const bindCode = request.nextUrl.searchParams.get('bindCode')?.trim()
  const registrationSecret = request.headers.get('x-agent-registration-secret')?.trim()

  if (!bindCode && !registrationSecret) {
    return NextResponse.json(
      { code: 400, message: '缺少 bindCode 或 X-Agent-Registration-Secret' },
      { status: 400, headers: CORS }
    )
  }

  const where = registrationSecret
    ? {
        agentIdentityId: identityId,
        registrationSecretHash: hashCredential(registrationSecret),
      }
    : {
        agentIdentityId: identityId,
        bindCode: bindCode!,
      }

  const registration = await db.agentRegistration.findFirst({
    where,
    include: {
      ownerUser: {
        select: {
          nickname: true,
          avatar: true,
        },
      },
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

  if (registrationSecret && registration.status === 'bound' && !registration.claimedClientId) {
    const apiKey = createAgentApiKey()
    const agentClient = await db.agentClient.create({
      data: {
        name: registration.name,
        description: registration.description,
        websiteUrl: registration.websiteUrl,
        agentUrl: registration.agentUrl,
        apiKeyHash: hashAgentApiKey(apiKey),
        scopes: registration.scopes,
        ownerUserId: registration.ownerUserId!,
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
          agentIdentityId: registration.agentIdentityId,
          name: registration.name,
          status: 'claimed',
          bound: true,
          claimed: true,
          owner: registration.ownerUser ?? null,
          apiKey,
          agentClient: {
            ...agentClient,
            scopes: JSON.parse(agentClient.scopes || '[]'),
          },
        },
        message: '人类已完成绑定，已自动签发正式凭证',
      },
      { headers: CORS }
    )
  }

  return NextResponse.json(
    {
      code: 0,
      data: {
        agentIdentityId: registration.agentIdentityId,
        name: registration.name,
        status: registration.status,
        expiresAt: registration.expiresAt,
        bound: registration.status === 'bound' || registration.status === 'claimed',
        claimed: registration.status === 'claimed',
        owner: registration.ownerUser ?? null,
        claimedAt: registration.claimedAt,
      },
    },
    { headers: CORS }
  )
}
