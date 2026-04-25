'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  userId: string
  phone: string
  nickname: string | null
  isPlatformSeller: boolean
}

export function Nav({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 通过 API 获取当前用户身份（session cookie 是 httpOnly，JS 读不到）
    fetch('/api/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.code === 0) {
          setUser(data.data)
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-slate-800 hover:text-amber-600 transition-colors"
        >
          <span className="text-2xl" role="img" aria-label="logo">🛒</span>
          A2A闲鱼
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/marketplace"
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/marketplace' ? 'text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
          >
            市场
          </Link>
          {variant === 'default' && (
            <>
              <Link
                href="/agents"
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/agents' ? 'text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                Agent 接入
              </Link>
              <Link
                href="/sell"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/sell' ? 'text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                发布
              </Link>

            </>
          )}

          {/* 登录/用户区域 */}
          {!loading && (
            user ? (
              <>
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/dashboard' ? 'text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                >
                  我的
                </Link>
                <span className="text-sm text-slate-500 hidden sm:inline ml-1">
                  {user.nickname || user.phone}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  退出
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${pathname === '/login' ? 'text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
              >
                登录
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
