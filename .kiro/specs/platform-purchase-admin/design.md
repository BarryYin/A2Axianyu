# 设计文档: 平台代购管理员页面

## 1. 架构概览

```
前端 (Next.js App Router)
├── /admin — 管理员面板主页面
│   ├── 订单队列组件
│   ├── 订单详情弹窗
│   └── 统计概览组件
├── /marketplace — 商品浏览（已有）
├── /sell — 商品发布（已有）
└── /dashboard — 用户面板（已有）

API 层 (Next.js Route Handlers)
├── /api/admin/orders — 订单CRUD
├── /api/admin/orders/[id]/status — 状态变更
├── /api/admin/orders/[id]/tracking — 物流信息
├── /api/admin/orders/bulk-update — 批量操作
├── /api/notifications — 通知管理
└── /api/negotiations — 议价管理

数据层 (Prisma + SQLite)
├── Order — 代购订单
├── NegotiationLog — 议价记录
├── Notification — 通知记录
└── Product (扩展) — 增加议价配置
```

## 2. 数据模型设计

### 新增：Order 模型
```prisma
model Order {
  id              String   @id @default(cuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  buyerId         String
  buyer           User     @relation(fields: [buyerId], references: [id])
  status          OrderStatus @default(PENDING)
  negotiatedPrice Float
  originalPrice   Float
  xianyuUrl       String
  
  // 采购信息（管理员填写）
  trackingNumber  String?
  courierCompany  String?
  adminNotes      String?
  failureReason   String?
  
  // 时间戳
  createdAt       DateTime @default(now())
  purchasedAt     DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  failedAt        DateTime?
  refundedAt      DateTime?
  
  // 关联
  negotiations    NegotiationLog[]
  notifications   Notification[]
  
  @@index([status])
  @@index([buyerId])
  @@index([createdAt])
}

enum OrderStatus {
  PENDING     // 待采购
  PURCHASED   // 已采购
  SHIPPED     // 已发货
  DELIVERED   // 已送达
  FAILED      // 采购失败
  REFUNDED    // 已退款
}
```

### 新增：NegotiationLog 模型
```prisma
model NegotiationLog {
  id          String   @id @default(cuid())
  orderId     String?
  order       Order?   @relation(fields: [orderId], references: [id])
  productId   String
  buyerAgentId String
  sellerAgentId String
  
  round       Int      // 第几轮
  offerPrice  Float    // 出价
  counterPrice Float?  // 还价
  status      NegotiationStatus
  
  createdAt   DateTime @default(now())
}

enum NegotiationStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTER_OFFERED
  TIMEOUT
}
```

### 新增：Notification 模型
```prisma
model Notification {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  type      NotificationType
  message   String
  status    NotificationStatus @default(SENT)
  
  createdAt DateTime @default(now())
  readAt    DateTime?
}

enum NotificationType {
  PURCHASE_SUCCESS
  PURCHASE_FAILED
  SHIPPED
  DELIVERED
  REFUND_COMPLETE
  PRODUCT_RECOMMENDATION
}

enum NotificationStatus {
  SENT
  DELIVERED
  READ
}
```

### 扩展：Product 模型（增加议价配置）
```prisma
// 在现有 Product 模型上增加：
// minPrice        Float?    // 最低可接受价格
// maxPrice        Float?    // 最高可接受价格
// autoAcceptPrice Float?    // 自动接受阈值
// xianyuUrl       String?   // 闲鱼原始链接
// source          String?   // 来源（xianyu/manual）
// platformListed  Boolean   @default(false) // 是否平台自营
```

## 3. 状态机设计

```
订单状态流转：

    ┌──────────┐
    │ PENDING  │ ← 新订单创建
    │ 待采购   │
    └────┬─────┘
         │
    ┌────┴──────────────────┐
    │                       │
    ▼                       ▼
┌──────────┐          ┌──────────┐
│ PURCHASED│          │  FAILED  │
│ 已采购   │          │  失败    │
└────┬─────┘          └────┬─────┘
     │                     │
     ▼                     ▼
┌──────────┐          ┌──────────┐
│ SHIPPED  │          │ REFUNDED │
│ 已发货   │          │ 已退款   │
└────┬─────┘          └──────────┘
     │
     ▼
┌──────────┐
│ DELIVERED│
│ 已送达   │
└──────────┘

合法状态转换：
- PENDING → PURCHASED  （管理员确认采购）
- PENDING → FAILED     （管理员标记失败）
- PURCHASED → SHIPPED  （管理员填写快递单号后）
- SHIPPED → DELIVERED  （物流确认或管理员标记）
- FAILED → REFUNDED    （退款完成后）
```

## 4. 核心业务流程

### 4.1 AI议价流程
```
1. 买家Agent浏览商品 → 发起议价
2. 系统检查：卖家Agent是否在线、议价规则配置
3. 买家Agent出价 → 系统检查是否在autoAcceptPrice以上
   - 是 → 自动接受，生成Order（PENDING）
   - 否 → 卖家Agent counter-offer
4. 最多5轮议价，每轮5-10%调价
5. 成交 → 生成Order（PENDING）
6. 超时/拒绝 → 记录失败，通知买家
```

### 4.2 管理员采购流程
```
1. 管理员打开 /admin 页面
2. 看到待办订单队列（PENDING状态）
3. 点击闲鱼链接 → 新标签页打开闲鱼
4. 在闲鱼完成手动下单
5. 回到管理页面：
   - 点击[已购] → 填写快递单号+物流公司 → 确认
   - 或点击[失败] → 选择原因 → 确认
6. 系统自动触发买家通知
```

### 4.3 买家通知流程
```
采购成功：
  → 通知买家Agent："你的订单已从闲鱼采购成功！"
  → 包含：快递单号、物流公司、预计到货时间

采购失败：
  → 通知买家Agent："很抱歉，该商品采购失败"
  → 包含：失败原因、退款确认
  → 附带：3-5个类似商品推荐链接
```

## 5. 组件设计

### 管理员页面组件树
```
AdminPage
├── StatsOverview        // 顶部统计：待办数、今日处理、成功率
├── OrderFilterBar       // 状态筛选 + 搜索
├── OrderQueue           // 订单列表
│   └── OrderCard × N    // 单条订单卡片
│       ├── 商品信息     // 标题、价格、图片
│       ├── 闲鱼链接按钮 // 一键跳转
│       ├── 买家信息     // 买家名称、收货地址
│       ├── 时间信息     // 创建时间、已等待时长
│       └── 操作按钮     // [已购] [失败]
├── PurchaseModal        // 已购确认弹窗
│   ├── 快递单号输入
│   ├── 物流公司选择
│   └── 备注输入
├── FailureModal         // 失败原因弹窗
│   ├── 原因选择（单选）
│   └── 备注输入
└── OrderDetailDrawer    // 订单详情抽屉
    ├── 商品详情
    ├── 议价历史
    ├── 通知记录
    └── 物流跟踪
```

## 6. 文件结构

### 新增文件
```
src/
├── app/
│   └── admin/
│       └── page.tsx              ← 管理员面板主页面
├── components/
│   └── admin/
│       ├── StatsOverview.tsx     ← 统计概览
│       ├── OrderQueue.tsx        ← 订单队列
│       ├── OrderCard.tsx         ← 订单卡片
│       ├── PurchaseModal.tsx     ← 采购确认弹窗
│       ├── FailureModal.tsx      ← 失败原因弹窗
│       └── OrderDetailDrawer.tsx ← 详情抽屉
├── app/api/admin/
│   └── orders/
│       ├── route.ts              ← GET列表/批量更新
│       └── [id]/
│           ├── route.ts          ← GET详情
│           ├── status/route.ts   ← PATCH状态
│           └── tracking/route.ts ← POST物流信息
├── app/api/notifications/
│   ├── route.ts                  ← POST发送通知
│   └── [orderId]/route.ts        ← GET通知历史
└── app/api/negotiations/
    ├── route.ts                  ← POST发起议价
    └── [id]/
        ├── route.ts              ← GET议价状态
        ├── offer/route.ts        ← POST还价
        └── accept/route.ts       ← POST接受
```

### 需修改的现有文件
```
prisma/schema.prisma              ← 新增Order/NegotiationLog/Notification模型
src/app/api/products/route.ts     ← 扩展支持议价配置
src/app/api/agent/products/       ← 扩展AI议价逻辑
src/lib/secondme.ts               ← 添加通知相关API调用
```

## 7. 技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 管理员认证 | 在现有auth基础上增加admin角色 | 简单，不需要额外的auth系统 |
| 通知方式 | 通过SecondMe API推送到买家Agent | 项目已有SecondMe集成 |
| 议价引擎 | 基于规则的引擎 + SecondMe AI辅助 | 规则保证可控，AI提升体验 |
| 数据库 | 继续使用SQLite | MVP阶段足够，后续可迁移到PostgreSQL |
| 状态管理 | 服务端状态 + React Query | 与现有架构一致 |

## 8. 安全与权限

- 管理员页面需要 admin 角色权限
- 订单状态变更需要验证合法流转
- 闲鱼链接需要验证URL格式
- 批量操作需要二次确认
- 所有API需要认证（延续现有的auth机制）
