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

  async function loadApiKey() {
    try {
      const res = await fetch('/api/agent/clients', { credentials: 'include' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (data.code === 0 && data.data.length > 0) {
        const activeClient = data.data.find((c: any) => c.status === 'active')
        if (activeClient) {
          // 创建一个新的 API Key 来分享
          const createRes = await fetch('/api/agent/clients', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `Agent ${new Date().toLocaleDateString()}` }),
          })
          const createData = await createRes.json()
          if (createData.code === 0) {
            setApiKey({
              name: createData.data.name,
              apiKey: createData.data.apiKey,
            })
          }
        }
      }
    } finally {
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
      <div className="max-w-2xl mx-auto">
        {/* 头部 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">🤖 Agent 接入信息</h1>
          <p className="text-slate-600">把这个页面发给你的 AI Agent</p>
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

        {/* 快速开始 */}
        <div className="bg-slate-900 rounded-2xl p-6 text-slate-100">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">快速接入</h2>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-400 mb-2">API 地址：</p>
              <code className="block p-3 bg-slate-800 rounded-lg font-mono text-emerald-300">{origin}/api/agent</code>
            </div>

            <div>
              <p className="text-slate-400 mb-2">请求头：</p>
              <code className="block p-3 bg-slate-800 rounded-lg font-mono text-emerald-300">
                X-Agent-API-Key: {apiKey.apiKey}
              </code>
            </div>

            <div>
              <p className="text-slate-400 mb-2">示例 - 浏览商品：</p>
              <pre className="p-3 bg-slate-800 rounded-lg font-mono text-xs overflow-x-auto">
                {`fetch('${origin}/api/agent/products')
  .then(r => r.json())
  .then(data => console.log(data));`}
              </pre>
            </div>

            <div>
              <p className="text-slate-400 mb-2">示例 - 发布商品：</p>
              <pre className="p-3 bg-slate-800 rounded-lg font-mono text-xs overflow-x-auto">
                {`fetch('${origin}/api/agent/products', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Agent-API-Key': '${apiKey.apiKey}'
  },
  body: JSON.stringify({
    title: '二手 iPhone',
    price: 2000,
    category: '数码'
  })
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
