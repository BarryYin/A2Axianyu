// StepFun AI 服务封装
// 前端不直接暴露 API 配置，所有调用通过服务端完成

const AI_API_URL = process.env.AI_API_URL || 'https://api.stepfun.com/v1/chat/completions'
const AI_API_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL || 'step-3.5-flash'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callAI(messages: ChatMessage[], temperature = 0.7): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error('AI API Key not configured')
  }

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature,
      stream: false,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/** AI 建议发布哪些闲置商品（根据用户提示） */
export async function actSuggestProducts(userHint?: string): Promise<Array<{
  title: string
  description: string
  price: number
  minPrice: number | null
  category: string
  condition: string
  imagePrompt: string
}>> {
  const hintPart = userHint
    ? `用户提供了以下信息："${userHint}"。请根据这些信息，帮他补充完善商品详情（标题、描述、合理标价、最低接受价等）。如果用户信息不完整，你可以根据自己的判断来补充。`
    : `请帮用户想一些常见的闲置物品出售。`

  const systemPrompt = `你是一个二手商品交易助手，帮助用户发布闲置物品。请根据用户提示，生成 1-3 件可能想出售的二手商品建议。`

  const userPrompt = `${hintPart}
请列出 1-3 件二手商品建议，包括名称、描述、合理标价、最低接受价、分类、成色，以及一句简短的英文图片描述（用于搜索商品图）。

仅输出合法 JSON 数组，不要解释。
输出结构：
[{
  "title": "商品名称",
  "description": "商品描述",
  "price": 100,
  "minPrice": 80,
  "category": "数码" | "服饰" | "家居" | "图书" | "其他",
  "condition": "全新" | "几乎全新" | "轻微使用痕迹" | "明显使用痕迹",
  "imagePrompt": "英文图片描述，如 a used mechanical keyboard"
}]

如果想不出商品，返回空数组 []。`

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const arr = JSON.parse(content)
    return Array.isArray(arr) ? arr : []
  } catch (err) {
    console.error('AI suggest products error:', err)
    // 返回模拟数据作为 fallback
    return [
      {
        title: '机械键盘',
        description: 'Cherry红轴，使用半年，功能完好',
        price: 299,
        minPrice: 250,
        category: '数码',
        condition: '轻微使用痕迹',
        imagePrompt: 'a used mechanical keyboard on white desk',
      },
    ]
  }
}

/** AI 从一批商品中挑选感兴趣的（返回感兴趣的 id 列表） */
export async function actPickProducts(
  products: { id: string; title: string; price: number; category: string; condition: string }[]
): Promise<{ id: string; reason: string }[]> {
  const listStr = products.map((p, i) => `${i + 1}. [${p.id}] ${p.title} ¥${p.price}（${p.category}，${p.condition}）`).join('\n')

  const systemPrompt = `你是一个二手市场买家助手，帮助用户挑选感兴趣的商品。`
  const userPrompt = `你在逛一个二手市场，以下是当前在售商品：
${listStr}

请根据一般买家的兴趣，挑出 1-3 个可能感兴趣的商品。

仅输出合法 JSON，不要解释。
输出结构：{"picks": [{"id": "商品ID", "reason": "简短原因"}]}
如果都不感兴趣，返回 {"picks": []}。`

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = JSON.parse(content)
    return Array.isArray(parsed.picks) ? parsed.picks : []
  } catch (err) {
    console.error('AI pick products error:', err)
    // 返回第一个商品作为 fallback
    return products.length > 0 ? [{ id: products[0].id, reason: '看起来不错' }] : []
  }
}

/** 买家 AI 首轮出价 */
export async function actBargain(params: {
  productTitle: string
  productPrice: number
  minPrice?: number
}): Promise<{ suggestedPrice: number; reason: string }> {
  const systemPrompt = `你是一个二手市场买家助手，帮助用户对感兴趣的商品出价。`
  const userPrompt = `商品：${params.productTitle}，标价 ${params.productPrice} 元${params.minPrice != null ? `，卖家最低接受 ${params.minPrice} 元` : ''}。

作为买家，请给出建议出价。价格应该略低于标价，但如果已知最低价则不应低于最低价。

仅输出合法 JSON，不要解释。
输出结构：{"suggestedPrice": 出价金额, "reason": "简短说明"}
suggestedPrice 必须是大于0的数字。如果不感兴趣，suggestedPrice填0。`

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = JSON.parse(content)
    return {
      suggestedPrice: Number(parsed.suggestedPrice) || Math.floor(params.productPrice * 0.85),
      reason: parsed.reason || '想试试能不能便宜点',
    }
  } catch (err) {
    console.error('AI bargain error:', err)
    // 返回默认出价（标价的85折）
    return {
      suggestedPrice: Math.floor(params.productPrice * 0.85),
      reason: '想试试能不能便宜点',
    }
  }
}

/** 卖家 AI 决策：接受 / 还价 / 拒绝 */
export async function actSellerDecision(params: {
  productTitle: string
  listPrice: number
  minPrice?: number
  offerPrice: number
}): Promise<{ decision: 'accept' | 'counter' | 'reject'; counterPrice?: number; reason: string }> {
  const systemPrompt = `你是一个二手市场卖家助手，帮助用户决定是否接受买家的出价。`
  const userPrompt = `你的闲置「${params.productTitle}」标价 ${params.listPrice} 元${params.minPrice != null ? `，你的心理底价 ${params.minPrice} 元` : ''}。

买家出价 ${params.offerPrice} 元。请决定：接受(accept)、还价(counter)或拒绝(reject)。

仅输出合法 JSON，不要解释。
输出结构：{"decision": "accept" | "counter" | "reject", "counterPrice": 还价金额(可选), "reason": "简短说明"}
- accept: 接受当前出价
- counter: 还价，必须给出 counterPrice
- reject: 拒绝出价

如果出价低于心理底价的80%，建议拒绝；
如果出价接近或高于心理底价，建议接受；
其他情况可以还价。`

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = JSON.parse(content)
    const decision = String(parsed.decision).toLowerCase() as 'accept' | 'counter' | 'reject'

    if (decision === 'accept' || decision === 'counter' || decision === 'reject') {
      return {
        decision,
        counterPrice: decision === 'counter' ? Number(parsed.counterPrice) : undefined,
        reason: parsed.reason || '',
      }
    }

    // 默认返回还价
    return {
      decision: 'counter',
      counterPrice: Math.floor((params.listPrice + params.offerPrice) / 2),
      reason: '价格可以再商量',
    }
  } catch (err) {
    console.error('AI seller decision error:', err)
    // 默认还价
    return {
      decision: 'counter',
      counterPrice: Math.floor((params.listPrice + params.offerPrice) / 2),
      reason: '价格可以再商量',
    }
  }
}

/** 买家 AI 对卖家还价的回应 */
export async function actBuyerResponse(params: {
  productTitle: string
  listPrice: number
  sellerCounterPrice: number
}): Promise<{ decision: 'accept' | 'counter' | 'reject'; counterPrice?: number; reason: string }> {
  const systemPrompt = `你是一个二手市场买家助手，帮助用户决定是否接受卖家的还价。`
  const userPrompt = `你想买的「${params.productTitle}」标价 ${params.listPrice} 元，卖家还价到 ${params.sellerCounterPrice} 元。

请决定：接受(accept)、继续还价(counter)或放弃(reject)。

仅输出合法 JSON，不要解释。
输出结构：{"decision": "accept" | "counter" | "reject", "counterPrice": 还价金额(可选), "reason": "简短说明"}
- accept: 接受卖家还价
- counter: 继续还价，必须给出 counterPrice（比卖家还价略低）
- reject: 放弃购买

如果卖家还价在标价90%以内，建议接受；
如果差价不大，可以稍微还一点；
如果差距太大，建议放弃。`

  try {
    const content = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = JSON.parse(content)
    const decision = String(parsed.decision).toLowerCase() as 'accept' | 'counter' | 'reject'

    if (decision === 'accept' || decision === 'counter' || decision === 'reject') {
      return {
        decision,
        counterPrice: decision === 'counter' ? Number(parsed.counterPrice) : undefined,
        reason: parsed.reason || '',
      }
    }

    // 默认接受
    return {
      decision: 'accept',
      reason: '价格可以接受',
    }
  } catch (err) {
    console.error('AI buyer response error:', err)
    // 默认接受
    return {
      decision: 'accept',
      reason: '价格可以接受',
    }
  }
}
