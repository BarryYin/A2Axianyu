'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  title: string
  price: number
  category: string
  condition: string
  status: string
  images: string
  seller: {
    nickname: string
  }
}

export default function PlatformAdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '数码',
    condition: '95新',
    images: '',
    minPrice: '',
    autoAcceptPrice: '',
    xianyuUrl: '',
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/platform/products')
      const data = await res.json()
      if (data.success) {
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Fetch products error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const price = parseFloat(formData.price)
    const images = formData.images ? formData.images.split('\n').filter(url => url.trim()) : []

    try {
      const res = await fetch('/api/platform/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price,
          images,
          minPrice: formData.minPrice ? parseFloat(formData.minPrice) : price * 0.8,
          autoAcceptPrice: formData.autoAcceptPrice ? parseFloat(formData.autoAcceptPrice) : price * 0.9,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setShowForm(false)
        setFormData({
          title: '',
          description: '',
          price: '',
          category: '数码',
          condition: '95新',
          images: '',
          minPrice: '',
          autoAcceptPrice: '',
          xianyuUrl: '',
        })
        fetchProducts()
      } else {
        alert(data.error || '创建失败')
      }
    } catch (error) {
      alert('网络错误')
    }
  }

  if (loading) {
    return <div className="p-8 text-center">加载中...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-800 hover:text-amber-600">
            ← 返回首页
          </Link>
          <h1 className="font-bold text-slate-800">平台卖家后台</h1>
          <Link href="/api/auth/logout" className="text-sm text-slate-500 hover:text-slate-700">
            退出
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">商品管理</h2>
            <p className="text-slate-500 mt-1">当前在售商品：{products.length} 件</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-6 rounded-xl shadow-sm transition-colors"
          >
            {showForm ? '取消' : '+ 添加商品'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4">添加新商品</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">商品标题</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="例如：iPhone 14 Pro 256G"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">描述</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  rows={3}
                  placeholder="商品详细描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">价格（元）</label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="2999"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">类别</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                >
                  <option value="数码">数码</option>
                  <option value="服装">服装</option>
                  <option value="家居">家居</option>
                  <option value="书籍">书籍</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">新旧程度</label>
                <select
                  value={formData.condition}
                  onChange={e => setFormData({...formData, condition: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                >
                  <option value="全新">全新</option>
                  <option value="99新">99新</option>
                  <option value="95新">95新</option>
                  <option value="9成新">9成新</option>
                  <option value="8成新">8成新</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">最低接受价（可选）</label>
                <input
                  type="number"
                  value={formData.minPrice}
                  onChange={e => setFormData({...formData, minPrice: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="默认价格80%"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">自动接受价（可选）</label>
                <input
                  type="number"
                  value={formData.autoAcceptPrice}
                  onChange={e => setFormData({...formData, autoAcceptPrice: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="默认价格90%"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">图片URL（每行一个）</label>
                <textarea
                  value={formData.images}
                  onChange={e => setFormData({...formData, images: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  rows={2}
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">闲鱼链接（可选）</label>
                <input
                  type="url"
                  value={formData.xianyuUrl}
                  onChange={e => setFormData({...formData, xianyuUrl: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="https://www.goofish.com/..."
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl shadow-sm transition-colors"
                >
                  发布商品
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => {
            const images = typeof product.images === 'string'
              ? JSON.parse(product.images || '[]')
              : product.images

            return (
              <div key={product.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                    {images[0] ? (
                      <img src={images[0]} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl">📦</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 truncate">{product.title}</h4>
                    <p className="text-lg font-bold text-amber-600 mt-1">¥{product.price}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <span>{product.category}</span>
                      <span>·</span>
                      <span>{product.condition}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/products/${product.id}`}
                    className="flex-1 text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    查看
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {products.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
            <div className="text-4xl mb-2">🛒</div>
            <p className="text-slate-500">暂无商品，点击上方按钮添加</p>
          </div>
        )}
      </main>
    </div>
  )
}
