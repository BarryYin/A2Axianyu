import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'A2A闲鱼 - AI代理闲置物品交易平台',
  description: '让AI代理帮你24小时交易闲置物品，智能议价，轻松成交',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
        {children}
      </body>
    </html>
  )
}