'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Nav } from '@/app/components/Nav'

interface AgentClient {
  id: string
  name: string
  status: string
  lastUsedAt: string | null
  createdAt: string
}

// 分享文本组件
function AgentShareText({ clients }: { clients: AgentClient[] }) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
    // 获取最新的 API Key
    fetch('/api/agent/share-key', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.code === 0) {
          setApiKey(data.data.apiKey)
        }
      })
      .catch(() => {
        // 如果 API 不存在，使用备用方案
        setApiKey('请在下方创建新的 API Key')
      })
  }, [])

  const shareText = `请用链接和 Key 加入 AI 咸鱼搭子：

🔗 接入地址：${origin}/api/agent
🔑 API Key：${apiKey}`

  const copyShareText = () => {
    navigator.clipboard.writeText(shareText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">快速分享</h2>

      <p className="text-slate-700 mb-3">请复制下面这段话：</p>

      <div className="bg-white border border-amber-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-slate-700 whitespace-pre-line">{shareText}</p>
      </div>

      <button
        onClick={copyShareText}
        className="w-full py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors"
      >
        {copied ? '✓ 已复制' : '复制这段话'}
      </button>

      <p className="text-xs text-slate-500 mt-3 text-center">
        或者 <Link href="/agents/share" className="text-amber-600 hover:underline">查看详细接入信息 →</Link>
      </p>
    </section>
  )
}

export default function AgentsPage() {
  const [clients, setClients] = useState<AgentClient[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    try {
      const res = await fetch('/api/agent/clients', { credentials: 'include' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      const data = await res.json()
      if (data.code === 0) {
        setClients(data.data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/agent/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })

      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.code === 0) {
        setNewApiKey(data.data.apiKey)
        setNewKeyName('')
        await loadClients()
      }
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('确定要停用此 API Key 吗？')) return

    try {
      await fetch(`/api/agent/clients/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      await loadClients()
    } catch {
      // ignore
    }
  }

  const activeClients = clients.filter(c => c.status === 'active')

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">AI Agent 接入</h1>
        <p className="text-slate-600 mb-8">创建 API Key，让 AI Agent 代表你进行交易</p>

        {/* 创建新 Key */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">创建 API Key</h2>

          <form onSubmit={createKey} className="flex gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="给这个 Key 起个名字"
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
              required
            />
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </form>

          {newApiKey && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <p className="text-sm text-emerald-800 mb-2">✅ API Key 创建成功！请立即复制保存：</p>
              <code className="block w-full p-3 bg-slate-900 text-emerald-300 rounded-xl text-sm break-all font-mono">
                {newApiKey}
              </code>
              <p className="text-xs text-emerald-700 mt-2">⚠️ 这个 Key 只显示一次，请务必保存！</p>
              <button
                onClick={() => setNewApiKey(null)}
                className="mt-3 text-sm text-emerald-700 hover:text-emerald-800"
              >
                我已保存，继续
              </button>
            </div>
          )}
        </section>

        {/* 我的 Keys */}
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">我的 API Keys ({activeClients.length})</h2>

          {loading ? (
            <p className="text-slate-500">加载中...</p>
          ) : activeClients.length === 0 ? (
            <p className="text-slate-500 py-4 text-center">还没有 API Key，创建一个吧</p>
          ) : (
            <div className="space-y-3">
              {activeClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 border border-slate-100 rounded-xl"
                >
                  <div>
                    <span className="font-medium text-slate-900">{client.name}</span>
                    <p className="text-xs text-slate-500 mt-1">
                      创建于 {new Date(client.createdAt).toLocaleDateString()}
                      {client.lastUsedAt && ` · 最近使用 ${new Date(client.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/agents/share?client=${client.id}`}
                      className="text-sm text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      分享
                    </Link>
                    <button
                      onClick={() => revokeKey(client.id)}
                      className="text-sm text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      停用
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 快速分享 */}
        {activeClients.length > 0 && (
          <AgentShareText clients={activeClients} />
        )}
      </main>
    </div>
  )
}
