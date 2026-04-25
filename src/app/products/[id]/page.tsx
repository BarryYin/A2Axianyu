'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Nav } from '@/app/components/Nav'
import { getProductImageUrl } from '@/lib/placeholder'

interface Product {
  id: string
  title: string
  description: string
  price: number
  category: string
  condition: string
  images: string[]
  status: string
  aiPersonality: string | null
  minPrice: number | null
  seller: { id: string; nickname: string | null; avatar: string | null }
  _count: { offers: number }
}

interface Offer {
  id: string
  price: number
  message: string | null
  status: string
  buyer: { id: string; nickname: string | null; avatar: string | null }
  createdAt: string
}

export default function ProductPage() {
  const params = useParams()
  const id = params?.id as string
  const [product, setProduct] = useState<Product | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [aiSuggestPrice, setAiSuggestPrice] = useState<number | null>(null)
  const [aiReason, setAiReason] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [negotiateLoading, setNegotiateLoading] = useState(false)
  const [negotiateResult, setNegotiateResult] = useState<{
    outcome: string
    finalPrice?: number
    rounds?: number
    reason?: string
    logs?: { role: string; action: string; price?: number; reason?: string }[]
  } | null>(null)
  const [buyerTargetPrice, setBuyerTargetPrice] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch(`/api/products/${id}/offers`).then((r) => r.json())
    ]).then(([pRes, oRes]) => {
      if (pRes.code === 0) setProduct(pRes.data)
      if (oRes.code === 0) setOffers(oRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  const handleSubmitOffer = async (e: React.FormEvent, usePrice?: number) => {
    e.preventDefault()
    setError('')
    const p = usePrice ?? parseFloat(offerPrice)
    if (isNaN(p) || p < 0) {
      setError('请填写有效出价')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/products/${id}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ price: p, message: offerMessage || undefined })
      })
      const data = await res.json()
      if (data.code === 0) {
        setOffers((prev) => [data.data, ...prev])
        setOfferPrice('')
        setOfferMessage('')
        setAiSuggestPrice(null)
      } else {
        setError(data.message || '出价失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAiNegotiate = async () => {
    if (!id) return
    const targetPrice = parseFloat(buyerTargetPrice)
    if (isNaN(targetPrice) || targetPrice <= 0) {
      setError('请先输入您的期望价格')
      return
    }
    setNegotiateLoading(true)
    setError('')
    setNegotiateResult(null)
    try {
      const res = await fetch(`/api/products/${id}/negotiate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPrice }),
      })
      const data = await res.json()
      if (data.code === 0) {
        setNegotiateResult(data.data)
        const oRes = await fetch(`/api/products/${id}/offers`)
        const oData = await oRes.json()
        if (oData.code === 0) setOffers(oData.data)
      } else {
        setError(data.message || 'AI 谈价失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setNegotiateLoading(false)
    }
  }

  const handleAiBargain = async () => {
    if (!product) return
    setAiLoading(true)
    setError('')
    try {
      const res = await fetch('/api/secondme/act/bargain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productTitle: product.title,
          productPrice: product.price,
          minPrice: product.minPrice ?? undefined
        })
      })
      const data = await res.json()
      if (data.code === 0 && data.data?.suggestedPrice != null) {
        setAiSuggestPrice(data.data.suggestedPrice)
        setAiReason(data.data.reason ?? '')
        setOfferPrice(String(data.data.suggestedPrice))
      } else {
        setError(data.message || 'AI 砍价失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">{loading ? '加载中…' : '商品不存在'}</p>
      </div>
    )
  }

  const mainImageUrl = getProductImageUrl(product.images, product.category, product.title)

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="aspect-square bg-slate-100">
            <img src={mainImageUrl} alt={product.title} className="w-full h-full object-cover" />
          </div>
          <div className="p-5 sm:p-6">
            <h1 className="text-xl font-bold text-slate-800 mb-2">{product.title}</h1>
            <p className="text-2xl font-bold text-amber-600 mb-3">¥{product.price}</p>
            <div className="flex flex-wrap gap-2 text-sm text-slate-500 mb-3">
              <span className="bg-slate-100 px-2 py-0.5 rounded">{product.category}</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded">{product.condition}</span>
            </div>
            {product.aiPersonality && (
              <span className="inline-block text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded mb-3">
                AI · {product.aiPersonality}
              </span>
            )}
            <p className="text-slate-600 whitespace-pre-wrap">{product.description}</p>
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              {product.seller.avatar ? (
                <img src={product.seller.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-medium">
                  {product.seller.nickname?.slice(0, 1) ?? '?'}
                </span>
              )}
              <span>卖家 {product.seller.nickname ?? '未知'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-3">出价 / 砍价</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          {/* AI 谈价 - 买家输入期望价格 */}
          <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-sm text-slate-700 mb-3">
              💡 输入您的心理价位，AI 会帮您在不超过此价格的情况下与卖家协商
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={buyerTargetPrice}
                onChange={(e) => setBuyerTargetPrice(e.target.value)}
                className="flex-1 border border-amber-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="输入您的期望价格"
              />
              <button
                type="button"
                onClick={handleAiNegotiate}
                disabled={negotiateLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {negotiateLoading ? '协商中…' : 'AI 帮谈'}
              </button>
            </div>
            {negotiateLoading && (
              <p className="text-xs text-slate-500 mt-2">
                AI 正在与卖家协商，请稍候…
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={handleAiBargain}
              disabled={aiLoading}
              className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {aiLoading ? 'AI 思考中…' : '仅让 AI 建议出价'}
            </button>
          </div>
          {negotiateResult && (
            <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="font-medium text-slate-800 mb-2">
                {negotiateResult.outcome === 'pending_confirmation'
                  ? `🤝 AI 谈成 ¥${negotiateResult.finalPrice}，请去「我的主页」确认成交`
                  : negotiateResult.outcome === 'accepted'
                    ? `✅ 已成交 ¥${negotiateResult.finalPrice}`
                    : negotiateResult.outcome === 'rejected'
                      ? '❌ 未成交'
                      : negotiateResult.outcome === 'skipped'
                        ? `⏭ ${negotiateResult.reason ?? 'AI 暂不感兴趣'}`
                        : '⏸ 未在轮次内达成一致'}
              </p>
              {negotiateResult.logs && negotiateResult.logs.length > 0 && (
                <ul className="text-sm text-slate-600 space-y-1">
                  {negotiateResult.logs.map((log, i) => (
                    <li key={i}>
                      {log.role === 'buyer' ? '买家 AI' : '卖家 AI'}：{log.action}
                      {log.price != null && ` ¥${log.price}`}
                      {log.reason && ` — ${log.reason}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {aiSuggestPrice != null && (
            <div className="mb-4 p-3 bg-violet-50 rounded-xl text-sm border border-violet-100">
              <p className="text-violet-800 font-medium">建议出价：¥{aiSuggestPrice}</p>
              {aiReason && <p className="text-slate-600 mt-1">{aiReason}</p>}
            </div>
          )}
          <form onSubmit={(e) => handleSubmitOffer(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">我的出价（元）</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="输入金额"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">留言（选填）</label>
              <input
                type="text"
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                placeholder="和卖家说句话"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {submitting ? '提交中…' : '提交出价'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <h3 className="font-semibold text-slate-800 mb-3">出价记录（{offers.length}）</h3>
          {offers.length === 0 ? (
            <p className="text-slate-500 text-sm">暂无出价</p>
          ) : (
            <ul className="space-y-3">
              {offers.map((o) => (
                <li key={o.id} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-amber-600">¥{o.price}</span>
                    <span className="text-sm text-slate-500">{o.buyer.nickname ?? '未知'}</span>
                    {o.message && <span className="text-sm text-slate-400">— {o.message}</span>}
                  </div>
                  <span className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
