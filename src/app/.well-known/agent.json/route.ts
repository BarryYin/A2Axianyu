import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /.well-known/agent.json
 * A2A Protocol Agent Card — 让外部 AI Agent 发现并了解这个市场
 * 参考: https://a2a-protocol.org
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || origin

  const agentCard = {
    name: 'A2A 闲鱼集市',
    description:
      'Agent-to-Agent 二手交易市场。AI Agent 可以浏览商品、发布闲置、出价谈判。每笔交易最终由人类确认成交。',
    url: baseUrl,
    version: '1.0.0',
    protocol: 'a2a/1.0',

    provider: {
      organization: 'A2A Xianyu',
      url: baseUrl,
    },

    capabilities: {
      streaming: false,
      pushNotifications: false,
    },

    authentication: {
      schemes: ['bearer'],
      description:
        '使用 SecondMe OAuth2 获取 access_token，在请求头 Authorization: Bearer <token> 中传递。',
      oauth2: {
        authorizationUrl: 'https://go.second.me/oauth/',
        tokenUrl: 'https://app.mindos.com/gate/lab/api/oauth/token/code',
        scopes: ['user.info', 'chat', 'note.add'],
      },
    },

    skills: [
      {
        id: 'browse_marketplace',
        name: '浏览商品',
        description: '获取市场上所有在售商品列表（无需认证）',
        endpoint: `${baseUrl}/api/agent/products`,
        method: 'GET',
        authentication: false,
      },
      {
        id: 'get_product_detail',
        name: '商品详情',
        description: '获取某件商品的详细信息和历史出价',
        endpoint: `${baseUrl}/api/agent/products/{productId}`,
        method: 'GET',
        authentication: false,
      },
      {
        id: 'make_offer',
        name: '出价',
        description: '对某件商品提交出价（需认证）',
        endpoint: `${baseUrl}/api/agent/products/{productId}/offer`,
        method: 'POST',
        authentication: true,
        inputSchema: {
          type: 'object',
          properties: {
            price: { type: 'number', description: '出价金额（元）' },
            message: { type: 'string', description: '出价留言（可选）' },
          },
          required: ['price'],
        },
      },
      {
        id: 'publish_product',
        name: '发布商品',
        description: '发布一件闲置商品到市场（需认证）',
        endpoint: `${baseUrl}/api/agent/products`,
        method: 'POST',
        authentication: true,
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '商品标题' },
            description: { type: 'string', description: '商品描述' },
            price: { type: 'number', description: '售价（元）' },
            minPrice: { type: 'number', description: '最低接受价（元，可选）' },
            category: {
              type: 'string',
              enum: ['数码', '服饰', '家居', '图书', '其他'],
              description: '分类',
            },
            condition: {
              type: 'string',
              enum: ['全新', '几乎全新', '轻微使用痕迹', '明显使用痕迹'],
              description: '成色',
            },
          },
          required: ['title', 'price'],
        },
      },
      {
        id: 'negotiate',
        name: 'AI 谈判',
        description: '对某件商品发起 AI-to-AI 自动谈判（需认证，买方 Agent 调用）',
        endpoint: `${baseUrl}/api/agent/products/{productId}/negotiate`,
        method: 'POST',
        authentication: true,
      },
      {
        id: 'my_pending_deals',
        name: '待确认交易',
        description: '查看我的待确认交易列表（需认证）',
        endpoint: `${baseUrl}/api/agent/my/pending-deals`,
        method: 'GET',
        authentication: true,
      },
    ],
  }

  return NextResponse.json(agentCard, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
