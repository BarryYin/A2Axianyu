# 研究日志: 闲鱼商品搬运

## 发现范围

本次设计为轻量级扩展发现（Light Discovery），聚焦现有系统集成点、技术选型与风险评估。

## 技术选型

### HTML 解析库: cheerio
- **决策**: 采用 `cheerio` 作为服务端 HTML 解析器
- **理由**: 轻量（~150KB）、无浏览器依赖、类 jQuery API 便于快速提取 DOM 节点、与 Next.js 运行时兼容良好
- **替代方案**: `playwright-core` / `puppeteer-core` 可处理 SPA，但引入 Chromium 会使部署包体积与启动时间大幅增加；当前阶段优先选择轻量方案验证可行性
- **风险**: 闲鱼页面若为纯客户端渲染，cheerio 可能无法获取动态加载内容。缓解措施：优先请求闲鱼服务端渲染入口或 H5 页面

### 抓取策略
- **决策**: 使用原生 `fetch` + 标准浏览器 User-Agent
- **理由**: 零额外依赖，Next.js Edge/Node 运行时均支持
- **风险**: 闲鱼可能基于 IP/User-Agent 频率限制返回验证页。缓解措施：单请求超时 30 秒，失败时提示用户手动填写

## 现有系统集成分析

### 数据库
- `Product` 模型已含 `xianyuUrl`（String?）和 `source`（String?）字段，无需迁移
- `xianyuUrl` 当前无唯一索引，建议在实现阶段添加 `@unique` 或应用层去重，防止并发重复创建

### 认证
- 复用 `getCurrentUser`（Cookie/Bearer Token），抓取 API 要求登录用户调用

### 前端
- `sell/page.tsx` 为 Client Component（`'use client'`），新增交互状态（`xianyuUrl`, `isScraping`, `scrapeError`）不会与现有表单逻辑冲突
- 发布接口 `/api/products` 需扩展接收 `xianyuUrl` 和 `source` 字段

## 设计决策

### 1. 通用化接口
- `XianyuScraper` 接口与具体解析实现解耦（`scrape(url)` → `ScrapeResult`）
- 未来替换为 MCP Server、无头浏览器或第三方 API 时，上层 API Route 与前端无需改动

### 2. 不引入图片转存
- 仅传递闲鱼 CDN 图片 URL
- 若防盗链导致前端无法展示，以占位图替代，降低首版复杂度

### 3. 无独立服务进程
- 抓取逻辑作为库函数运行在 Next.js API Route 内
- 避免额外部署与运维成本，符合当前项目规模

## 风险记录

| 风险 | 影响 | 可能性 | 缓解措施 |
|------|------|--------|----------|
| 闲鱼页面结构变化 | 解析失败 | 中 | 解析器集中在一个文件，便于快速修复；错误降级到手动填写 |
| 闲鱼反爬拦截 | 抓取失败 | 中高 | 超时控制 + 友好错误提示；后续可升级为 MCP/Playwright |
| 图片防盗链 | 预览图无法展示 | 高 | 前端容错展示占位图；用户可手动替换链接 |
| 并发重复创建 | 同一链接产生多个商品 | 低 | 应用层先查后插；建议数据库加唯一索引 |
