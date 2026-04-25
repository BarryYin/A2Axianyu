/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 LightningCSS（默认启用，显式配置可确保生效）
  lightningcss: true,
  // 允许跨域开发访问
  allowedDevOrigins: ['xianyu.jtqnw.cn'],
}

module.exports = nextConfig