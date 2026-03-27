'use client'

import { useEffect, useState } from 'react'
import { Nav } from '@/app/components/Nav'

interface AgentClient {
  id: string
  name: string
  description: string | null
  websiteUrl: string | null
  agentUrl: string | null
  status: string
  scopes: string[]
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

interface CreateResult extends AgentClient {
  apiKey: string
}

interface RegistrationStatus {
  agentIdentityId: string
  name: string
  status: string
  expiresAt: string
  bound: boolean
  claimed: boolean
  owner: { nickname: string | null; avatar: string | null } | null
  claimedAt: string | null
}

const DEFAULT_SCOPE_TEXT = 'products.read, products.write, offers.write, deals.read, deals.write, negotiate.execute'

export default function AgentsPage() {
  const [clients, setClients] = useState<AgentClient[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [createdClient, setCreatedClient] = useState<CreateResult | null>(null)
  const [binding, setBinding] = useState(false)
  const [bindMessage, setBindMessage] = useState('')
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus | null>(null)
  const [bindForm, setBindForm] = useState({
    agentIdentityId: '',
    bindCode: '',
  })
  const [form, setForm] = useState({
    name: '',
    description: '',
    websiteUrl: '',
    agentUrl: '',
    scopes: DEFAULT_SCOPE_TEXT,
  })

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
      } else {
        setMessage(data.message || '读取 Agent Clients 失败')
      }
    } catch {
      setMessage('网络错误，无法加载 Agent Clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const agentIdentityId = params.get('identityId') ?? ''
    const bindCode = params.get('bindCode') ?? ''
    if (agentIdentityId || bindCode) {
      setBindForm({ agentIdentityId, bindCode })
    }
  }, [])

  useEffect(() => {
    async function loadRegistrationStatus() {
      if (!bindForm.agentIdentityId || !bindForm.bindCode) {
        setRegistrationStatus(null)
        return
      }

      try {
        const res = await fetch(
          `/api/agent/register/${encodeURIComponent(bindForm.agentIdentityId)}?bindCode=${encodeURIComponent(bindForm.bindCode)}`
        )
        const data = await res.json()
        if (data.code === 0) {
          setRegistrationStatus(data.data)
        } else {
          setRegistrationStatus(null)
        }
      } catch {
        setRegistrationStatus(null)
      }
    }

    loadRegistrationStatus()
  }, [bindForm.agentIdentityId, bindForm.bindCode])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setMessage('')
    setCreatedClient(null)

    const scopes = form.scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/agent/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          websiteUrl: form.websiteUrl || undefined,
          agentUrl: form.agentUrl || undefined,
          scopes,
        }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.code === 0) {
        setCreatedClient(data.data)
        setForm({
          name: '',
          description: '',
          websiteUrl: '',
          agentUrl: '',
          scopes: DEFAULT_SCOPE_TEXT,
        })
        setMessage(data.message || '创建成功')
        await loadClients()
      } else {
        setMessage(data.message || '创建失败')
      }
    } catch {
      setMessage('网络错误，创建失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id)
    setMessage('')
    try {
      const res = await fetch(`/api/agent/clients/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.code === 0) {
        setMessage(data.message || '已停用')
        await loadClients()
      } else {
        setMessage(data.message || '停用失败')
      }
    } catch {
      setMessage('网络错误，停用失败')
    } finally {
      setRevokingId(null)
    }
  }

  async function handleBind(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBinding(true)
    setBindMessage('')

    try {
      const res = await fetch('/api/agent/bind', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bindForm),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }

      const data = await res.json()
      if (data.code === 0) {
        setBindMessage(data.message || '绑定成功')
        const statusRes = await fetch(
          `/api/agent/register/${encodeURIComponent(bindForm.agentIdentityId)}?bindCode=${encodeURIComponent(bindForm.bindCode)}`
        )
        const statusData = await statusRes.json()
        if (statusData.code === 0) {
          setRegistrationStatus(statusData.data)
        }
        await loadClients()
      } else {
        setBindMessage(data.message || '绑定失败')
      }
    } catch {
      setBindMessage('网络错误，绑定失败')
    } finally {
      setBinding(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Agent 接入</h1>
          <p className="mt-2 text-sm text-slate-600">
            推荐流程是：第三方 Agent 先公开注册拿到
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">agentIdentityId</code>
            和
            <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">bindCode</code>
            ，然后由你在这里完成绑定。
          </p>
          <p className="mt-2 text-sm text-slate-500">
            对外部 Agent，不再要求它理解你的 SecondMe token。人类只在人类界面登录，Agent 只走自己的注册与领取 key 流程。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">绑定外部 Agent</h2>
            <p className="mt-1 text-sm text-slate-500">
              让第三方 Agent 先调用公开注册接口，然后把它生成的 identityId 和 bindCode 填到这里。
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleBind}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Agent Identity ID</label>
                <input
                  value={bindForm.agentIdentityId}
                  onChange={(e) => setBindForm((prev) => ({ ...prev, agentIdentityId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="例如：agent_12ab34cd56ef"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Bind Code</label>
                <input
                  value={bindForm.bindCode}
                  onChange={(e) => setBindForm((prev) => ({ ...prev, bindCode: e.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase tracking-[0.2em] outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="例如：A1B2C3"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={binding}
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {binding ? '绑定中...' : '绑定到当前账号'}
              </button>
            </form>

            {bindMessage && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                {bindMessage}
              </div>
            )}

            {registrationStatus && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900">{registrationStatus.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      registrationStatus.claimed
                        ? 'bg-emerald-100 text-emerald-700'
                        : registrationStatus.bound
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {registrationStatus.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Identity ID:
                  <code className="ml-1 rounded bg-white px-1.5 py-0.5 text-xs">{registrationStatus.agentIdentityId}</code>
                </p>
                {registrationStatus.owner && (
                  <p className="mt-1 text-sm text-slate-600">
                    当前绑定用户：{registrationStatus.owner.nickname || '未命名用户'}
                  </p>
                )}
                {registrationStatus.claimed ? (
                  <p className="mt-2 text-sm text-emerald-700">
                    这个 Agent 已经领取过 API Key。
                  </p>
                ) : registrationStatus.bound ? (
                  <p className="mt-2 text-sm text-sky-700">
                    绑定已完成。下一步让 Agent 调用
                    <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-xs">POST /api/agent/register/{registrationStatus.agentIdentityId}/claim</code>
                    并携带 bindCode 领取 API Key。
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amber-700">
                    还未绑定到任何用户。
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">创建 Agent Client</h2>
            <p className="mt-1 text-sm text-slate-500">
              这是给你手动创建内部或测试用 Agent Client 的入口。第三方 Agent 优先走上面的绑定流程。
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="例如：OpenManus Buyer Agent"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder="这个 Agent 负责什么能力"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">官网地址</label>
                  <input
                    value={form.websiteUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Agent 地址</label>
                  <input
                    value={form.agentUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, agentUrl: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                    placeholder="Agent Card 或服务地址"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Scopes</label>
                <input
                  value={form.scopes}
                  onChange={(e) => setForm((prev) => ({ ...prev, scopes: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  placeholder={DEFAULT_SCOPE_TEXT}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '创建中...' : '创建 Agent Client'}
              </button>
            </form>

            {message && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {message}
              </div>
            )}

            {createdClient && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-emerald-900">新 key 已生成</h3>
                    <p className="mt-1 text-sm text-emerald-800">
                      这个 key 后续不会再次明文显示。
                    </p>
                  </div>
                </div>
                <code className="mt-3 block overflow-x-auto rounded-xl bg-slate-950 px-3 py-3 text-sm text-emerald-300">
                  {createdClient.apiKey}
                </code>
              </div>
            )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">已注册 Clients</h2>
            <p className="mt-1 text-sm text-slate-500">
              可在这里查看最近使用时间，并停用不再使用的 key。
            </p>

            {loading ? (
              <p className="mt-5 text-sm text-slate-500">加载中...</p>
            ) : clients.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                还没有创建任何 Agent Client。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {clients.map((client) => (
                  <div key={client.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">{client.name}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              client.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {client.status}
                          </span>
                        </div>
                        {client.description && (
                          <p className="mt-1 text-sm text-slate-600">{client.description}</p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          最近使用：
                          {client.lastUsedAt ? new Date(client.lastUsedAt).toLocaleString() : '从未'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Scopes: {client.scopes.join(', ')}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={client.status !== 'active' || revokingId === client.id}
                        onClick={() => handleRevoke(client.id)}
                        className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        {revokingId === client.id ? '停用中...' : '停用'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
