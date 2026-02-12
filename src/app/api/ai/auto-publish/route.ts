import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { actSuggestProducts } from '@/lib/secondme'
import { searchProductImage } from '@/lib/image-search'

/**
 * AI 根据用户画像自动建议并发布商品
 * POST /api/ai/auto-publish
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ code: 401, message: '请先登录' }, { status: 401 })
  }

  try {
    const suggestions = await actSuggestProducts(user.accessToken)

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json({
        code: 0,
        data: { published: [], message: 'AI 暂时想不到可以出售的闲置' },
      })
    }

    const published = []
    for (const item of suggestions.slice(0, 3)) {
      if (!item.title || !item.price) continue
      const category = item.category || '其他'
      const title = String(item.title)
      // 从网上搜一张与商品相关的真实图片
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
          aiPersonality: 'AI 自动发布',
        },
      })
      published.push(product)
    }

    return NextResponse.json({
      code: 0,
      data: {
        published: published.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
        })),
        message: `AI 帮你发布了 ${published.length} 件商品`,
      },
    })
  } catch (err) {
    console.error('Auto-publish error:', err)
    return NextResponse.json(
      { code: 500, message: err instanceof Error ? err.message : 'AI 自动发布失败' },
      { status: 500 }
    )
  }
}
