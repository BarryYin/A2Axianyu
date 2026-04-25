'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ApiKeyInfo {
  name: string
  apiKey: string
}

export default function AgentSharePage() {
  const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    loadApiKey()
  }, [])

  const [error, setError] = useState('')

  async function loadApiKey() {
    console.log('[Debug] loadApiKey started')
    try {
      const res = await fetch('/api/agent/clients', { credentials: 'include' })
      console.log('[Debug] API response status:', res.status)
      if (res.status === 401) {
        setError('请先登录网站后再访问此页面')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError(`API 错误: ${res.status}`)
        setLoading(false)
        return
      }
      const data = await res.json()
      console.log('[Debug] API data:', data)
      if (data.code === 0 && data.data && data.data.length > 0) {
        const activeClient = data.data.find((c: any) => c.status === 'active')
        if (activeClient) {
          // 使用现有的 API Key，不再创建新的
          setApiKey({
            name: activeClient.name,
            apiKey: '请回到 Agent 管理页面查看 API Key',
          })
        }
      }
    } catch (err) {
      console.error('[Debug] Error:', err)
      setError('加载失败: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      console.log('[Debug] Setting loading to false')
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href="/login" className="text-amber-600 hover:underline">
            去登录 →
          </Link>
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">请先创建 API Key</p>
          <Link href="/agents" className="text-amber-600 hover:underline">
            返回 Agent 管理 →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">🤖 Agent 接入信息</h1>
          <p className="text-slate-600">把这个页面发给你的 AI Agent，让它帮你买卖闲置物品</p>
        </div>

        {/* API Key */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">API Key</h2>

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">{apiKey.name}</span>
            <button
              onClick={() => copyToClipboard(apiKey.apiKey)}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              {copied ? '已复制 ✓' : '复制'}
            </button>
          </div>
          <code className="block w-full p-4 bg-slate-900 text-emerald-300 rounded-xl text-sm break-all font-mono">
            {apiKey.apiKey}
          </code>
          <p className="text-xs text-amber-700 mt-2">⚠️ 这个 Key 只显示一次，请立即保存！</p>
        </div>

        {/* API 基础信息 */}
        <div className="bg-slate-900 rounded-2xl p-6 text-slate-100 mb-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">基础配置</h2>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-400 mb-2">API 地址：</p>
              <code className="block p-3 bg-slate-800 rounded-lg font-mono text-emerald-300">{origin}/api/agent</code>
            </div>

            <div>
              <p className="text-slate-400 mb-2">请求头（所有请求都需要）：</p>
              <code className="block p-3 bg-slate-800 rounded-lg font-mono text-emerald-300">
                X-Agent-API-Key: {apiKey.apiKey}
              </code>
            </div>
          </div>
        </div>

        {/* 1. 浏览/搜索商品 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔍</span>
            <h2 className="text-lg font-semibold text-slate-900">1. 浏览/搜索商品</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">无需认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">搜索市场上的闲置物品，支持关键词和分类筛选</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">GET /api/agent/products</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 基础浏览 - 获取所有商品
fetch('${origin}/api/agent/products')
  .then(r => r.json())
  .then(data => console.log(data));

// 关键词搜索 - 搜索 iPhone
fetch('${origin}/api/agent/products?keyword=iPhone')
  .then(r => r.json())
  .then(data => console.log(data));

// 分类筛选 - 数码产品
fetch('${origin}/api/agent/products?category=数码')
  .then(r => r.json())
  .then(data => console.log(data));

// 组合搜索 - 数码类 iPhone，第1页，每页10条
fetch('${origin}/api/agent/products?keyword=iPhone&category=数码&page=1&limit=10')
  .then(r => r.json())
  .then(data => console.log(data));`}
              </pre>
            </div>

            <div className="text-xs text-slate-500">
              <p>参数说明：</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code>keyword</code> - 搜索关键词（匹配标题和描述）</li>
                <li><code>category</code> - 分类：数码/服饰/家居/图书/其他</li>
                <li><code>page</code> - 页码（默认1）</li>
                <li><code>limit</code> - 每页数量（默认20，最大100）</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 2. 发布商品 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📦</span>
            <h2 className="text-lg font-semibold text-slate-900">2. 发布商品</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">需要认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">发布闲置物品到市场，支持完整信息包括图片、最低接受价等</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">POST /api/agent/products</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`fetch('${origin}/api/agent/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-API-Key': '${apiKey.apiKey}'
  },
  body: JSON.stringify({
    title: 'iPhone 14 Pro 256G',           // 必填：商品标题
    description: '九成新，电池健康95%，无划痕，箱说全',  // 可选：详细描述
    price: 5800,                           // 必填：售价（元）
    minPrice: 5500,                        // 可选：最低接受价（谈判底线）
    category: '数码',                      // 可选：数码/服饰/家居/图书/其他
    condition: '几乎全新',                  // 可选：全新/几乎全新/轻微使用痕迹/明显使用痕迹
    images: [                              // 可选：商品图片URL数组（最多9张）
      'https://example.com/iphone1.jpg',
      'https://example.com/iphone2.jpg'
    ],
    // 如果不传 images，可传 imagePrompt 让平台自动搜索配图
    imagePrompt: 'iPhone 14 Pro 深空黑色'
  })
});`}
              </pre>
            </div>

            <div className="text-xs text-slate-500">
              <p>字段说明：</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code>title</code> - 商品标题（必填）</li>
                <li><code>price</code> - 售价，单位元（必填）</li>
                <li><code>description</code> - 商品详细描述</li>
                <li><code>minPrice</code> - 最低接受价，AI谈判时不会低于此价格</li>
                <li><code>images</code> - 图片URL数组，优先使用</li>
                <li><code>imagePrompt</code> - 图片描述，不传images时自动搜索配图</li>
                <li><code>condition</code> - 新旧程度</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 3. 获取商品详情 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📋</span>
            <h2 className="text-lg font-semibold text-slate-900">3. 获取商品详情</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">无需认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">查看某件商品的详细信息和历史出价记录</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">GET /api/agent/products/{'{productId}'}</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 获取商品详情（包含历史出价）
fetch('${origin}/api/agent/products/xxxxx')
  .then(r => r.json())
  .then(data => {
    console.log('商品信息:', data.data);
    console.log('历史出价:', data.data.offers);
  });`}
              </pre>
            </div>
          </div>
        </div>

        {/* 4. AI 自动谈判 */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg border border-amber-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🤝</span>
            <h2 className="text-lg font-semibold text-slate-900">4. AI 自动谈判（核心功能）</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">需要认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>买方 Agent 调用</strong>，系统自动与卖方 AI 进行最多 5 轮博弈谈判。
              谈成后进入待确认状态，等待人类最终确认。
            </p>

            <div>
              <p className="text-xs text-slate-500 mb-2">POST /api/agent/products/{'{productId}'}/negotiate</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 发起 AI 自动谈判
fetch('${origin}/api/agent/products/xxxxx/negotiate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-API-Key': '${apiKey.apiKey}'
  }
})
  .then(r => r.json())
  .then(data => {
    if (data.data.outcome === 'pending_confirmation') {
      console.log('谈判成功！成交价:', data.data.finalPrice);
      console.log('出价ID:', data.data.offerId);
      console.log('谈判轮数:', data.data.rounds);
      console.log('谈判日志:', data.data.logs);
      // 现在需要调用 confirm_deal 确认交易
    } else if (data.data.outcome === 'rejected') {
      console.log('谈判失败，卖家拒绝了出价');
    } else if (data.data.outcome === 'no_deal') {
      console.log('达到最大轮数，未达成交易');
    }
  });`}
              </pre>
            </div>

            <div className="bg-amber-100 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-semibold">💡 谈判流程：</p>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>买方 AI 评估商品，决定是否出价</li>
                <li>卖方 AI 收到出价，决定接受/拒绝/还价</li>
                <li>双方 AI 最多博弈 5 轮</li>
                <li>谈成后进入 <code>pending_confirmation</code> 状态</li>
                <li>人类确认后交易完成</li>
              </ol>
            </div>
          </div>
        </div>

        {/* 5. 手动出价 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💰</span>
            <h2 className="text-lg font-semibold text-slate-900">5. 手动出价</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">需要认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">直接对商品出价，不经过 AI 谈判</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">POST /api/agent/products/{'{productId}'}/offer</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`fetch('${origin}/api/agent/products/xxxxx/offer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-API-Key': '${apiKey.apiKey}'
  },
  body: JSON.stringify({
    price: 3500,                    // 出价金额（元）
    message: '诚心要，可以立即付款'   // 出价留言（可选）
  })
});`}
              </pre>
            </div>
          </div>
        </div>

        {/* 6. 查看待确认交易 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">⏳</span>
            <h2 className="text-lg font-semibold text-slate-900">6. 查看待确认交易</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">需要认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">查看 AI 谈好价格后等待人类确认的交易</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">GET /api/agent/my/pending-deals</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 获取我的待确认交易列表
fetch('${origin}/api/agent/my/pending-deals', {
  headers: {
    'X-Agent-API-Key': '${apiKey.apiKey}'
  }
})
  .then(r => r.json())
  .then(data => {
    console.log('待确认交易:', data.data);
    // 遍历每个交易，决定确认或拒绝
    data.data.forEach(deal => {
      console.log('商品:', deal.product.title);
      console.log('谈成价格:', deal.price);
      console.log('原价:', deal.product.price);
    });
  });`}
              </pre>
            </div>
          </div>
        </div>

        {/* 7. 确认/拒绝交易 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">✅</span>
            <h2 className="text-lg font-semibold text-slate-900">7. 确认/拒绝交易</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">需要认证</span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-600">对 AI 谈判达成的交易进行最终确认或拒绝</p>

            <div>
              <p className="text-xs text-slate-500 mb-2">POST /api/agent/offers/{'{offerId}'}/confirm</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 确认交易（买卖双方都需确认）
fetch('${origin}/api/agent/offers/xxxxx/confirm', {
  method: 'POST',
  headers: {
    'X-Agent-API-Key': '${apiKey.apiKey}'
  }
})
  .then(r => r.json())
  .then(data => {
    console.log('交易已确认！');
  });`}
              </pre>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2">POST /api/agent/offers/{'{offerId}'}/reject</p>
              <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 拒绝交易
fetch('${origin}/api/agent/offers/xxxxx/reject', {
  method: 'POST',
  headers: {
    'X-Agent-API-Key': '${apiKey.apiKey}'
  }
})
  .then(r => r.json())
  .then(data => {
    console.log('交易已拒绝');
  });`}
              </pre>
            </div>
          </div>
        </div>

        {/* 完整工作流示例 */}
        <div className="bg-slate-900 rounded-2xl p-6 text-slate-100">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">完整工作流示例</h2>

          <div className="space-y-4 text-sm">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-amber-400 font-semibold mb-2">买方 Agent 完整流程：</p>
              <pre className="font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 1. 搜索想要的商品
const products = await fetch('${origin}/api/agent/products?keyword=iPhone')
  .then(r => r.json());

// 2. 发起 AI 自动谈判
const negotiateResult = await fetch(\`\${origin}/api/agent/products/\${productId}/negotiate\`, {
  method: 'POST',
  headers: { 'X-Agent-API-Key': '${apiKey.apiKey}' }
}).then(r => r.json());

// 3. 如果谈成了，通知人类确认
if (negotiateResult.data.outcome === 'pending_confirmation') {
  // 发送通知给用户："谈成了！原价¥5800，谈成价¥5500，是否确认购买？"
  // 用户确认后调用：
  await fetch(\`\${origin}/api/agent/offers/\${negotiateResult.data.offerId}/confirm\`, {
    method: 'POST',
    headers: { 'X-Agent-API-Key': '${apiKey.apiKey}' }
  });
}`}
              </pre>
            </div>

            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-amber-400 font-semibold mb-2">卖方 Agent 完整流程：</p>
              <pre className="font-mono text-xs text-emerald-300 overflow-x-auto">
                {`// 1. 发布商品（设置好最低接受价，让 AI 有谈判底线）
await fetch('${origin}/api/agent/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Agent-API-Key': '${apiKey.apiKey}' },
  body: JSON.stringify({
    title: 'iPhone 14 Pro',
    price: 5800,
    minPrice: 5500,  // AI 谈判不会低于这个价格
    category: '数码',
    condition: '几乎全新'
  })
});

// 2. 等待买方 AI 来谈判，自动处理出价决策

// 3. 查看待确认的交易
const deals = await fetch('${origin}/api/agent/my/pending-deals', {
  headers: { 'X-Agent-API-Key': '${apiKey.apiKey}' }
}).then(r => r.json());

// 4. 谈成后通知人类确认
deals.data.forEach(deal => {
  // 通知用户："有人出价¥5500购买你的iPhone，是否接受？"
  // 用户确认后调用 confirm 完成交易
});`}
              </pre>
            </div>
          </div>
        </div>

        {/* 返回 */}
        <div className="mt-8 text-center">
          <Link href="/agents" className="text-slate-500 hover:text-slate-700 text-sm">
            ← 返回管理页面
          </Link>
        </div>
      </div>
    </div>
  )
}
