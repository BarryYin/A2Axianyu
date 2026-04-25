/**
 * 从网上搜索商品图片并下载到本地 public/product-images/
 * 返回本地可直接引用的路径 /product-images/xxx.jpg
 *
 * 搜索策略：
 * 1. Pexels API（若配了 PEXELS_API_KEY）
 * 2. Openverse API（免费无需 key）
 * 3. 中文关键词翻译后搜 Openverse
 */

import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'

// 本地存储目录（相对于项目根）
const IMAGE_DIR = path.join(process.cwd(), 'public', 'product-images')

// 中文分类 → 英文关键词
const CATEGORY_EN: Record<string, string> = {
  数码: 'electronics gadget device',
  服饰: 'clothing fashion apparel',
  家居: 'home furniture decor',
  图书: 'book novel reading',
  其他: 'product item secondhand',
}

/** 生成文件名 hash */
function makeFilename(seed: string, ext: string = 'jpg'): string {
  const hash = crypto.createHash('md5').update(seed).digest('hex').slice(0, 12)
  return `${hash}.${ext}`
}

/** 下载图片到本地，返回本地路径；失败返回 null */
async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    // 确保目录存在
    if (!existsSync(IMAGE_DIR)) {
      await mkdir(IMAGE_DIR, { recursive: true })
    }

    const localPath = path.join(IMAGE_DIR, filename)

    // 已经下载过就直接返回
    if (existsSync(localPath)) {
      return `/product-images/${filename}`
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'A2A-Xianyu/1.0' },
      redirect: 'follow',
    })

    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('image')) return null

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length < 1000) return null // 太小，可能是错误页面

    await writeFile(localPath, buffer)
    console.log(`[image-search] Downloaded: ${url} → ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`)
    return `/product-images/${filename}`
  } catch (err) {
    console.error(`[image-search] Download failed: ${url}`, err)
    return null
  }
}

/** Unsplash API 搜索（需 UNSPLASH_CLIENT_ID，免费注册：unsplash.com/developers，50次/小时） */
async function searchUnsplash(query: string): Promise<string | null> {
  const clientId = process.env.UNSPLASH_CLIENT_ID
  if (!clientId) return null // 未配置则跳过
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=squarish`
    const res = await fetch(url, {
      headers: {
        'Accept-Version': 'v1',
        'Authorization': `Client-ID ${clientId}`,
        'User-Agent': 'A2A-Xianyu/1.0',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const item of data.results ?? []) {
      const imgUrl = item.urls?.small ?? item.urls?.regular
      if (imgUrl && typeof imgUrl === 'string') return imgUrl
    }
    return null
  } catch {
    return null
  }
}

/** Pexels API 搜索（需 PEXELS_API_KEY） */
async function searchPexels(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=square`,
      { headers: { Authorization: key }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.photos?.[0]?.src?.medium ?? null
  } catch {
    return null
  }
}

/** Openverse API 搜索（免费） */
async function searchOpenverse(query: string): Promise<string | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=5`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'A2A-Xianyu/1.0 (SecondMe marketplace)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    for (const item of data.results ?? []) {
      // 优先选原图 URL（thumbnail 可能有限制）
      const imgUrl = item.url ?? item.thumbnail
      if (imgUrl && typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
        return imgUrl
      }
    }
    return null
  } catch {
    return null
  }
}

/** 中文商品标题 → 英文搜索关键词 */
function buildEnglishQuery(title: string, category?: string): string {
  const enWords = title
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]{2,}$/.test(w))

  if (enWords.length >= 2) {
    return enWords.slice(0, 4).join(' ')
  }

  const zhMap: [RegExp, string][] = [
    [/键盘/, 'mechanical keyboard'],
    [/鼠标/, 'computer mouse'],
    [/耳机/, 'headphones'],
    [/手机/, 'smartphone'],
    [/笔记本|电脑/, 'laptop computer'],
    [/平板/, 'tablet iPad'],
    [/显示器|屏幕/, 'monitor display'],
    [/相机|摄影/, 'camera'],
    [/手表|手环/, 'smartwatch'],
    [/音箱|音响/, 'bluetooth speaker'],
    [/书|小说/, 'book'],
    [/衣服|外套|T恤/, 'clothing'],
    [/鞋/, 'shoes sneakers'],
    [/包|背包/, 'backpack bag'],
    [/椅子/, 'office chair'],
    [/灯/, 'desk lamp'],
    [/杯子/, 'coffee mug'],
    [/游戏|主机/, 'gaming console'],
  ]

  const matched: string[] = []
  for (const [re, en] of zhMap) {
    if (re.test(title)) matched.push(en)
  }

  if (matched.length > 0) return matched.join(' ')

  const catEn = CATEGORY_EN[category ?? ''] ?? 'product'
  return `${catEn} used secondhand`
}

/**
 * 搜索商品图片并下载到本地
 * 返回本地路径 /product-images/xxx.jpg
 */

/** Amazon 搜图 — 白底商品照，质量高，无需 key */
async function searchAmazonImages(title: string, category?: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(title)
    const url = `https://www.amazon.com/s?k=${query}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const html = await res.text()
    if (html.length < 10000) return null

    // 提取 Amazon 商品图 URL（media-amazon.com/images/I/xxx）
    const imgRegex = /https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s]+\.(?:jpg|png)/g
    const matches = html.match(imgRegex)
    if (!matches || matches.length === 0) return null

    // 过滤掉太小的图（图标等），选商品图（包含 _AC_ 等标记）
    const productImgs = matches.filter(img =>
      /_(?:AC|SX|SY|UL|SL)/.test(img)
    )

    if (productImgs.length === 0) {
      // 退一步：选所有匹配的第一张
      return matches[0]
    }

    // 选清晰度最高的：替换 _QL65_ → 高清
    let best = productImgs[0]
    best = best.replace(/_QL\d+_/, '_SL1500_')
    best = best.replace(/_AC_U[YS]\d+/, '_AC_SL1500_')
    best = best.replace(/_SX\d+/, '_SX1500_')

    return best
  } catch {
    return null
  }
}

/** 闲鱼搜图（仅在部署到国内服务器时有效，本地会跳过） */
async function searchXianyuImages(title: string, category?: string): Promise<string | null> {
  // 仅在服务器环境尝试（本地 sandbox IP 被闲鱼封）
  // 设置环境变量 XIANYU_SEARCH_ENABLED=true 启用
  if (process.env.XIANYU_SEARCH_ENABLED !== 'true') return null

  try {
    const query = category ? `${title} ${category}` : title
    const searchUrl = `https://www.goofish.com/search?q=${encodeURIComponent(query)}`
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    })
    const html = await res.text()
    if (!res.ok || html.includes('非法访问')) return null
    const idMatch = html.match(/\/item\?id=(\d+)/)
    if (!idMatch) return null

    // 爬第一个商品详情页取图
    const itemUrl = `https://www.goofish.com/item?id=${idMatch[1]}`
    const itemRes = await fetch(itemUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!itemRes.ok) return null

    const itemHtml = await itemRes.text()
    const stateMatch = itemHtml.match(/__INITIAL_STATE__\s*=\s*({.+?});/)
    if (!stateMatch) return null

    try {
      const data = JSON.parse(stateMatch[1])
      const pics = data?.item?.itemData?.images || data?.itemData?.images || data?.images || []
      if (Array.isArray(pics) && pics.length > 0) {
        return typeof pics[0] === 'string' ? pics[0] : pics[0]?.url || pics[0]?.imgUrl
      }
    } catch { return null }

    return null
  } catch {
    return null
  }
}

export async function searchProductImage(
  imagePrompt: string | undefined,
  title: string,
  category?: string
): Promise<string> {
  const filename = makeFilename(title)

  // 已经下载过
  const localPath = path.join(IMAGE_DIR, filename)
  if (existsSync(localPath)) {
    return `/product-images/${filename}`
  }

  // 0. Amazon 搜图（白底商品照，全网最稳）
  const amazonUrl = await searchAmazonImages(title, category)
  if (amazonUrl) {
    const local = await downloadImage(amazonUrl, filename)
    if (local) return local
  }

  // 1. 闲鱼搜图（仅服务器环境）
  const xianyuUrl = await searchXianyuImages(title, category)
  if (xianyuUrl) {
    const local = await downloadImage(xianyuUrl, filename)
    if (local) return local
  }

  // 2. Pexels
  if (imagePrompt) {
const pexelsUrl = await searchPexels(`${imagePrompt} product photo`)
    if (pexelsUrl) {
      const local = await downloadImage(pexelsUrl, filename)
      if (local) return local
    }
  }

  // 3. Unsplash + imagePrompt（质量更好，免费）
  if (imagePrompt) {
    const unsplashUrl = await searchUnsplash(`${imagePrompt} product photo`)
    if (unsplashUrl) {
      const local = await downloadImage(unsplashUrl, filename)
      if (local) return local
    }
  }

  // 4. Openverse + imagePrompt
  if (imagePrompt) {
    const ovUrl = await searchOpenverse(`${imagePrompt} product photo`)
    if (ovUrl) {
      const local = await downloadImage(ovUrl, filename)
      if (local) return local
    }
  }

  // 5. Openverse + 中文标题翻译
  const enQuery = buildEnglishQuery(title, category)
  const ovUrl2 = await searchOpenverse(`${enQuery} product photo`)
  if (ovUrl2) {
    const local = await downloadImage(ovUrl2, filename)
    if (local) return local
  }

  // 6. 兜底占位
  return `https://placehold.co/400x400/f1f5f9/64748b?text=${encodeURIComponent(title.slice(0, 4))}`
}
