const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  数码: { bg: 'dbeafe', fg: '1d4ed8' },
  服饰: { bg: 'fce7f3', fg: 'be185d' },
  家居: { bg: 'd1fae5', fg: '047857' },
  图书: { bg: 'e0e7ff', fg: '4338ca' },
  其他: { bg: 'fef3c7', fg: 'b45309' },
}

/** 无图时按分类返回占位图 URL（用于列表/详情展示） */
export function getPlaceholderImageUrl(category: string, title?: string): string {
  const { bg, fg } = CATEGORY_COLORS[category] || CATEGORY_COLORS['其他']
  const text = title ? title.slice(0, 4) : category
  return `https://placehold.co/400x400/${bg}/${fg}?text=${encodeURIComponent(text)}`
}

/** 商品主图：有图用第一张，无图用占位 */
export function getProductImageUrl(images: string[] | unknown, category: string, title?: string): string {
  const arr = Array.isArray(images) ? images : []
  const first = arr[0]
  if (first && typeof first === 'string' && first.startsWith('http')) return first
  return getPlaceholderImageUrl(category, title)
}
