# 服务器部署说明

从 Git 拉取后，按以下步骤配置即可在服务器上运行。

## 1. 环境要求

- Node.js 18+
- 可写的磁盘路径（用于 SQLite 数据库与可选的产品图片目录）

## 2. 环境变量

复制示例并填入真实值：

```bash
cp .env.example .env.local
# 编辑 .env.local，至少配置：
# - SECONDME_CLIENT_ID / SECONDME_CLIENT_SECRET（SecondMe 开放平台）
# - SECONDME_REDIRECT_URI = https://你的域名/api/auth/callback
# - NEXT_PUBLIC_BASE_URL = https://你的域名
# - DATABASE_URL（见下）
```

**重要**：`SECONDME_REDIRECT_URI` 和 `NEXT_PUBLIC_BASE_URL` 必须与最终访问的域名一致（含 https）。

## 3. 数据库

项目使用 SQLite。首次部署需初始化表结构：

```bash
npm install
npx prisma generate
npx prisma db push
```

- 默认 `DATABASE_URL=file:./dev.db` 会在项目根目录生成 `dev.db`。
- 若服务器限制当前目录不可写，请改为绝对路径，例如：  
  `DATABASE_URL=file:/var/data/a2a-xianyu/dev.db`  
  并保证该目录存在且进程有写权限。

## 4. 构建与启动

```bash
npm install
npx prisma generate
npm run build
npm run start
```

或使用 PM2 等保持常驻：

```bash
npm run build
pm2 start npm --name "a2a-xianyu" -- start
```

## 5. 常见问题

| 现象 | 处理 |
|------|------|
| 登录回调 404 / 认证失败 | 检查 `SECONDME_REDIRECT_URI`、`NEXT_PUBLIC_BASE_URL` 是否与浏览器访问域名一致 |
| 启动报错找不到数据库 | 先执行 `npx prisma db push`，并确认 `DATABASE_URL` 路径可写 |
| better-sqlite3 安装/编译失败 | 需安装 build-essential（Linux）或 Xcode Command Line Tools（macOS），再 `npm install` |
| 商品图为占位图 | 正常；可选配置 `PEXELS_API_KEY` 或部署后使用「一键刷新图片」从 Openverse 拉图 |

## 6. 无状态部署（如 Vercel）

当前使用 **SQLite + better-sqlite3**，依赖本地文件，**不适合直接部署到 Vercel**（无持久化磁盘）。若需上 Vercel，需改为：

- 使用 Prisma 支持的云数据库（如 PostgreSQL），或
- 将 SQLite 文件放在可持久化的存储（如 S3 + 运行时挂载）并相应修改配置。

在自有服务器或支持持久化磁盘的平台上，按上述步骤即可正常运行。
