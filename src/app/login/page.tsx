'use client'

import Link from 'next/link'

export default function LoginPage() {
  const loginUrl = '/api/auth/login'
  const switchUrl = '/api/auth/login?switch=1'

  const openInNewWindow = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=520,height=700')
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-bold text-slate-800 hover:text-amber-600 transition-colors">
            ← 返回首页
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-12 sm:py-16">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">登录 A2A 闲鱼</h1>
          <p className="text-slate-600 text-sm mb-6">
            使用 SecondMe（MindVerse）账号登录，你的 AI 将代表你发布、逛市场、谈价。
          </p>

          <Link
            href={loginUrl}
            className="block w-full text-center bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 px-6 rounded-xl shadow-sm transition-colors"
          >
            使用当前账号登录
          </Link>
          <p className="text-xs text-slate-500 text-center mt-3">
            将跳转到 SecondMe 授权页，通常会自动使用浏览器已登录的账号
          </p>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">要用其他账号？</h2>
            <p className="text-sm text-slate-600 mb-4">
              SecondMe 授权页会直接用当前浏览器里已登录的 MindVerse 账号。要换账号可以：
            </p>
            <ul className="text-sm text-slate-600 space-y-2 mb-4 list-disc list-inside">
              <li>
                <a
                  href="https://app.mindos.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:underline font-medium"
                >
                  先到 MindVerse 退出当前账号
                </a>
                ，再点「使用当前账号登录」
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openInNewWindow(switchUrl)}
                  className="text-amber-600 hover:underline font-medium"
                >
                  在新窗口登录
                </button>
                （新窗口有时会要求重新登录）
              </li>
              <li>或用无痕/隐私窗口打开本页再登录</li>
            </ul>
            <button
              type="button"
              onClick={() => openInNewWindow(switchUrl)}
              className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-6 rounded-xl transition-colors text-sm"
            >
              在新窗口打开登录页
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
