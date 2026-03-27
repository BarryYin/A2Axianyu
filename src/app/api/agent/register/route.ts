import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hashCredential } from '@/lib/auth'
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

function createAgentIdentityId() {
  return `agent_${randomBytes(6).toString('hex')}`
}

function createBindCode() {
  return randomBytes(3).toString('hex').toUpperCase()
}

function createRegistrationSecret() {
  return `regs_${randomBytes(24).toString('hex')}`
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name =
    typeof body?.name === 'string' && body.name.trim()
      ? body.name.trim()
      : 'External Agent'
  const description = typeof body?.description === 'string' ? body.description.trim() : undefined
  const websiteUrl = typeof body?.websiteUrl === 'string' ? body.websiteUrl.trim() : undefined
  const agentUrl = typeof body?.agentUrl === 'string' ? body.agentUrl.trim() : undefined
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.filter((scope: unknown): scope is string => typeof scope === 'string' && scope.trim().length > 0)
    : DEFAULT_SCOPES
  const registrationSecret = createRegistrationSecret()

  const registration = await db.agentRegistration.create({
    data: {
      agentIdentityId: createAgentIdentityId(),
      bindCode: createBindCode(),
      registrationSecretHash: hashCredential(registrationSecret),
      name,
      description,
      websiteUrl,
      agentUrl,
      scopes: JSON.stringify(scopes),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: {
      agentIdentityId: true,
      bindCode: true,
      name: true,
      status: true,
      expiresAt: true,
    },
  })

  const { origin } = new URL(request.url)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin
  const bindUrl = `${baseUrl}/agents?identityId=${encodeURIComponent(registration.agentIdentityId)}&bindCode=${encodeURIComponent(registration.bindCode)}`

  return NextResponse.json(
    {
      code: 0,
      data: {
        agentIdentityId: registration.agentIdentityId,
        bindCode: registration.bindCode,
        registrationSecret,
        name: registration.name,
        status: registration.status,
        expiresAt: registration.expiresAt,
        bindUrl,
        next: {
          humanStep: '请让人类登录网站后访问 bindUrl，或在 Agent 接入页手动输入 identityId 和 bindCode 完成绑定',
          pollUrl: `${baseUrl}/api/agent/register/${registration.agentIdentityId}`,
          pollHeader: `X-Agent-Registration-Secret: ${registrationSecret}`,
        },
      },
      message: 'Agent 注册成功。请让人类完成绑定，然后用 registrationSecret 轮询状态。',
    },
    { status: 201, headers: CORS }
  )
}
