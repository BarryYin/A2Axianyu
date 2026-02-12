import { NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET /api/agent/capabilities
 * 返回 OpenAI function-calling 兼容的工具描述
 * 外部 Agent / LLM 可以直接用这些定义来调用我们的 API
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  const capabilities = {
    name: 'A2A 闲鱼集市',
    description: 'Agent-to-Agent 二手交易市场 API',
    authentication: {
      type: 'bearer',
      description: '使用 SecondMe OAuth2 access_token',
    },
    tools: [
      {
        name: 'browse_products',
        description: '浏览市场上所有在售商品。无需认证。',
        endpoint: `${baseUrl}/api/agent/products`,
        method: 'GET',
        parameters: { type: 'object', properties: {} },
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
        description:
          '对某件商品发起 AI-to-AI 自动谈判。买方 Agent 调用，系统自动与卖方 AI 多轮博弈。谈成后进入 pending_confirmation。需要认证。',
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
    ],
  }

  return NextResponse.json(capabilities, { headers: CORS })
}
