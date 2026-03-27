import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录本站，再绑定外部 Agent' },
      { status: 401, headers: CORS }
    )
  }

  const body = await request.json().catch(() => ({}))
  const agentIdentityId = typeof body?.agentIdentityId === 'string' ? body.agentIdentityId.trim() : ''
  const bindCode = typeof body?.bindCode === 'string' ? body.bindCode.trim() : ''

  if (!agentIdentityId || !bindCode) {
    return NextResponse.json(
      { code: 400, message: '缺少 agentIdentityId 或 bindCode' },
      { status: 400, headers: CORS }
    )
  }

  const registration = await db.agentRegistration.findFirst({
    where: {
      agentIdentityId,
      bindCode,
    },
    select: {
      id: true,
      agentIdentityId: true,
      name: true,
      status: true,
      ownerUserId: true,
      expiresAt: true,
    },
  })

  if (!registration) {
    return NextResponse.json(
      { code: 404, message: '未找到对应的 Agent 注册记录' },
      { status: 404, headers: CORS }
    )
  }

  if (registration.expiresAt < new Date()) {
    return NextResponse.json(
      { code: 400, message: '该注册记录已过期，请让 Agent 重新注册' },
      { status: 400, headers: CORS }
    )
  }

  if (registration.ownerUserId && registration.ownerUserId !== user.id) {
    return NextResponse.json(
      { code: 409, message: '该 Agent 已绑定到其他用户' },
      { status: 409, headers: CORS }
    )
  }

  const updated = await db.agentRegistration.update({
    where: { id: registration.id },
    data: {
      ownerUserId: user.id,
      status: registration.status === 'claimed' ? 'claimed' : 'bound',
    },
    select: {
      agentIdentityId: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(
    {
      code: 0,
      data: updated,
      message: '外部 Agent 已绑定到当前账号。请让 Agent 继续轮询状态接口，系统会自动下发正式凭证。',
    },
    { headers: CORS }
  )
}
