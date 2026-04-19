import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/admin/orders/bulk-update - Batch status update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds, status: newStatus, failureReason } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'orderIds array is required' }, { status: 400 })
    }

    if (!['PURCHASED', 'FAILED'].includes(newStatus)) {
      return NextResponse.json({ error: 'Bulk update only supports PURCHASED or FAILED' }, { status: 400 })
    }

    const now = new Date()
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: now,
    }

    if (newStatus === 'PURCHASED') updateData.purchasedAt = now
    if (newStatus === 'FAILED') {
      updateData.failedAt = now
      if (failureReason) updateData.failureReason = failureReason
    }

    const result = await db.order.updateMany({
      where: { id: { in: orderIds }, status: 'PENDING' },
      data: updateData,
    })

    // Create notifications for each order
    for (const orderId of orderIds) {
      const notificationType = newStatus === 'PURCHASED' ? 'PURCHASE_SUCCESS' : 'PURCHASE_FAILED'
      const message = newStatus === 'PURCHASED'
        ? '订单已从闲鱼采购成功！'
        : `采购失败。原因：${failureReason || '批量处理'}`

      await db.notification.create({
        data: {
          orderId,
          type: notificationType as any,
          message,
        },
      })
    }

    return NextResponse.json({ updated: result.count })
  } catch (error) {
    console.error('Bulk update failed:', error)
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 })
  }
}
