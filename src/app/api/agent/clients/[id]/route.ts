import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json(
      { code: 401, message: '请先登录网站，或在 Authorization 头中传入有效的 SecondMe access_token' },
      { status: 401, headers: CORS }
    )
  }

  const { id } = await params

  const client = await db.agentClient.findUnique({
    where: { id },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
    },
  })

  if (!client) {
    return NextResponse.json(
      { code: 404, message: 'Agent Client 不存在' },
      { status: 404, headers: CORS }
    )
  }

  if (client.ownerUserId !== user.id) {
    return NextResponse.json(
      { code: 403, message: '无权操作该 Agent Client' },
      { status: 403, headers: CORS }
    )
  }

  if (client.status === 'inactive') {
    return NextResponse.json(
      { code: 0, data: { id: client.id, status: client.status }, message: 'Agent Client 已经是停用状态' },
      { headers: CORS }
    )
  }

  const updated = await db.agentClient.update({
    where: { id },
    data: { status: 'inactive' },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(
    { code: 0, data: updated, message: 'Agent Client 已停用' },
    { headers: CORS }
  )
}
