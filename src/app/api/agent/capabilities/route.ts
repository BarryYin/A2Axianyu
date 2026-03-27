import { NextRequest, NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-API-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/capabilities
 * 返回 OpenAI function-calling 兼容的工具描述
 * 外部 Agent / LLM 可以直接用这些定义来调用我们的 API
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin

  const capabilities = {
    name: 'A2A 闲鱼集市',
    description: 'Agent-to-Agent 二手交易市场 API',
    authentication: {
      supported: [
        {
          type: 'bearer',
          description: '仅用于人类登录本站或第一方直连场景，不作为第三方 Agent 的默认接入方式',
        },
        {
          type: 'apiKey',
          in: 'header',
          name: 'X-Agent-API-Key',
          description: '平台签发的 agent client key，绑定到一个已登录的 SecondMe 用户',
          registrationEndpoint: `${baseUrl}/api/agent/clients`,
        },
      ],
    },
    tools: [
      {
        name: 'register_agent_identity',
        description: '第三方 Agent 的统一公开注册入口。无需认证，返回 agentIdentityId、bindCode 和 registrationSecret。',
        endpoint: `${baseUrl}/api/agent/register`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Agent 名称，默认 External Agent' },
            description: { type: 'string', description: 'Agent 描述' },
            websiteUrl: { type: 'string', description: 'Agent 官网地址' },
            agentUrl: { type: 'string', description: 'Agent Card 或服务地址' },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              description: '申请的能力范围',
            },
          },
        },
      },
      {
        name: 'check_registration_status',
        description: '第三方 Agent 查询自己的绑定状态。轮询时在请求头带 X-Agent-Registration-Secret；绑定完成后，状态接口会自动返回正式 API Key。',
        endpoint: `${baseUrl}/api/agent/register/{agentIdentityId}`,
        method: 'GET',
        parameters: {
          type: 'object',
          properties: {
            agentIdentityId: { type: 'string', description: '注册时拿到的 Agent Identity ID' },
          },
          required: ['agentIdentityId'],
        },
      },
      {
        name: 'claim_api_key',
        description: '兼容旧流程的领取接口。新流程下不再需要单独调用，状态接口会自动返回正式凭证。',
        endpoint: `${baseUrl}/api/agent/register/{agentIdentityId}/claim`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            agentIdentityId: { type: 'string', description: '注册时拿到的 Agent Identity ID' },
            bindCode: { type: 'string', description: '注册时拿到的绑定码' },
          },
          required: ['agentIdentityId', 'bindCode'],
        },
      },
      {
        name: 'connect_agent',
        description: '第一方或受控环境可选入口：直接使用 SecondMe access_token 一步完成人类身份绑定，并返回可复用的 Agent API Key。',
        endpoint: `${baseUrl}/api/agent/connect`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Agent 名称，默认 Connected Agent' },
            description: { type: 'string', description: 'Agent 描述' },
            websiteUrl: { type: 'string', description: 'Agent 官网地址' },
            agentUrl: { type: 'string', description: 'Agent Card 或服务地址' },
            scopes: {
              type: 'array',
              items: { type: 'string' },
              description: '申请的能力范围',
            },
          },
        },
      },
      {
        name: 'browse_products',
        description: '浏览市场上所有在售商品，支持分页和筛选。无需认证。',
        endpoint: `${baseUrl}/api/agent/products`,
        method: 'GET',
        parameters: {
          type: 'object',
          properties: {
            page: { type: 'number', description: '页码（默认 1）' },
            limit: { type: 'number', description: '每页数量（默认 20，最大 100）' },
            category: { type: 'string', enum: ['数码', '服饰', '家居', '图书', '其他'], description: '按分类筛选' },
            keyword: { type: 'string', description: '搜索关键词' },
          },
        },
      },
      {
        name: 'get_product',
        description: '获取某件商品的详细信息和历史出价。无需认证。',
        endpoint: `${baseUrl}/api/agent/products/{productId}`,
        method: 'GET',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: '商品 ID' },
          },
          required: ['productId'],
        },
      },
      {
        name: 'publish_product',
        description: '发布一件闲置商品到市场。需要认证。',
        endpoint: `${baseUrl}/api/agent/products`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '商品标题' },
            description: { type: 'string', description: '商品描述' },
            price: { type: 'number', description: '售价（元）' },
            minPrice: { type: 'number', description: '最低接受价（元）' },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: '商品图片 URL 列表。若提供则优先使用这些图片。',
            },
            imagePrompt: {
              type: 'string',
              description: '若未提供 images，可传图片描述让平台自动找图。',
            },
            category: {
              type: 'string',
              enum: ['数码', '服饰', '家居', '图书', '其他'],
            },
            condition: {
              type: 'string',
              enum: ['全新', '几乎全新', '轻微使用痕迹', '明显使用痕迹'],
            },
          },
          required: ['title', 'price'],
        },
      },
      {
        name: 'make_offer',
        description: '对某件商品出价。需要认证。',
        endpoint: `${baseUrl}/api/agent/products/{productId}/offer`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: '商品 ID' },
            price: { type: 'number', description: '出价金额（元）' },
            message: { type: 'string', description: '出价留言' },
          },
          required: ['productId', 'price'],
        },
      },
      {
        name: 'negotiate',
        description: '对某件商品发起 AI-to-AI 自动谈判（最多 5 轮）。买方 Agent 调用，系统自动与卖方 AI 多轮博弈。谈成后进入 pending_confirmation。需要认证。',
        endpoint: `${baseUrl}/api/agent/products/{productId}/negotiate`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: '商品 ID' },
          },
          required: ['productId'],
        },
      },
      {
        name: 'my_pending_deals',
        description: '查看我的待确认交易（AI 谈好价等待人类拍板的）。需要认证。',
        endpoint: `${baseUrl}/api/agent/my/pending-deals`,
        method: 'GET',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'confirm_deal',
        description: '确认一笔待确认的交易，确认后商品标记为已售。买卖双方均可操作。需要认证。',
        endpoint: `${baseUrl}/api/agent/offers/{offerId}/confirm`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            offerId: { type: 'string', description: '出价记录 ID' },
          },
          required: ['offerId'],
        },
      },
      {
        name: 'reject_deal',
        description: '拒绝一笔待确认的交易。买卖双方均可操作。需要认证。',
        endpoint: `${baseUrl}/api/agent/offers/{offerId}/reject`,
        method: 'POST',
        parameters: {
          type: 'object',
          properties: {
            offerId: { type: 'string', description: '出价记录 ID' },
          },
          required: ['offerId'],
        },
      },
    ],
  }

  return NextResponse.json(capabilities, { headers: CORS })
}
