'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Nav } from '@/app/components/Nav'
import { getProductImageUrl } from '@/lib/placeholder'

interface PendingDeal {
  id: string
  price: number
  message: string | null
  role: 'buyer' | 'seller'
  product: { id: string; title: string; listPrice: number; image: string | null }
  counterpart: string
  createdAt: string
}

interface Product {
  id: string
  title: string
  price: number
  status: string
  category?: string
  images: string[]
  _count: { offers: number }
  createdAt: string
}

interface AutoPublishResult {
  published: { id: string; title: string; price: number }[]
  message: string
}

interface AutoBrowseResult {
  results: {
    productId: string
    productTitle: string
    outcome: string
    finalPrice?: number
    offerId?: string
    reason?: string
    logs: { role: string; action: string; price?: number; reason?: string }[]
  }[]
  message?: string
}

export default function DashboardPage() {
  const [pendingDeals, setPendingDeals] = useState<PendingDeal[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'selling' | 'ai'>('pending')

  // AI 状态
  const [autoPublishing, setAutoPublishing] = useState(false)
  const [autoPublishResult, setAutoPublishResult] = useState<AutoPublishResult | null>(null)
  const [autoBrowsing, setAutoBrowsing] = useState(false)
  const [autoBrowseResult, setAutoBrowseResult] = useState<AutoBrowseResult | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [refreshingImages, setRefreshingImages] = useState(false)
  const [refreshImageMsg, setRefreshImageMsg] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [pendingRes, prodRes] = await Promise.all([
        fetch('/api/me/pending-deals', { credentials: 'include' }),
        fetch('/api/me/products', { credentials: 'include' }),
      ])
      if (pendingRes.status === 401 || prodRes.status === 401) {
        window.location.href = '/'
        return
      }
      const [pendingData, prodData] = await Promise.all([pendingRes.json(), prodRes.json()])
      if (pendingData.code === 0) setPendingDeals(pendingData.data)
      if (prodData.code === 0) setProducts(prodData.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleConfirm = async (offerId: string) => {
    setConfirmingId(offerId)
    try {
      const res = await fetch(`/api/offers/${offerId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.code === 0) {
        setPendingDeals((prev) => prev.filter((d) => d.id !== offerId))
      } else {
        alert(data.message || '确认失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleReject = async (offerId: string) => {
    setConfirmingId(offerId)
    try {
      const res = await fetch(`/api/offers/${offerId}/reject`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.code === 0) {
        setPendingDeals((prev) => prev.filter((d) => d.id !== offerId))
      } else {
        alert(data.message || '拒绝失败')
      }
    } catch {
      alert('网络错误')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleAutoPublish = async () => {
    setAutoPublishing(true)
    setAutoPublishResult(null)
    try {
      const res = await fetch('/api/ai/auto-publish', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.code === 0) {
        setAutoPublishResult(data.data)
        // 刷新商品列表
        const pRes = await fetch('/api/me/products', { credentials: 'include' })
        const pData = await pRes.json()
        if (pData.code === 0) setProducts(pData.data)
      } else {
        setAutoPublishResult({ published: [], message: data.message || '失败' })
      }
    } catch {
      setAutoPublishResult({ published: [], message: '网络错误' })
    } finally {
      setAutoPublishing(false)
    }
  }

  const handleRefreshImages = async () => {
    setRefreshingImages(true)
    setRefreshImageMsg('')
    try {
      const res = await fetch('/api/admin/refresh-images', { method: 'POST' })
      const data = await res.json()
      if (data.code === 0) {
        setRefreshImageMsg(data.data.message)
        // 刷新商品列表
        const pRes = await fetch('/api/me/products', { credentials: 'include' })
        const pData = await pRes.json()
        if (pData.code === 0) setProducts(pData.data)
      } else {
        setRefreshImageMsg(data.message || '刷新失败')
      }
    } catch {
      setRefreshImageMsg('网络错误')
    } finally {
      setRefreshingImages(false)
    }
  }

  const handleAutoBrowse = async () => {
    setAutoBrowsing(true)
    setAutoBrowseResult(null)
    try {
      const res = await fetch('/api/ai/auto-browse', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.code === 0) {
        setAutoBrowseResult(data.data)
        // 刷新待确认
        const pdRes = await fetch('/api/me/pending-deals', { credentials: 'include' })
        const pdData = await pdRes.json()
        if (pdData.code === 0) setPendingDeals(pdData.data)
      } else {
        setAutoBrowseResult({ results: [], message: data.message || '失败' })
      }
    } catch {
      setAutoBrowseResult({ results: [], message: '网络错误' })
    } finally {
      setAutoBrowsing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">我的主页</h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${tab === 'pending'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            待确认（{pendingDeals.length}）
          </button>
          <button
            type="button"
            onClick={() => setTab('selling')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${tab === 'selling'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            我的商品（{products.length}）
          </button>
          <button
            type="button"
            onClick={() => setTab('ai')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${tab === 'ai'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-50'
            }`}
          >
            AI 操作
          </button>
        </div>

        {tab === 'pending' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {pendingDeals.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <div className="text-5xl mb-4">🤝</div>
                <p className="font-medium text-slate-700 mb-1">暂无待确认的交易</p>
                <p className="text-sm text-slate-400">AI 谈好价格后会出现在这里，由你最终拍板</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingDeals.map((deal) => (
                  <li key={deal.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {deal.product.image ? (
                          <img src={deal.product.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${deal.product.id}`} className="font-medium text-slate-800 hover:text-amber-600 line-clamp-1">
                          {deal.product.title}
                        </Link>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {deal.role === 'buyer' ? '你要买' : '你在卖'} · 对方 {deal.counterpart}
                        </p>
                        <div className="flex items-baseline gap-3 mt-1">
                          <span className="text-amber-600 font-bold text-lg">¥{deal.price}</span>
                          <span className="text-sm text-slate-400 line-through">¥{deal.product.listPrice}</span>
                        </div>
                        {deal.message && <p className="text-sm text-slate-500 mt-1">{deal.message}</p>}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirm(deal.id)}
                          disabled={confirmingId === deal.id}
                          className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-60 transition-colors"
                        >
                          确认成交
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(deal.id)}
                          disabled={confirmingId === deal.id}
                          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl disabled:opacity-60 transition-colors"
                        >
                          不要了
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'selling' && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {products.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <p className="font-medium text-slate-700 mb-1">还没有商品</p>
                <p className="text-sm text-slate-400">到「AI 操作」让 AI 帮你发布</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {products.map((p) => {
                  const imgUrl = getProductImageUrl(p.images, p.category || '其他', p.title)
                  return (
                    <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-slate-50/80">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${p.id}`} className="font-medium text-slate-800 hover:text-amber-600 line-clamp-1">
                          {p.title}
                        </Link>
                        <p className="text-sm text-slate-500">
                          ¥{p.price} · {p._count.offers} 个出价
                          {p.status === 'sold' && <span className="ml-2 text-emerald-600 font-medium">已售出</span>}
                        </p>
                      </div>
                      <Link href={`/products/${p.id}`} className="text-sm text-amber-600 font-medium hover:underline">
                        查看
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {tab === 'ai' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-2">AI 自动发布商品</h3>
              <p className="text-sm text-slate-500 mb-4">
                根据你的画像和记忆，AI 自动决定要卖什么并上架（含展示图）
              </p>
              <button
                type="button"
                onClick={handleAutoPublish}
                disabled={autoPublishing}
                className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl disabled:opacity-60 transition-colors"
              >
                {autoPublishing ? 'AI 正在想卖什么...' : 'AI 帮我发布'}
              </button>
              {autoPublishResult && (
                <div className="mt-4 p-4 bg-violet-50 rounded-xl border border-violet-100">
                  <p className="text-sm text-violet-800 font-medium mb-2">{autoPublishResult.message}</p>
                  {autoPublishResult.published.length > 0 && (
                    <ul className="text-sm text-slate-700 space-y-1">
                      {autoPublishResult.published.map((p) => (
                        <li key={p.id}>
                          <Link href={`/products/${p.id}`} className="text-violet-600 hover:underline">{p.title}</Link>
                          {' '}¥{p.price}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-2">AI 自动扫货谈价</h3>
              <p className="text-sm text-slate-500 mb-4">
                AI 逛市场、挑商品、和卖家 AI 谈价，谈好后到「待确认」由你拍板
              </p>
              <button
                type="button"
                onClick={handleAutoBrowse}
                disabled={autoBrowsing}
                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-xl disabled:opacity-60 transition-colors"
              >
                {autoBrowsing ? 'AI 正在逛市场...' : 'AI 帮我逛'}
              </button>
              {autoBrowseResult && (
                <div className="mt-4 p-4 bg-sky-50 rounded-xl border border-sky-100 space-y-3">
                  {autoBrowseResult.message && (
                    <p className="text-sm text-sky-800 font-medium">{autoBrowseResult.message}</p>
                  )}
                  {autoBrowseResult.results.length > 0 && (
                    <ul className="text-sm space-y-3">
                      {autoBrowseResult.results.map((r, i) => (
                        <li key={i} className="border-b border-sky-100 pb-2 last:border-0">
                          <Link href={`/products/${r.productId}`} className="font-medium text-sky-700 hover:underline">
                            {r.productTitle}
                          </Link>
                          <span className="ml-2 text-slate-600">
                            {r.outcome === 'pending_confirmation' && `谈成 ¥${r.finalPrice}，待确认`}
                            {r.outcome === 'rejected' && '未谈拢'}
                            {r.outcome === 'skipped' && `跳过 — ${r.reason || ''}`}
                            {r.outcome === 'no_deal' && '多轮未成'}
                            {r.outcome === 'error' && `出错: ${r.reason || ''}`}
                          </span>
                          {r.logs && r.logs.length > 0 && (
                            <ul className="mt-1 text-xs text-slate-500 space-y-0.5 pl-3">
                              {r.logs.map((log, j) => (
                                <li key={j}>
                                  {log.role === 'buyer' ? '买AI' : '卖AI'}: {log.action}
                                  {log.price != null && ` ¥${log.price}`}
                                  {log.reason && ` — ${log.reason}`}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-2">刷新商品图片</h3>
              <p className="text-sm text-slate-500 mb-4">
                将占位文字图替换为网上搜到的真实实物图
              </p>
              <button
                type="button"
                onClick={handleRefreshImages}
                disabled={refreshingImages}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl disabled:opacity-60 transition-colors"
              >
                {refreshingImages ? '搜索图片中...' : '一键刷新图片'}
              </button>
              {refreshImageMsg && (
                <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  {refreshImageMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
