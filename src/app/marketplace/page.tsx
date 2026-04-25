'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Nav } from '../components/Nav'
import { getProductImageUrl } from '@/lib/placeholder'

interface Product {
  source?: string
  xianyuUrl?: string | null
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
  createdAt: string
  seller: { id: string; nickname: string; avatar: string | null }
  _count: { offers: number }
}

export default function Marketplace() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 0) setProducts(data.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-slate-500">加载中...</p>
        </div>
      </div>
    )
  }

  console.log('[Marketplace] Products loaded:', products.length, products)

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">商品市场</h1>

        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-lg text-slate-600 mb-4">还没有商品</p>
            <Link
              href="/sell"
              className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 px-6 rounded-xl transition-colors"
            >
              成为第一个卖家
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map((product) => {
              const imgUrl = getProductImageUrl(product.images, product.category, product.title)
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-200 transition-all duration-200"
                >
                  <div className="aspect-square bg-slate-100 overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    {product.source === 'xianyu' && (
                      <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mb-1">闲鱼搬运</span>
                    )}
                    <h3 className="font-semibold text-slate-800 line-clamp-2 mb-1 group-hover:text-amber-600 transition-colors">
                      {product.title}
                    </h3>
                    <p className="text-lg font-bold text-amber-600">¥{product.price}</p>
                    <div className="flex items-center justify-between mt-2 text-sm text-slate-500">
                      <span>{product.condition}</span>
                      <span>{product._count.offers} 个出价</span>
                    </div>
                    {product.aiPersonality && (
                      <span className="inline-block mt-2 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                        AI · {product.aiPersonality}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
