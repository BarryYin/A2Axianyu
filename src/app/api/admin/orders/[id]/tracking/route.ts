import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/admin/orders/[id]/tracking - Update tracking information
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { trackingNumber, courierCompany } = body

    if (!trackingNumber) {
      return NextResponse.json({ error: 'Tracking number is required' }, { status: 400 })
    }

    const order = await db.order.update({
      where: { id },
      data: {
        trackingNumber,
        courierCompany: courierCompany || null,
      },
    })

    // Create shipping notification
    await db.notification.create({
      data: {
        orderId: id,
        type: 'SHIPPED',
        message: `快递信息已更新。快递单号：${trackingNumber}，物流公司：${courierCompany || '未知'}`,
      },
    })

    return NextResponse.json(order)
  } catch (error) {
    console.error('Failed to update tracking:', error)
    return NextResponse.json({ error: 'Failed to update tracking' }, { status: 500 })
  }
}
