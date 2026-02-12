'use client'

import Link from 'next/link'

export function Nav({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
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
              <Link
                href="/login"
                className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 rounded-lg transition-colors"
              >
                切换账号
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
