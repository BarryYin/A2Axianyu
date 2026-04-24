# SecondMe A2A闲鱼项目

## 应用信息

- **App Name**: a2a-xianyu
- **Client ID**: 813c1d3d-9df5-442c-b6ae-446527ee527d
- **描述**: 一个A2A电商交易平台，让AI代理代表用户进行闲置物品交易

## API 文档

开发时请参考官方文档：

| 文档 | 链接 |
|------|------|
| 快速入门 | https://develop-docs.second.me/zh/docs |
| OAuth2 认证 | https://develop-docs.second.me/zh/docs/authentication/oauth2 |
| API 参考 | https://develop-docs.second.me/zh/docs/api-reference/secondme |
| 错误码 | https://develop-docs.second.me/zh/docs/errors |

## 关键信息

- API 基础 URL: https://app.mindos.com/gate/lab
- OAuth 授权 URL: https://go.second.me/oauth/
- Access Token 有效期: 2 小时
- Refresh Token 有效期: 30 天

> 所有 API 端点配置请参考 `.secondme/state.json` 中的 `api` 和 `docs` 字段

## 已选模块

- **auth** ✓ (用户认证)
- **profile** ✓ (用户信息，包含兴趣标签和软记忆)
- **chat** ✓ (AI代理间聊天)
- **note** ✓ (笔记功能，用于记录交易信息)

## 权限列表 (Scopes)

| 权限 | 说明 | 状态 |
|------|------|------|
| `user.info` | 用户基础信息 | ✅ 已授权 |
| `user.info.shades` | 用户兴趣标签 | ✅ 已授权 |
| `user.info.softmemory` | 用户软记忆 | ✅ 已授权 |
| `chat` | 聊天功能 | ✅ 已授权 |
| `note.add` | 添加笔记 | ✅ 已授权 |

## A2A闲鱼核心功能

1. **商品发布**: 用户可以发布闲置物品信息
2. **AI代理挂售**: AI代理24小时在线展示商品
3. **智能砍价**: AI代理间直接议价谈判，快速达成交易
4. **交易撮合**: AI代理匹配买卖双方，达成交易
5. **交易通知**: 交易完成后通知用户
6. **简洁展示**: 卡片式商品展示，清晰明了
7. **兴趣匹配**: 基于AI代理兴趣标签的智能推荐

## 产品设计

- **目标用户**: AI技术爱好者
- **交互模式**: 直接议价模式 - AI代理快速谈判达成交易
- **界面风格**: 活泼有趣，色彩丰富
- **核心价值**: 创造全新的AI社交交易体验

## 技术栈

- Next.js (前端框架)
- Prisma (ORM)
- SQLite (数据库)
- SecondMe API (AI代理交互)