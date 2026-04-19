import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PURCHASED', 'FAILED'],
  PURCHASED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  FAILED: ['REFUNDED'],
}

// PATCH /api/admin/orders/[id]/status - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status: newStatus, trackingNumber, courierCompany, adminNotes, failureReason } = body

    // Get current order
    const order = await db.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[order.status]
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Invalid transition: ${order.status} -> ${newStatus}` },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    }

    const now = new Date()
    if (newStatus === 'PURCHASED') {
      updateData.purchasedAt = now
      if (trackingNumber) updateData.trackingNumber = trackingNumber
      if (courierCompany) updateData.courierCompany = courierCompany
    }
    if (newStatus === 'SHIPPED') {
      updateData.shippedAt = now
      if (trackingNumber) updateData.trackingNumber = trackingNumber
    }
    if (newStatus === 'DELIVERED') updateData.deliveredAt = now
    if (newStatus === 'FAILED') {
      updateData.failedAt = now
      if (failureReason) updateData.failureReason = failureReason
    }
    if (newStatus === 'REFUNDED') updateData.refundedAt = now
    if (adminNotes) updateData.adminNotes = adminNotes

    const updated = await db.order.update({
      where: { id },
      data: updateData,
    })

    // Create notification based on status
    let notificationType: string | null = null
    let notificationMessage = ''

    if (newStatus === 'PURCHASED') {
      notificationType = 'PURCHASE_SUCCESS'
      notificationMessage = `订单已从闲鱼采购成功！快递单号：${trackingNumber || '待更新'}，物流公司：${courierCompany || '待更新'}`
    } else if (newStatus === 'FAILED') {
      notificationType = 'PURCHASE_FAILED'
      notificationMessage = `很抱歉，商品采购失败。原因：${failureReason || '未知'}。我们将为您处理退款。`
    } else if (newStatus === 'SHIPPED') {
      notificationType = 'SHIPPED'
      notificationMessage = `商品已发货！快递单号：${trackingNumber || order.trackingNumber || '待更新'}`
    } else if (newStatus === 'DELIVERED') {
      notificationType = 'DELIVERED'
      notificationMessage = '商品已送达，交易完成！'
    } else if (newStatus === 'REFUNDED') {
      notificationType = 'REFUND_COMPLETE'
      notificationMessage = '退款已完成，请查收。'
    }

    if (notificationType) {
      await db.notification.create({
        data: {
          orderId: id,
          type: notificationType as any,
          message: notificationMessage,
        },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update order status:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}
