import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { actSuggestProducts } from '@/lib/secondme'
import { searchProductImage } from '@/lib/image-search'

/**
 * AI 发布商品 — 两种模式：
 *
 * POST /api/ai/auto-publish
 *   body.action = "suggest"  → AI 根据用户输入建议商品详情（不入库）
 *   body.action = "publish"  → 用户确认后真正发布（入库 + 搜图下载）
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action || 'suggest'

  // ──── Step 1: AI 建议（不入库） ────
  if (action === 'suggest') {
    try {
      const userHint = body.hint || '' // 用户提供的简单信息："卖机械键盘，200 块"
      const suggestions = await actSuggestProducts(user.accessToken, userHint)

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return NextResponse.json({
          code: 0,
          data: { items: [], message: 'AI 暂时想不到可以出售的闲置，试试告诉 AI 你想卖什么？' },
        })
      }

      // 返回 AI 建议，但不入库，等用户确认
      const items = suggestions.slice(0, 3).map((item) => ({
        title: String(item.title || ''),
        description: String(item.description || ''),
        price: Number(item.price || 0),
        minPrice: item.minPrice != null ? Number(item.minPrice) : null,
        category: item.category || '其他',
        condition: item.condition || '轻微使用痕迹',
        imagePrompt: item.imagePrompt || '',
      }))

      return NextResponse.json({
        code: 0,
        data: { items, message: `AI 建议了 ${items.length} 件商品，请确认或修改后发布` },
      })
    } catch (err) {
      console.error('Auto-suggest error:', err)
      return NextResponse.json(
        { code: 500, message: err instanceof Error ? err.message : 'AI 建议失败' },
        { status: 500 }
      )
    }
  }

  // ──── Step 2: 用户确认发布（入库 + 搜图） ────
  if (action === 'publish') {
    try {
      const items: {
        title: string
        description: string
        price: number
        minPrice?: number | null
        category: string
        condition: string
        imagePrompt?: string
      }[] = body.items || []

      if (items.length === 0) {
        return NextResponse.json({ code: 400, message: '没有要发布的商品' }, { status: 400 })
      }

      const published = []
      for (const item of items.slice(0, 5)) {
        if (!item.title || !item.price) continue
        const category = item.category || '其他'
        const title = String(item.title)

        // 搜索图片并下载到本地
        const imageUrl = await searchProductImage(
          item.imagePrompt,
          title,
          category
        )
        const imagesStr = JSON.stringify([imageUrl])

        const product = await db.product.create({
          data: {
            title,
            description: String(item.description || ''),
            price: Number(item.price),
            minPrice: item.minPrice != null ? Number(item.minPrice) : undefined,
            category,
            condition: item.condition || '轻微使用痕迹',
            images: imagesStr,
            sellerId: user.id,
            aiPersonality: 'AI 辅助发布',
          },
        })
        published.push({ id: product.id, title: product.title, price: product.price })
      }

      return NextResponse.json({
        code: 0,
        data: {
          published,
          message: `成功发布 ${published.length} 件商品`,
        },
      })
    } catch (err) {
      console.error('Publish error:', err)
      return NextResponse.json(
        { code: 500, message: err instanceof Error ? err.message : '发布失败' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ code: 400, message: '未知 action' }, { status: 400 })
}
