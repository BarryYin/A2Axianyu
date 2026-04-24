import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { scrapeXianyuItem, validateXianyuUrl } from '@/lib/xianyu-scraper'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const rawUrl = body?.url

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { code: 400, message: '请提供闲鱼链接' },
        { status: 400 }
      )
    }

    // Validate URL format
    const validation = validateXianyuUrl(rawUrl.trim())
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json(
        { code: 400, message: '链接格式无效，请检查是否为标准闲鱼商品链接' },
        { status: 400 }
      )
    }

    const normalizedUrl = validation.normalized

    // Check duplicate
    const existing = await db.product.findFirst({
      where: {
        xianyuUrl: normalizedUrl,
        status: { not: 'deleted' },
      },
      select: { id: true, title: true },
    })

    if (existing) {
      return NextResponse.json(
        {
          code: 409,
          message: '该商品已存在于平台',
          data: { productId: existing.id, title: existing.title },
        },
        { status: 409 }
      )
    }

    // Scrape
    const result = await scrapeXianyuItem(normalizedUrl)

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        FETCH_TIMEOUT: 504,
        FETCH_FAILED: 503,
        PARSE_FAILED: 422,
        NOT_PRODUCT_PAGE: 422,
      }
      return NextResponse.json(
        { code: statusMap[result.error] || 500, message: result.message },
        { status: statusMap[result.error] || 500 }
      )
    }

    return NextResponse.json({
      code: 0,
      data: result.data,
    })
  } catch (error) {
    console.error('闲鱼抓取失败:', error)
    return NextResponse.json(
      { code: 500, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
