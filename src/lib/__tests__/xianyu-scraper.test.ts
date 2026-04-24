import { describe, it, expect } from 'vitest'
import { validateXianyuUrl } from '../xianyu-scraper'

describe('validateXianyuUrl', () => {
  it('accepts valid goofish item URLs', () => {
    const result = validateXianyuUrl('https://www.goofish.com/item?id=123456')
    expect(result.valid).toBe(true)
    expect(result.normalized).toBe('https://www.goofish.com/item?id=123456')
  })

  it('normalizes m.goofish.com to www.goofish.com', () => {
    const result = validateXianyuUrl('https://m.goofish.com/item?id=123456')
    expect(result.valid).toBe(true)
    expect(result.normalized).toBe('https://www.goofish.com/item?id=123456')
  })

  it('rejects non-goofish domains', () => {
    const result = validateXianyuUrl('https://example.com/item?id=123')
    expect(result.valid).toBe(false)
  })

  it('rejects URLs without item id', () => {
    const result = validateXianyuUrl('https://www.goofish.com/item')
    expect(result.valid).toBe(false)
  })

  it('rejects taobao口令', () => {
    const result = validateXianyuUrl('https://m.tb.cn/h.abc123')
    expect(result.valid).toBe(false)
  })
})
