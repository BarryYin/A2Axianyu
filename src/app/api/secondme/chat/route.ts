import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { chatWithAI } from '@/lib/secondme'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ code: 401, message: '未登录' }, { status: 401 })
    }

    const { message, sessionId, actionControl } = await request.json()

    if (!message) {
      return NextResponse.json(
        { code: 400, message: '消息内容不能为空' },
        { status: 400 }
      )
    }

    const response = await chatWithAI(user.accessToken, message, {
      sessionId,
      actionControl,
    })

    // 流式响应
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('聊天失败:', error)
    return NextResponse.json(
      { code: 500, message: '聊天失败' },
      { status: 500 }
    )
  }
}