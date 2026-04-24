'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Nav } from '@/app/components/Nav'

const CATEGORIES = ['数码', '服饰', '家居', '图书', '其他']
const CONDITIONS = ['全新', '几乎全新', '轻微使用痕迹', '明显使用痕迹']

export default function SellPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [condition, setCondition] = useState(CONDITIONS[0])
  const [imageUrls, setImageUrls] = useState('')
  const [aiPersonality, setAiPersonality] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // 闲鱼搬运状态
  const [xianyuUrl, setXianyuUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [existingProduct, setExistingProduct] = useState<{ id: string; title: string } | null>(null)

  const handleScrape = async () => {
    setScrapeError('')
    setExistingProduct(null)
    const url = xianyuUrl.trim()
    if (!url) {
      setScrapeError('请粘贴闲鱼链接')
      return
    }
    setIsScraping(true)
    try {
      const res = await fetch('/api/xianyu/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.code === 0 && data.data) {
        const item = data.data
        setTitle(item.title || '')
        setPrice(item.price ? String(item.price) : '')
        setDescription(item.description || '')
        if (item.condition && CONDITIONS.includes(item.condition)) {
          setCondition(item.condition)
        }
        if (item.images && Array.isArray(item.images)) {
          setImageUrls(item.images.join('\n'))
        }
      } else if (res.status === 409 && data.data) {
        setExistingProduct({ id: data.data.productId, title: data.data.title })
      } else {
        setScrapeError(data.message || '抓取失败，请手动填写')
      }
    } catch {
      setScrapeError('网络错误，请稍后重试')
    } finally {
      setIsScraping(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const p = parseFloat(price)
    const min = minPrice ? parseFloat(minPrice) : undefined
    if (!title.trim()) { setError('请填写标题'); return }
    if (!description.trim()) { setError('请填写描述'); return }
    if (isNaN(p) || p <= 0) { setError('请填写有效价格'); return }
    if (min !== undefined && (isNaN(min) || min < 0 || min > p)) {
      setError('最低接受价需在 0 与标价之间')
      return
    }
    const images = imageUrls.split(/[\n,，]/).map((s) => s.trim()).filter(Boolean)
    if (images.length === 0) {
      setError('请至少上传一张商品图片')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          price: p,
          category,
          condition,
          images,
          aiPersonality: aiPersonality.trim() || undefined,
          minPrice: min,
          xianyuUrl: xianyuUrl.trim() || undefined,
          source: xianyuUrl.trim() ? 'xianyu' : 'manual',
        }),
      })
      const data = await res.json()
      if (data.code === 0) setDone(true)
      else setError(data.message || '发布失败')
    } catch {
      setError('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">发布成功</h2>
          <p className="text-slate-600 mb-6">你的闲置已上架，等 AI 来砍价吧～</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
          >
            去市场看看
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-800 mb-6">发布闲置</h1>

          {/* 闲鱼搬运区 */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
            <label className="block text-sm font-medium text-amber-800 mb-2">
              从闲鱼搬运（可选）
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={xianyuUrl}
                onChange={(e) => setXianyuUrl(e.target.value)}
                disabled={isScraping}
                className="flex-1 border border-amber-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white disabled:opacity-60"
                placeholder="粘贴闲鱼商品链接，例如 https://www.goofish.com/item?id=xxx"
              />
              <button
                type="button"
                onClick={handleScrape}
                disabled={isScraping}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium py-2.5 px-5 rounded-xl transition-colors whitespace-nowrap"
              >
                {isScraping ? '搬运中…' : '搬运'}
              </button>
            </div>
            {scrapeError && (
              <p className="mt-2 text-sm text-red-600">{scrapeError}</p>
            )}
            {existingProduct && (
              <p className="mt-2 text-sm text-amber-700">
                该商品已存在于平台：
                <Link href={`/products/${existingProduct.id}`} className="underline font-medium">
                  {existingProduct.title}
                </Link>
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-red-600 text-sm bg-red-50 border border-red-100 py-2.5 px-4 rounded-xl">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="例如：九成新机械键盘"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">描述 *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 h-24 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="介绍一下商品情况"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">标价（元）*</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">最低接受价（元）</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="选填，AI 议价底线"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">成色</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">图片链接（每行一个或逗号分隔）</label>
              <textarea
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 h-20 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="https://..."
              />
              {/* 图片预览 */}
              {(() => {
                const urls = imageUrls.split(/[\n,，]/).map(s => s.trim()).filter(Boolean)
                if (urls.length === 0) return null
                return (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {urls.map((url, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex-shrink-0">
                        <img
                          src={url}
                          alt={`预览 ${i + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f1f5f9"/><text x="40" y="45" text-anchor="middle" fill="%2394a3b8" font-size="10">无法加载</text></svg>'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">AI 性格（选填）</label>
              <input
                type="text"
                value={aiPersonality}
                onChange={(e) => setAiPersonality(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="例如：好说话、可小刀"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {submitting ? '发布中…' : '发布'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
