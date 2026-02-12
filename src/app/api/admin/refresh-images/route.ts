import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchProductImage } from '@/lib/image-search'

/**
 * POST /api/admin/refresh-images
 * 扫描所有商品，将占位图（placehold.co）替换为真实网络图片
 */
export async function POST() {
  try {
    const products = await db.product.findMany({
      where: { status: 'active' },
      select: { id: true, title: true, category: true, images: true },
    })

    let updated = 0

    for (const p of products) {
      const imgs: string[] = typeof p.images === 'string'
        ? JSON.parse(p.images || '[]')
        : []

      // 只刷新还是占位图的商品
      const needsRefresh =
        imgs.length === 0 ||
        imgs.every((u) => u.includes('placehold.co') || u.includes('loremflickr'))

      if (!needsRefresh) continue

      const newUrl = await searchProductImage(undefined, p.title, p.category)

      // 跳过仍然是占位图的结果
      if (newUrl.includes('placehold.co')) continue

      await db.product.update({
        where: { id: p.id },
        data: { images: JSON.stringify([newUrl]) },
      })
      updated++

      // 每张图之间稍等一下，避免触发限流
      await new Promise((r) => setTimeout(r, 500))
    }

    return NextResponse.json({
      code: 0,
      data: { total: products.length, updated, message: `已更新 ${updated} 件商品的图片` },
    })
  } catch (err) {
    console.error('Refresh images error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : '刷新图片失败' },
      { status: 500 }
    )
  }
}
