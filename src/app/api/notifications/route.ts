import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/notifications?orderId=xxx - Get notifications for an order
// POST /api/notifications/send - Send notification to buyer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const notifications = await db.notification.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ notifications })
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, type, message } = body

    if (!orderId || !type || !message) {
      return NextResponse.json({ error: 'orderId, type, and message are required' }, { status: 400 })
    }

    const notification = await db.notification.create({
      data: {
        orderId,
        type,
        message,
      },
    })

    // TODO: Integrate with SecondMe API to push to buyer's AI agent
    // await sendSecondMeNotification(order.buyerId, message)

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error('Failed to create notification:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}
