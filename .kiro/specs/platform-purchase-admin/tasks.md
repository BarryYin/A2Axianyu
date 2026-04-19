# 任务清单: 平台代购管理员页面

## Phase 1: 数据层（1-2天）

### TASK-001: 扩展Prisma Schema
- [ ] 添加 Order 模型（含所有字段和枚举）
- [ ] 添加 NegotiationLog 模型
- [ ] 添加 Notification 模型
- [ ] 扩展 Product 模型（增加议价配置字段）
- [ ] 运行 prisma migrate
- 验证：数据库迁移成功，所有表创建完成

### TASK-002: 扩展 db.ts 数据库工具
- [ ] 添加订单查询辅助函数（按状态筛选、分页）
- [ ] 添加议价记录查询函数
- [ ] 添加通知记录查询函数
- 验证：可以正确CRUD所有新模型

## Phase 2: API层（2-3天）

### TASK-003: 订单管理API
- [ ] GET /api/admin/orders — 列表查询（分页+状态筛选）
- [ ] GET /api/admin/orders/[id] — 详情查询
- [ ] PATCH /api/admin/orders/[id]/status — 状态更新
- [ ] POST /api/admin/orders/[id]/tracking — 物流信息
- [ ] POST /api/admin/orders/bulk-update — 批量更新
- 验证：用curl/Postman测试所有端点正常工作

### TASK-004: 通知API
- [ ] POST /api/notifications/send — 发送通知（调用SecondMe API）
- [ ] GET /api/notifications/[orderId] — 查询通知历史
- 验证：通知能正确发送到SecondMe API

### TASK-005: 议价API
- [ ] POST /api/negotiations/start — 发起议价
- [ ] GET /api/negotiations/[id] — 查询议价状态
- [ ] POST /api/negotiations/[id]/offer — 提交还价
- [ ] POST /api/negotiations/[id]/accept — 接受报价
- [ ] 议价规则引擎（轮次限制、价格调整、超时检测）
- 验证：完整跑通一轮议价流程

## Phase 3: 前端组件（2-3天）

### TASK-006: 管理员面板主页面
- [ ] 创建 /admin 路由页面
- [ ] 添加管理员权限中间件检查
- [ ] 页面布局：统计概览 + 筛选栏 + 订单队列
- 验证：访问 /admin 显示面板布局

### TASK-007: 订单队列组件
- [ ] OrderQueue 列表组件（分页加载）
- [ ] OrderCard 单条订单卡片
- [ ] 闲鱼链接一键跳转按钮
- [ ] 时间显示（创建时间 + 已等待时长）
- [ ] 状态筛选功能
- 验证：待办订单正确显示，点击链接跳转闲鱼

### TASK-008: 操作弹窗组件
- [ ] PurchaseModal — 已购确认（快递单号+物流公司+备注）
- [ ] FailureModal — 失败原因选择（单选+备注）
- [ ] 操作后自动刷新订单列表
- 验证：标记已购/失败后订单状态正确变更

### TASK-009: 订单详情抽屉
- [ ] OrderDetailDrawer 组件
- [ ] 显示：商品详情、议价历史、通知记录
- [ ] 物流跟踪信息展示
- 验证：点击订单能展开查看完整详情

### TASK-010: 统计概览组件
- [ ] StatsOverview 组件
- [ ] 显示：待办数、今日处理数、成功率、平均处理时间
- [ ] 实时更新（轮询或WebSocket）
- 验证：统计数据与实际数据一致

## Phase 4: 集成与测试（1-2天）

### TASK-011: 议价与订单联动
- [ ] 议价成交后自动创建Order（PENDING状态）
- [ ] 自动接受阈值检测
- [ ] 议价记录关联到订单
- 验证：议价成交→订单自动创建→管理面板可见

### TASK-012: 状态变更与通知联动
- [ ] 订单标记已购→自动发送成功通知
- [ ] 订单标记失败→自动发送失败通知+推荐商品
- [ ] 通知记录关联到订单
- 验证：状态变更后买家能收到通知

### TASK-013: 端到端测试
- [ ] 完整流程：商品上架→AI议价→成交→管理员采购→通知买家
- [ ] 失败流程：商品上架→AI议价→成交→管理员标记失败→退款通知
- [ ] 边界测试：超时、重复操作、非法状态转换
- 验证：两个完整流程都能跑通

## Phase 5: 部署与优化（1天）

### TASK-014: 权限与安全
- [ ] 管理员角色验证
- [ ] API认证中间件
- [ ] 操作日志记录
- 验证：非管理员无法访问管理面板

### TASK-015: 部署准备
- [ ] 环境变量配置检查
- [ ] 数据库迁移脚本
- [ ] 构建测试
- 验证：npm run build 成功

---

## 时间估算

| Phase | 任务数 | 预估时间 |
|-------|--------|---------|
| 数据层 | 2 | 1-2天 |
| API层 | 3 | 2-3天 |
| 前端组件 | 5 | 2-3天 |
| 集成测试 | 3 | 1-2天 |
| 部署 | 2 | 1天 |
| **合计** | **15** | **7-11天** |

## 依赖关系

```
TASK-001 (Schema) ──→ TASK-002 (db helpers)
                          │
                    ┌─────┼─────┐
                    ▼     ▼     ▼
              TASK-003 TASK-004 TASK-005
              (Orders) (Notify) (Negotiate)
                    │     │     │
                    └──┬──┘     │
                       ▼        │
              TASK-006 (Page)    │
                       │        │
              ┌────────┼────────┤
              ▼        ▼        ▼
         TASK-007  TASK-008  TASK-009
         (Queue)   (Modals)  (Detail)
              │        │        │
              └────────┼────────┘
                       ▼
              TASK-010 (Stats)
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
         TASK-011  TASK-012  TASK-013
         (Neg→Ord) (Status→  (E2E Test)
                   Notify)
                       │
              ┌────────┘
              ▼
         TASK-014 (Security)
              │
              ▼
         TASK-015 (Deploy)
```
