import * as cheerio from 'cheerio'

// ===== Types =====
export interface XianyuItem {
  title: string
  price: number
  description: string
  images: string[]
  condition?: '全新' | '几乎全新' | '轻微使用痕迹' | '明显使用痕迹'
}

export type ScrapeResult =
  | { ok: true; data: XianyuItem }
  | { ok: false; error: ScrapeErrorCode; message: string }

export type ScrapeErrorCode =
  | 'FETCH_TIMEOUT'
  | 'FETCH_FAILED'
  | 'PARSE_FAILED'
  | 'NOT_PRODUCT_PAGE'

// ===== Link Validation =====
const ALLOWED_HOSTS = ['www.goofish.com', 'm.goofish.com', 'goofish.com']

export function validateXianyuUrl(url: string): { valid: boolean; normalized?: string } {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!ALLOWED_HOSTS.includes(host)) {
      return { valid: false }
    }
    // Must be /item?id=xxx
    if (!parsed.pathname.startsWith('/item')) {
      return { valid: false }
    }
    const itemId = parsed.searchParams.get('id')
    if (!itemId || !itemId.trim()) {
      return { valid: false }
    }
    // Normalize to www.goofish.com
    const normalized = `https://www.goofish.com/item?id=${itemId}`
    return { valid: true, normalized }
  } catch {
    return { valid: false }
  }
}

// ===== Scraper =====
const FETCH_TIMEOUT_MS = 30000

export async function scrapeXianyuItem(url: string): Promise<ScrapeResult> {
  let html: string
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return {
        ok: false,
        error: 'FETCH_FAILED',
        message: `无法获取商品页面 (HTTP ${response.status})`,
      }
    }
    html = await response.text()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        ok: false,
        error: 'FETCH_TIMEOUT',
        message: '抓取超时，请稍后重试',
      }
    }
    return {
      ok: false,
      error: 'FETCH_FAILED',
      message: '无法获取商品信息，请检查链接有效性或手动填写',
    }
  }

  try {
    const item = parseXianyuHtml(html, url)
    if (!item) {
      return {
        ok: false,
        error: 'PARSE_FAILED',
        message: '无法识别商品信息，请手动填写',
      }
    }
    return { ok: true, data: item }
  } catch {
    return {
      ok: false,
      error: 'PARSE_FAILED',
      message: '无法识别商品信息，请手动填写',
    }
  }
}

function parseXianyuHtml(html: string, url: string): XianyuItem | null {
  const $ = cheerio.load(html)

  // Strategy 1: Try to extract from initial state JSON embedded in script tags
  let title = ''
  let price = 0
  let description = ''
  let images: string[] = []
  let condition: XianyuItem['condition'] | undefined

  // Look for initial data in script tags
  $('script').each((_, el) => {
    const text = $(el).text()
    if (text.includes('window._INITIAL_STATE__') || text.includes('itemData')) {
      try {
        const match = text.match(/window\._INITIAL_STATE__\s*=\s*({.+?});/)
          || text.match(/itemData\s*:\s*({.+?})/)
        if (match) {
          const data = JSON.parse(match[1])
          const item = data?.item?.itemData || data?.itemData || data
          if (item) {
            if (item.title && !title) title = String(item.title).trim()
            if (item.price && !price) price = parseFloat(item.price)
            if (item.desc && !description) description = String(item.desc).trim()
            if (item.images && Array.isArray(item.images) && images.length === 0) {
              images = item.images.map((img: string | { url?: string }) =>
                typeof img === 'string' ? img : img.url
              ).filter(Boolean)
            }
            if (item.itemPictureList && Array.isArray(item.itemPictureList) && images.length === 0) {
              images = item.itemPictureList.map((p: any) => p.imgUrl || p.url || p).filter(Boolean)
            }
            if (item.desc && !description) description = String(item.desc).trim()
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    }
  })

  // Strategy 2: Meta tags and Open Graph
  if (!title) {
    title = $('meta[property="og:title"]').attr('content') || ''
  }
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content')
    if (ogImage) images = [ogImage]
  }

  // Strategy 3: DOM selectors for goofish.com
  if (!title) {
    title = $('h1').first().text().trim()
      || $('[class*="title"]').first().text().trim()
      || $('.item-title').first().text().trim()
      || $('title').text().replace('-闲鱼', '').replace('-闲鱼·淘宝二手', '').trim()
  }

  if (price === 0) {
    const priceText = $('[class*="price"]').first().text()
      || $('.item-price').first().text()
      || $('.price').first().text()
    if (priceText) {
      const match = priceText.match(/[¥\s]*(\d[\d,\.]*)/)
      if (match) {
        price = parseFloat(match[1].replace(/,/g, ''))
      }
    }
  }

  if (!description) {
    description = $('[class*="desc"]').first().text().trim()
      || $('.item-desc').first().text().trim()
      || $('[class*="detail"]').first().text().trim()
  }

  if (images.length === 0) {
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src')
      if (src && (src.includes('alicdn.com') || src.includes('goofish') || src.startsWith('http'))) {
        images.push(src)
      }
    })
  }

  // Deduplicate images
  images = [...new Set(images)]

  // Extract condition from description or page text
  const pageText = $('body').text()
  condition = inferCondition(pageText)

  // Validate minimal required fields
  if (!title || price <= 0) {
    return null
  }

  return {
    title,
    price,
    description: description || title,
    images: images.slice(0, 10), // limit to 10 images
    condition,
  }
}

function inferCondition(text: string): XianyuItem['condition'] | undefined {
  const t = text.toLowerCase()
  if (t.includes('全新')) return '全新'
  if (t.includes('几乎全新') || t.includes('99新')) return '几乎全新'
  if (t.includes('轻微使用') || t.includes('轻微') || t.includes('95新') || t.includes('9成新')) return '轻微使用痕迹'
  if (t.includes('明显使用') || t.includes('明显') || t.includes('8成新') || t.includes('旧')) return '明显使用痕迹'
  return undefined
}
