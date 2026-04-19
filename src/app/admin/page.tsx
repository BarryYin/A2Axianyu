'use client'

import { useState, useEffect, useCallback } from 'react'

interface OrderProduct {
  id: string
  title: string
  images: string
  category: string
}

interface OrderBuyer {
  id: string
  nickname: string | null
  avatar: string | null
}

interface Order {
  id: string
  status: string
  negotiatedPrice: number
  originalPrice: number
  xianyuUrl: string
  trackingNumber: string | null
  courierCompany: string | null
  adminNotes: string | null
  failureReason: string | null
  createdAt: string
  purchasedAt: string | null
  product: OrderProduct
  buyer: OrderBuyer
}

type OrderStatus = 'PENDING' | 'PURCHASED' | 'SHIPPED' | 'DELIVERED' | 'FAILED' | 'REFUNDED'

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待采购', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  PURCHASED: { label: '已采购', color: 'text-blue-700', bg: 'bg-blue-100' },
  SHIPPED: { label: '已发货', color: 'text-purple-700', bg: 'bg-purple-100' },
  DELIVERED: { label: '已送达', color: 'text-green-700', bg: 'bg-green-100' },
  FAILED: { label: '失败', color: 'text-red-700', bg: 'bg-red-100' },
  REFUNDED: { label: '已退款', color: 'text-gray-700', bg: 'bg-gray-100' },
}

const FAILURE_REASONS = [
  { value: 'price_changed', label: '涨价' },
  { value: 'sold_out', label: '已售出' },
  { value: 'seller_unresponsive', label: '卖家不回复' },
  { value: 'quality_issue', label: '商品问题' },
  { value: 'other', label: '其他' },
]

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [activeFilter, setActiveFilter] = useState<string>('PENDING')
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())

  // Modal states
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [showFailureModal, setShowFailureModal] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [courierCompany, setCourierCompany] = useState('')
  const [adminNotes, setAdminNotes] = useState('')
  const [failureReason, setFailureReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeFilter) params.set('status', activeFilter)
      const res = await fetch(`/api/admin/orders?${params}`)
      const data = await res.json()
      setOrders(data.orders || [])
      setStats(data.stats || {})
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }, [activeFilter])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleStatusUpdate = async (orderId: string, status: string, extraData?: Record<string, string>) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extraData }),
      })
      if (res.ok) {
        await fetchOrders()
        setShowPurchaseModal(false)
        setShowFailureModal(false)
        setCurrentOrder(null)
        resetForm()
      } else {
        const err = await res.json()
        alert(`操作失败: ${err.error}`)
      }
    } catch (error) {
      console.error('Status update failed:', error)
      alert('操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setTrackingNumber('')
    setCourierCompany('')
    setAdminNotes('')
    setFailureReason('')
  }

  const openPurchaseModal = (order: Order) => {
    setCurrentOrder(order)
    setShowPurchaseModal(true)
  }

  const openFailureModal = (order: Order) => {
    setCurrentOrder(order)
    setShowFailureModal(true)
  }

  const confirmPurchase = () => {
    if (!currentOrder || !trackingNumber) {
      alert('请填写快递单号')
      return
    }
    handleStatusUpdate(currentOrder.id, 'PURCHASED', {
      trackingNumber,
      courierCompany,
      adminNotes,
    })
  }

  const confirmFailure = () => {
    if (!currentOrder || !failureReason) {
      alert('请选择失败原因')
      return
    }
    handleStatusUpdate(currentOrder.id, 'FAILED', {
      failureReason: FAILURE_REASONS.find(r => r.value === failureReason)?.label || failureReason,
      adminNotes,
    })
  }

  const toggleSelect = (orderId: string) => {
    const next = new Set(selectedOrders)
    if (next.has(orderId)) next.delete(orderId)
    else next.add(orderId)
    setSelectedOrders(next)
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return '刚刚'
    if (hours < 24) return `${hours}小时前`
    return `${Math.floor(hours / 24)}天前`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">A2A闲鱼 · 管理员面板</h1>
          <p className="text-sm text-gray-500 mt-1">代购订单管理 · AI谈判 + 人工采购</p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`p-4 rounded-lg border-2 transition-all ${
                activeFilter === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold">{stats[status] || 0}</div>
              <div className={`text-sm ${config.color}`}>{config.label}</div>
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['PENDING', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'FAILED', 'REFUNDED', ''].map(status => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status ? STATUS_CONFIG[status as OrderStatus]?.label : '全部'}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">暂无订单</div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const config = STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.PENDING
              const images = JSON.parse(order.product.images || '[]')
              const isSelected = selectedOrders.has(order.id)

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-lg shadow-sm border-2 p-4 transition-all ${
                    isSelected ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Checkbox */}
                    {order.status === 'PENDING' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(order.id)}
                        className="mt-1 h-5 w-5 rounded border-gray-300"
                      />
                    )}

                    {/* Product image */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                      {images[0] ? (
                        <img src={images[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          无图片
                        </div>
                      )}
                    </div>

                    {/* Order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-gray-900 truncate">{order.product.title}</h3>
                          <p className="text-sm text-gray-500">
                            买家: {order.buyer.nickname || order.buyer.id}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-green-600 font-medium">成交价: ¥{order.negotiatedPrice}</span>
                        <span className="text-gray-400 line-through">原价: ¥{order.originalPrice}</span>
                        <span className="text-gray-500">{formatTime(order.createdAt)}</span>
                      </div>

                      {/* Xianyu link & actions */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {order.xianyuUrl && (
                          <a
                            href={order.xianyuUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                          >
                            打开闲鱼 →
                          </a>
                        )}

                        {order.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => openPurchaseModal(order)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            >
                              已购
                            </button>
                            <button
                              onClick={() => openFailureModal(order)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                            >
                              失败
                            </button>
                          </>
                        )}

                        {order.trackingNumber && (
                          <span className="text-sm text-gray-600">
                            📦 {order.courierCompany || '快递'}: {order.trackingNumber}
                          </span>
                        )}

                        {order.failureReason && (
                          <span className="text-sm text-red-600">
                            ❌ {order.failureReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && currentOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">确认采购</h2>
            <p className="text-sm text-gray-600 mb-4">{currentOrder.product.title}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">快递单号 *</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="输入快递单号"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">物流公司</label>
                <input
                  type="text"
                  value={courierCompany}
                  onChange={e => setCourierCompany(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="顺丰/圆通/中通等"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="可选备注"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowPurchaseModal(false); resetForm() }}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmPurchase}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认采购'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failure Modal */}
      {showFailureModal && currentOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">标记失败</h2>
            <p className="text-sm text-gray-600 mb-4">{currentOrder.product.title}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">失败原因 *</label>
                <div className="space-y-2">
                  {FAILURE_REASONS.map(reason => (
                    <label key={reason.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="failureReason"
                        value={reason.value}
                        checked={failureReason === reason.value}
                        onChange={e => setFailureReason(e.target.value)}
                      />
                      <span className="text-sm">{reason.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="可选备注"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setShowFailureModal(false); resetForm() }}
                className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmFailure}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? '提交中...' : '确认失败'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
