import { NextRequest } from 'next/server'

const API_BASE = process.env.SECONDME_API_BASE_URL

export async function fetchFromSecondMe(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`SecondMe API error: ${response.status}`)
  }

  return response.json()
}

export async function getUserInfo(accessToken: string) {
  return fetchFromSecondMe('/api/secondme/user/info', accessToken)
}

export async function getUserShades(accessToken: string) {
  return fetchFromSecondMe('/api/secondme/user/shades', accessToken)
}

export async function chatWithAI(
  accessToken: string,
  message: string,
  options?: {
    sessionId?: string
    actionControl?: any
  }
) {
  const body: any = {
    message,
    stream: true,
  }

  if (options?.sessionId) {
    body.sessionId = options.sessionId
  }

  if (options?.actionControl) {
    body.actionControl = options.actionControl
  }

  const response = await fetch(`${API_BASE}/api/secondme/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Chat API error: ${response.status}`)
  }

  return response
}

export async function addNote(accessToken: string, content: string) {
  return fetchFromSecondMe('/api/secondme/note/add', accessToken, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

/** AI 建议发布哪些闲置商品（根据用户画像），含图片描述供占位/生成图用 */
export async function actSuggestProducts(accessToken: string) {
  const message = `你回忆一下自己有哪些闲置物品可以出售。请根据你的记忆和偏好，列出 1-3 件你可能想出售的二手物品，包括名称、描述、合理标价、最低接受价，以及一句简短的图片描述（用于展示商品图）。`
  const actionControl = `仅输出合法 JSON 数组，不要解释。
输出结构：[{"title": string, "description": string, "price": number, "minPrice": number, "category": "数码"|"服饰"|"家居"|"图书"|"其他", "condition": "全新"|"几乎全新"|"轻微使用痕迹"|"明显使用痕迹", "imagePrompt": string}]。
imagePrompt 为一句简短的英文描述该物品外观，例如 "a used mechanical keyboard on white desk"，用于生成或展示商品图。如果你想不出闲置物品，返回空数组 []。`

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, actionControl }),
  })
  if (!res.ok) throw new Error(`Act API error: ${res.status}`)
  const text = await res.text()
  let jsonStr = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (data === '[DONE]') break
    try {
      const obj = JSON.parse(data)
      const content = obj.choices?.[0]?.delta?.content
      if (content) jsonStr += content
    } catch {
      // ignore
    }
  }
  try {
    const arr = JSON.parse(jsonStr || '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    const match = jsonStr.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* ignore */ }
    }
  }
  return []
}

/** AI 从一批商品中挑选感兴趣的（返回感兴趣的 id 列表） */
export async function actPickProducts(
  accessToken: string,
  products: { id: string; title: string; price: number; category: string; condition: string }[]
) {
  const listStr = products.map((p, i) => `${i + 1}. [${p.id}] ${p.title} ¥${p.price}（${p.category}，${p.condition}）`).join('\n')
  const message = `你在逛一个二手市场，以下是当前在售商品：\n${listStr}\n\n请根据你的兴趣和需求，挑出你想进一步谈价的商品。`
  const actionControl = `仅输出合法 JSON，不要解释。
输出结构：{"picks": [{"id": string, "reason": string}]}。
picks 数组包含你感兴趣的商品 id 和简短原因。如果都不感兴趣，返回 {"picks": []}。`

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, actionControl }),
  })
  if (!res.ok) throw new Error(`Act API error: ${res.status}`)
  const parsed = await parseActStream(res)
  const picks = Array.isArray(parsed.picks) ? parsed.picks : []
  return picks as { id: string; reason: string }[]
}

/** Act 议价：根据商品信息返回是否感兴趣与建议出价 */
export async function actBargain(
  accessToken: string,
  params: { productTitle: string; productPrice: number; minPrice?: number }
) {
  const message = `商品：${params.productTitle}，标价 ${params.productPrice} 元${params.minPrice != null ? `，卖家最低接受 ${params.minPrice} 元` : ''}。你作为买家，对这件商品感兴趣吗？若感兴趣请给出建议出价，不感兴趣就说明原因。`
  const actionControl = `仅输出合法 JSON，不要解释。
输出结构：{"suggestedPrice": number, "reason": string}。
若感兴趣：suggestedPrice 为建议出价（大于 0），在合理范围内低于标价，若已知最低价则不低于最低价；reason 简短说明。
若不感兴趣：suggestedPrice 填 0，reason 说明不感兴趣的原因。`

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, actionControl }),
  })
  if (!res.ok) throw new Error(`Act API error: ${res.status}`)
  const text = await res.text()
  let jsonStr = ''
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      if (data === '[DONE]') break
      try {
        const obj = JSON.parse(data)
        const content = obj.choices?.[0]?.delta?.content
        if (content) jsonStr += content
      } catch {
        // ignore non-json lines
      }
    }
  }
  let parsed: { suggestedPrice?: number; reason?: string } = {}
  try {
    parsed = JSON.parse(jsonStr || '{}') as { suggestedPrice?: number; reason?: string }
  } catch {
    // 流式可能分片，尝试取最后一段合法 JSON
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as { suggestedPrice?: number; reason?: string }
      } catch {
        // ignore
      }
    }
  }
  return { suggestedPrice: parsed.suggestedPrice, reason: parsed.reason ?? '' }
}

/** 解析 Act SSE 返回的 JSON */
async function parseActStream(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  let jsonStr = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (data === '[DONE]') break
    try {
      const obj = JSON.parse(data)
      const content = obj.choices?.[0]?.delta?.content
      if (content) jsonStr += content
    } catch {
      // ignore
    }
  }
  try {
    return JSON.parse(jsonStr || '{}') as Record<string, unknown>
  } catch {
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>
      } catch {
        // ignore
      }
    }
  }
  return {}
}

/** 卖家 AI 决策：接受 / 还价 / 拒绝 */
export async function actSellerDecision(
  accessToken: string,
  params: {
    productTitle: string
    listPrice: number
    minPrice?: number
    offerPrice: number
  }
) {
  const message = `你的闲置「${params.productTitle}」标价 ${params.listPrice} 元${params.minPrice != null ? `，你的心理底价 ${params.minPrice} 元` : ''}。有人出价 ${params.offerPrice} 元。请决定：接受、还价或拒绝。`
  const actionControl = `仅输出合法 JSON，不要解释。
输出结构：{"decision": "accept"|"counter"|"reject", "counterPrice": number 或省略, "reason": string}。
decision 为 accept 表示接受当前出价；counter 表示还价，此时必须给出 counterPrice（你的还价）；reject 表示拒绝。`

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, actionControl }),
  })
  if (!res.ok) throw new Error(`Act API error: ${res.status}`)
  const parsed = await parseActStream(res)
  const decision = String(parsed.decision ?? '').toLowerCase()
  const counterPrice = parsed.counterPrice != null ? Number(parsed.counterPrice) : undefined
  const reason = String(parsed.reason ?? '')
  return {
    decision: decision === 'accept' || decision === 'counter' || decision === 'reject' ? decision : 'reject',
    counterPrice: decision === 'counter' ? counterPrice : undefined,
    reason,
  }
}

/** 买家 AI 对卖家还价的回应 */
export async function actBuyerResponse(
  accessToken: string,
  params: {
    productTitle: string
    listPrice: number
    sellerCounterPrice: number
  }
) {
  const message = `你想买的「${params.productTitle}」标价 ${params.listPrice} 元，卖家还价到 ${params.sellerCounterPrice} 元。请决定：接受、继续还价或放弃。`
  const actionControl = `仅输出合法 JSON，不要解释。
输出结构：{"decision": "accept"|"counter"|"reject", "counterPrice": number 或省略, "reason": string}。
decision 为 accept 表示接受卖家还价；counter 表示继续还价，此时必须给出 counterPrice；reject 表示放弃。`

  const res = await fetch(`${API_BASE}/api/secondme/act/stream`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, actionControl }),
  })
  if (!res.ok) throw new Error(`Act API error: ${res.status}`)
  const parsed = await parseActStream(res)
  const decision = String(parsed.decision ?? '').toLowerCase()
  const counterPrice = parsed.counterPrice != null ? Number(parsed.counterPrice) : undefined
  const reason = String(parsed.reason ?? '')
  return {
    decision: decision === 'accept' || decision === 'counter' || decision === 'reject' ? decision : 'reject',
    counterPrice: decision === 'counter' ? counterPrice : undefined,
    reason,
  }
}