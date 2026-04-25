import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUsableSecondMeAccess } from '@/lib/auth'
import { addNote } from '@/lib/secondme'

// GET /api/notifications?orderId=xxx - Get notifications for an order
// POST /api/notifications - Create notification and push to buyer
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

    // Push to buyer's SecondMe AI agent
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        include: { buyer: true, product: { select: { title: true } } },
      })
      if (order?.buyer?.accessToken) {
        const access = await requireUsableSecondMeAccess(order.buyer)
        if (access) {
          const noteContent = `[订单通知] ${order.product.title} — ${message}`
          await addNote(access.accessToken, noteContent)
        }
      }
    } catch (pushError) {
      console.error('Failed to push notification to buyer agent:', pushError)
    }

    return NextResponse.json(notification, { status: 201 })
  } catch (error) {
    console.error('Failed to create notification:', error)
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 })
  }
}
