/**
 * 从网上搜索与商品相关的真实图片
 *
 * 策略（按优先级）：
 * 1. Pexels API（若配了 PEXELS_API_KEY）—— 最高画质
 * 2. Openverse API（WordPress 开源图库，免费无需 key）—— 真实实物图
 * 3. 中文关键词翻译后搜 Openverse —— 处理 AI 没给 imagePrompt 的情况
 */

// 中文分类 → 英文关键词映射，用于兜底搜索
const CATEGORY_EN: Record<string, string> = {
  数码: 'electronics gadget',
  服饰: 'clothing fashion',
  家居: 'home furniture',
  图书: 'book reading',
  其他: 'product item',
}

/** 用 Pexels API 搜索图片（需 PEXELS_API_KEY 环境变量） */
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

/**
 * 用 Openverse API 搜索图片（免费，无需 API key）
 * https://api.openverse.org/v1/images/?q=xxx
 */
async function searchOpenverse(query: string): Promise<string | null> {
  try {
    const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=5`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'A2A-Xianyu/1.0 (SecondMe marketplace)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // 优先选有 thumbnail 的，画质更稳定
    for (const item of data.results ?? []) {
      const thumb = item.thumbnail ?? item.url
      if (thumb && typeof thumb === 'string' && thumb.startsWith('http')) {
        return thumb
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 将中文商品标题转成可搜索的英文关键词
 * 简单策略：提取已有英文词 + 用分类映射补充
 */
function buildEnglishQuery(title: string, category?: string): string {
  // 提取标题中已有的英文/数字词
  const enWords = title
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => /^[a-zA-Z0-9]{2,}$/.test(w))

  // 加上分类英文关键词
  const catEn = CATEGORY_EN[category ?? ''] ?? 'product'

  if (enWords.length >= 2) {
    return enWords.slice(0, 4).join(' ')
  }

  // 中文标题常见关键词映射
  const zhMap: [RegExp, string][] = [
    [/键盘/, 'keyboard'],
    [/鼠标/, 'mouse'],
    [/耳机/, 'headphone'],
    [/手机/, 'phone smartphone'],
    [/笔记本|电脑/, 'laptop computer'],
    [/平板/, 'tablet iPad'],
    [/显示器|屏幕/, 'monitor display'],
    [/相机|摄影/, 'camera photography'],
    [/手表|手环/, 'watch smartwatch'],
    [/音箱|音响/, 'speaker audio'],
    [/书|小说/, 'book novel'],
    [/衣服|外套|T恤/, 'clothing jacket'],
    [/鞋/, 'shoes sneakers'],
    [/包|背包/, 'bag backpack'],
    [/椅子/, 'chair furniture'],
    [/灯/, 'lamp light'],
    [/杯子/, 'cup mug'],
    [/游戏|主机/, 'gaming console'],
  ]

  const matched: string[] = []
  for (const [re, en] of zhMap) {
    if (re.test(title)) matched.push(en)
  }

  if (matched.length > 0) {
    return matched.join(' ')
  }

  return `${catEn} used secondhand`
}

/**
 * 搜索商品图片 —— 主入口
 * @param imagePrompt AI 生成的英文图片描述（可选）
 * @param title       商品中文标题
 * @param category    商品分类（数码/服饰/家居/图书/其他）
 */
export async function searchProductImage(
  imagePrompt: string | undefined,
  title: string,
  category?: string
): Promise<string> {
  // 1. 优先 Pexels（高画质，需 key）
  if (imagePrompt) {
    const pexelsUrl = await searchPexels(imagePrompt)
    if (pexelsUrl) return pexelsUrl
  }

  // 2. Openverse（免费 + 英文 imagePrompt）
  if (imagePrompt) {
    const ovUrl = await searchOpenverse(imagePrompt)
    if (ovUrl) return ovUrl
  }

  // 3. Openverse（用标题翻译的英文关键词）
  const enQuery = buildEnglishQuery(title, category)
  const ovUrl2 = await searchOpenverse(enQuery)
  if (ovUrl2) return ovUrl2

  // 4. 终极兜底：placehold.co 文字占位
  return `https://placehold.co/400x400/f1f5f9/64748b?text=${encodeURIComponent(title.slice(0, 4))}`
}
