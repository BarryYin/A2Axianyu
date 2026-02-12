import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { searchProductImage } from '@/lib/image-search'

/**
 * POST /api/admin/refresh-images
 * 扫描所有商品：
 *  - 占位图 → 搜索真实图片并下载到本地
 *  - 外部链接 → 也下载到本地
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

      const first = imgs[0] || ''

      // 已经是本地路径，跳过
      if (first.startsWith('/product-images/')) continue

      // 搜索 + 下载到本地
      const localUrl = await searchProductImage(undefined, p.title, p.category)

      // 跳过仍然是外部占位图的结果
      if (!localUrl.startsWith('/product-images/')) continue

      await db.product.update({
        where: { id: p.id },
        data: { images: JSON.stringify([localUrl]) },
      })
      updated++

      // 避免限流
      await new Promise((r) => setTimeout(r, 600))
    }

    return NextResponse.json({
      code: 0,
      data: { total: products.length, updated, message: `已更新 ${updated} 件商品图片（下载到本地）` },
    })
  } catch (err) {
    console.error('Refresh images error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : '刷新图片失败' },
      { status: 500 }
    )
  }
}
