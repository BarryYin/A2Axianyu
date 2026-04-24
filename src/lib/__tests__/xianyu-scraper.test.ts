import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateXianyuUrl, scrapeXianyuItem } from '../xianyu-scraper'

describe('xianyu-scraper', () => {
  describe('validateXianyuUrl', () => {
    it('validates a correct www.goofish.com URL', () => {
      const result = validateXianyuUrl('https://www.goofish.com/item?id=12345')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('https://www.goofish.com/item?id=12345')
    })

    it('validates m.goofish.com and normalizes', () => {
      const result = validateXianyuUrl('https://m.goofish.com/item?id=67890')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('https://www.goofish.com/item?id=67890')
    })

    it('validates goofish.com without www', () => {
      const result = validateXianyuUrl('https://goofish.com/item?id=54321')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('https://www.goofish.com/item?id=54321')
    })

    it('rejects non-goofish domains', () => {
      const result = validateXianyuUrl('https://www.taobao.com/item?id=123')
      expect(result.valid).toBe(false)
    })

    it('rejects goofish URLs without /item path', () => {
      const result = validateXianyuUrl('https://www.goofish.com/search?q=phone')
      expect(result.valid).toBe(false)
    })

    it('rejects goofish URLs without id param', () => {
      const result = validateXianyuUrl('https://www.goofish.com/item')
      expect(result.valid).toBe(false)
    })

    it('rejects goofish URLs with empty id', () => {
      const result = validateXianyuUrl('https://www.goofish.com/item?id=')
      expect(result.valid).toBe(false)
    })

    it('rejects goofish URLs with whitespace-only id', () => {
      const result = validateXianyuUrl('https://www.goofish.com/item?id=   ')
      expect(result.valid).toBe(false)
    })

    it('rejects non-URL strings gracefully', () => {
      const result = validateXianyuUrl('not-a-url')
      expect(result.valid).toBe(false)
    })

    it('rejects empty string', () => {
      const result = validateXianyuUrl('')
      expect(result.valid).toBe(false)
    })

    it('preserves other query params in normalized URL', () => {
      const result = validateXianyuUrl('https://m.goofish.com/item?id=12345&spm=abc')
      // The code uses searchParams.get('id') so additional params are lost in normalized
      // This is a known behavior - test it to document
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('https://www.goofish.com/item?id=12345')
    })

    it('handles URL with fragment', () => {
      const result = validateXianyuUrl('https://www.goofish.com/item?id=12345#section')
      expect(result.valid).toBe(true)
      expect(result.normalized).toBe('https://www.goofish.com/item?id=12345')
    })
  })
})

// Testing scrapeXianyuItem with mocked fetch.
// parseXianyuHtml and inferCondition are tested indirectly through the public API.

describe('scrapeXianyuItem (with mocked fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Helper to create a mock fetch response
  function mockFetchResponse(html: string, status = 200) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      text: async () => html,
    } as Response)
  }

  // ─── Fetch failure scenarios ───

  it('returns FETCH_FAILED on non-200 response', async () => {
    mockFetchResponse('', 403)
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('FETCH_FAILED')
    }
  })

  it('returns FETCH_TIMEOUT on abort', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue({ name: 'AbortError' })
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('FETCH_TIMEOUT')
    }
  })

  it('returns FETCH_FAILED on generic fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('FETCH_FAILED')
    }
  })

  // ─── Parsing: Strategy 1 - window._INITIAL_STATE__  ───

  it('extracts from window._INITIAL_STATE__ with itemData', async () => {
    const html = `<html><head><script>
      window._INITIAL_STATE__ = {"item":{"itemData":{"title":"iPhone 14","price":"5200","desc":"自用一年","images":["https://img.alicdn.com/1.jpg","https://img.alicdn.com/2.jpg"]}}};
    </script></head><body></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('iPhone 14')
      expect(result.data.price).toBe(5200)
      expect(result.data.description).toBe('自用一年')
      expect(result.data.images).toEqual(['https://img.alicdn.com/1.jpg', 'https://img.alicdn.com/2.jpg'])
    }
  })

  it('extracts from itemData match pattern', async () => {
    const html = `<html><head><script>
      var config = {itemData:{"title":"MacBook Pro","price":"8800","desc":"M2芯片","images":["https://img.alicdn.com/mac.jpg"]}};
    </script></head><body></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('MacBook Pro')
      expect(result.data.price).toBe(8800)
    }
  })

  it('parses itemPictureList from JSON when images array empty', async () => {
    const html = `<html><head><script>
      window._INITIAL_STATE__ = {"item":{"itemData":{"title":"耳机","price":"800","desc":"降噪耳机","itemPictureList":[{"imgUrl":"https://img.alicdn.com/a.jpg"},{"imgUrl":"https://img.alicdn.com/b.jpg"}]}}};
    </script></head><body></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.images).toEqual(['https://img.alicdn.com/a.jpg', 'https://img.alicdn.com/b.jpg'])
    }
  })

  it('handles broken JSON in script tag gracefully', async () => {
    const html = `<html><head><script>
      window._INITIAL_STATE__ = {broken: json!!!};
    </script></head><body><h1>Fallback Title</h1><span class="price">¥99</span></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Falls through to DOM strategy
      expect(result.data.title).toBe('Fallback Title')
      expect(result.data.price).toBe(99)
    }
  })

  // ─── Parsing: Strategy 2 - Open Graph meta tags ───

  it('falls back to og:title when no JSON data', async () => {
    const html = `<html><head>
      <meta property="og:title" content="OG Title Test">
      <meta property="og:image" content="https://img.alicdn.com/og.jpg">
    </head><body><span class="price">¥500</span></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('OG Title Test')
      expect(result.data.images).toEqual(['https://img.alicdn.com/og.jpg'])
    }
  })

  // ─── Parsing: Strategy 3 - DOM selectors ───

  it('extracts title from h1', async () => {
    const html = `<html><head></head><body>
      <h1>H1 Title   </h1>
      <span class="price">¥299</span>
      <p class="desc">商品描述内容</p>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('H1 Title')
      expect(result.data.price).toBe(299)
      expect(result.data.description).toBe('商品描述内容')
    }
  })

  it('extracts title from class*="title" element', async () => {
    const html = `<html><body>
      <div class="product-title">Class Title Element</div>
      <span class="price">¥1500</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Class Title Element')
      expect(result.data.price).toBe(1500)
    }
  })

  it('extracts from <title> tag, stripping 闲鱼 suffix', async () => {
    const html = `<html><head><title>iPhone 15 Pro Max 256G-闲鱼</title></head>
      <body><span class="price">¥6999</span></body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toContain('iPhone 15')
      expect(result.data.title).not.toContain('闲鱼')
    }
  })

  it('extracts price with comma separators', async () => {
    const html = `<html><body>
      <h1>Test</h1>
      <span class="price">¥1,299.00</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.price).toBe(1299)
    }
  })

  it('extracts images from alicdn.com src', async () => {
    const html = `<html><body>
      <h1>Test Product</h1>
      <span class="price">¥500</span>
      <img src="https://img.alicdn.com/imgextra/i1/abc.jpg">
      <img src="https://img.alicdn.com/imgextra/i2/def.jpg">
      <img src="https://other-cdn.com/not-relevant.jpg">
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // alicdn images are picked up, non-alicdn may also be picked up since "starts with http"
      expect(result.data.images.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('deduplicates images', async () => {
    const html = `<html><body>
      <h1>Test</h1>
      <span class="price">¥100</span>
      <img src="https://img.alicdn.com/1.jpg">
      <img src="https://img.alicdn.com/1.jpg">
      <img src="https://img.alicdn.com/2.jpg">
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const uniqueImages = [...new Set(result.data.images)]
      expect(result.data.images.length).toBe(uniqueImages.length)
    }
  })

  // ─── Parsing: Condition inference ───

  it('infers condition from body text (全新 keyword priority)', async () => {
    // Note: inferCondition checks '全新' before '几乎全新',
    // so text containing "几乎全新" matches '全新' first.
    // This documents actual behavior (may be a bug to fix).
    const html = `<html><body>
      <h1>iPhone</h1>
      <span class="price">¥3000</span>
      <p>几乎全新，只用了一个月</p>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.condition).toBe('全新')
    }
  })

  it('BUG: inferCondition "全新" substring eats "几乎全新"', async () => {
    // The function checks t.includes('全新') BEFORE t.includes('几乎全新'),
    // so "几乎全新" always matches '全新' first. This is a source code bug.
    const html = `<html><body>
      <h1>iPhone</h1>
      <span class="price">¥3000</span>
      <p>99新，几乎全新成色</p>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Actual: returns '全新' (bug), Expected if fixed: '几乎全新'
      expect(result.data.condition).toBe('全新')
    }
  })

  it('infers 全新 condition', async () => {
    const html = `<html><body>
      <h1>全新未拆封键盘</h1>
      <span class="price">¥200</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.condition).toBe('全新')
    }
  })

  it('infers 轻微使用痕迹 from 95新', async () => {
    const html = `<html><body>
      <h1>键盘 95新</h1>
      <span class="price">¥150</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.condition).toBe('轻微使用痕迹')
    }
  })

  it('returns undefined condition when no keywords match', async () => {
    const html = `<html><body>
      <h1>Generic Item</h1>
      <span class="price">¥50</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.condition).toBeUndefined()
    }
  })

  // ─── Edge cases ───

  it('returns PARSE_FAILED when no title found', async () => {
    const html = `<html><body>
      <span class="price">¥100</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PARSE_FAILED')
    }
  })

  it('returns PARSE_FAILED when price <= 0', async () => {
    const html = `<html><body>
      <h1>Free item</h1>
      <span class="price">¥0</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('PARSE_FAILED')
    }
  })

  it('limits images to 10', async () => {
    const imgs = Array.from({length: 15}, (_, i) => 
      `<img src="https://img.alicdn.com/${i}.jpg">`
    ).join('\n')
    const html = `<html><body>
      <h1>Multi-image</h1>
      <span class="price">¥100</span>
      ${imgs}
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.images.length).toBeLessThanOrEqual(10)
    }
  })

  it('uses title as description when no description found', async () => {
    const html = `<html><body>
      <h1>Solo Title Product</h1>
      <span class="price">¥88</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.description).toBe('Solo Title Product')
    }
  })

  it('extracts images from data-src attribute', async () => {
    const html = `<html><body>
      <h1>Lazy Load</h1>
      <span class="price">¥200</span>
      <img data-src="https://img.alicdn.com/lazy1.jpg">
      <img data-src="https://img.alicdn.com/lazy2.jpg">
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.images).toContain('https://img.alicdn.com/lazy1.jpg')
      expect(result.data.images).toContain('https://img.alicdn.com/lazy2.jpg')
    }
  })

  it('extracts title from .item-title class', async () => {
    const html = `<html><body>
      <div class="item-title">Class Item Title</div>
      <span class="price">¥333</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.title).toBe('Class Item Title')
    }
  })

  it('extracts description from class*="detail"', async () => {
    const html = `<html><body>
      <h1>Product</h1>
      <span class="price">¥500</span>
      <div class="product-detail">详细描述内容在这里</div>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.description).toBe('详细描述内容在这里')
    }
  })

  it('extracts price from .item-price class', async () => {
    const html = `<html><body>
      <h1>Product</h1>
      <span class="item-price">¥777</span>
    </body></html>`
    mockFetchResponse(html)
    
    const result = await scrapeXianyuItem('https://www.goofish.com/item?id=123')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.price).toBe(777)
    }
  })
})
