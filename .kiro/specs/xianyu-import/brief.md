# Brief: xianyu-import

## Problem
用户在A2A闲鱼平台发布闲置时，必须手动填写标题、价格、描述、图片等全部信息。对于已经在闲鱼上架的商品，重复录入效率极低，体验差。

## Current State
- sell页面是纯手动表单发布，无外部数据导入能力
- 数据库Product模型已预留 `xianyuUrl` 和 `source` 字段，但无任何抓取/解析逻辑
- 平台已有代购管理员页面（platform-purchase-admin），但仅处理AI成交后的订单，不涉及商品上架

## Desired Outcome
用户在sell页面粘贴自己的闲鱼商品链接，系统秒级抓取商品信息（标题、价格、图片、描述等），自动预填到发布表单。用户确认或微调后一键上架，source标记为xianyu。

## Approach
方案C（B先行验证，MCP后续迭代）：
1. 后端新增 `/api/xianyu/scrape` API Route，使用 `fetch` + HTML解析提取闲鱼页面结构化数据
2. 前端sell页面增加"闲鱼链接输入框"，粘贴后调用API，拿到数据自动注入表单状态
3. 发布时 `source="xianyu"`，`xianyuUrl` 写入链接，并做URL去重检测
4. 如果闲鱼反爬导致fetch方案不稳定，后续迭代封装为MCP Server或接入第三方解析服务

选择理由：架构简单、快速验证、改动面小，与现有schema无缝兼容。

## Scope
- **In**：
  - 闲鱼链接输入与验证（前端sell页面）
  - 后端抓取API（/api/xianyu/scrape）
  - 闲鱼HTML解析器（标题、价格、图片、描述、成色提取）
  - 抓取结果预填表单
  - URL去重检测（发布前检查xianyuUrl是否已存在）
  - source=xianyu标记与数据库存储
- **Out**：
  - 闲鱼MCP Server（后续迭代再评估）
  - 自动发布到闲鱼（反向操作）
  - 闲鱼卖家信息/信用分抓取
  - 闲鱼动态、视频抓取
  - 自动化跟卖家聊天/议价

## Boundary Candidates
- **前端交互层**：sell页面新增闲鱼链接输入、加载态、预填表单、去重提示
- **后端抓取层**：/api/xianyu/scrape Route，负责fetch页面和错误处理
- **解析引擎层**：闲鱼HTML→结构化数据的纯函数逻辑（方便后续替换为MCP或第三方服务）
- **数据层**：Product表去重查询、source/xianyuUrl字段写入

## Out of Boundary
- 不实现闲鱼自动化登录或Cookie管理
- 不做闲鱼商品实时监控（价格变动等）
- 不处理非标准闲鱼链接（如淘口令、短链需先展开）
- 不涉及AI议价逻辑的改动

## Upstream / Downstream
- **Upstream**：现有Product Prisma模型、sell页面表单逻辑、/api/products POST接口
- **Downstream**：platform-purchase-admin（管理员代购页面需识别xianyu来源订单，采购时直接跳转xianyuUrl）

## Existing Spec Touchpoints
- **Extends**：无（全新功能）
- **Adjacent**：platform-purchase-admin（下游消费者，依赖xianyuUrl字段）

## Constraints
- 闲鱼有反爬机制，fetch+解析方式可能在某些环境或高频场景下失效——这是验证阶段接受的已知风险
- 不引入额外部署进程（暂不做独立MCP Server）
- 必须兼容现有Next.js App Router + Prisma + SQLite技术栈
- 图片抓取需处理闲鱼CDN图片防盗链（可能需要转存或代理）
