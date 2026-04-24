import { describe, it, expect } from 'vitest'
import { getPlaceholderImageUrl, getProductImageUrl } from '../placeholder'

describe('placeholder', () => {
  describe('getPlaceholderImageUrl', () => {
    it('returns valid URL for known category', () => {
      const url = getPlaceholderImageUrl('数码')
      expect(url).toContain('https://placehold.co/400x400/')
      expect(url).toContain('text=')
    })

    it('returns URL with title text when provided', () => {
      const url = getPlaceholderImageUrl('数码', 'iPhone')
      // title is sliced to 4 chars then URI-encoded
      expect(url).toContain('text=iPho')
    })

    it('truncates long title to 4 chars', () => {
      const url = getPlaceholderImageUrl('数码', 'iPhone15ProMax')
      expect(url).toContain('text=iPho')  // first 4 chars
    })

    it('falls back to category text when no title', () => {
      const url = getPlaceholderImageUrl('服饰')
      expect(url).toContain('text=%E6%9C%8D%E9%A5%B0')  // URI encoded 服饰
    })

    it('handles unknown category with default colors', () => {
      const url = getPlaceholderImageUrl('unknown_category')
      // Should not throw, uses '其他' fallback
      expect(url).toContain('https://placehold.co/400x400/')
    })

    it('all known categories produce valid URLs', () => {
      const categories = ['数码', '服饰', '家居', '图书', '其他']
      for (const cat of categories) {
        const url = getPlaceholderImageUrl(cat, 'test')
        expect(url).toMatch(/^https:\/\/placehold\.co\/400x400\/[0-9a-f]{6}\/[0-9a-f]{6}\?text=/)
      }
    })
  })

  describe('getProductImageUrl', () => {
    it('returns first image if array has http images', () => {
      const result = getProductImageUrl(
        ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        '数码',
        'test'
      )
      expect(result).toBe('https://example.com/img1.jpg')
    })

    it('returns first image if starts with /', () => {
      const result = getProductImageUrl(
        ['/product-images/abc.jpg'],
        '数码',
        'test'
      )
      expect(result).toBe('/product-images/abc.jpg')
    })

    it('returns placeholder for empty array', () => {
      const result = getProductImageUrl([], '数码', 'test')
      expect(result).toContain('placehold.co')
    })

    it('returns placeholder for non-array input', () => {
      const result = getProductImageUrl('not-an-array', '数码', 'test')
      expect(result).toContain('placehold.co')
    })

    it('returns placeholder for null/undefined', () => {
      const result1 = getProductImageUrl(null, '数码', 'test')
      const result2 = getProductImageUrl(undefined, '数码', 'test')
      expect(result1).toContain('placehold.co')
      expect(result2).toContain('placehold.co')
    })

    it('only checks first element (arr[0]), not iterating', () => {
      // Source only checks arr[0] — null/falsy first element falls through to placeholder
      const result = getProductImageUrl(
        [null, '/real-image.jpg'],
        '数码',
        'test'
      )
      // arr[0] is null (falsy) → falls back to placeholder
      expect(result).toContain('placehold.co')
    })

    it('returns first valid image when arr[0] is valid', () => {
      const result = getProductImageUrl(
        ['/real-image.jpg', null, undefined, ''],
        '数码',
        'test'
      )
      expect(result).toBe('/real-image.jpg')
    })
  })
})
