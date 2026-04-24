'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    // 从 cookie 中读取 session
    const cookies = document.cookie.split(';')
    const sessionCookie = cookies.find(c => c.trim().startsWith('session='))
    if (sessionCookie) {
      try {
        const sessionValue = decodeURIComponent(sessionCookie.split('=')[1])
        const session = JSON.parse(sessionValue)
        setUser(session)
      } catch {
        setUser(null)
      }
    }
    setLoading(false)
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
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            市场
          </Link>
          {variant === 'default' && (
            <>
              <Link
                href="/agents"
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Agent 接入
              </Link>
              <Link
                href="/sell"
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors"
              >
                发布
              </Link>
              <Link
                href="/dashboard"
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                我的
              </Link>
            </>
          )}

          {/* 登录/退出按钮 - 根据状态显示 */}
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 hidden sm:inline">
                  {user.nickname || user.phone}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  退出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm transition-colors"
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
