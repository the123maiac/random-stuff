import { describe, it, expect } from 'vitest'
import { extractHtml } from './extract-html'

describe('extractHtml', () => {
  it('extracts the contents of an ```html fenced block', () => {
    const raw = 'Here you go:\n```html\n<!DOCTYPE html><html><body>hi</body></html>\n```\nEnjoy!'
    expect(extractHtml(raw)).toBe('<!DOCTYPE html><html><body>hi</body></html>')
  })

  it('extracts a generic fenced block when no language is given', () => {
    const raw = '```\n<html><body>x</body></html>\n```'
    expect(extractHtml(raw)).toBe('<html><body>x</body></html>')
  })

  it('slices a raw document out of surrounding prose', () => {
    const raw = 'Sure! <!DOCTYPE html><html><body>app</body></html> Let me know if you want changes.'
    expect(extractHtml(raw)).toBe('<!DOCTYPE html><html><body>app</body></html>')
  })

  it('handles a bare <html> document without a doctype', () => {
    const raw = 'Done.\n<html><head></head><body>z</body></html>'
    expect(extractHtml(raw)).toBe('<html><head></head><body>z</body></html>')
  })

  it('returns the first fenced block when several are present', () => {
    const raw = '```html\n<html>1</html>\n```\nand\n```html\n<html>2</html>\n```'
    expect(extractHtml(raw)).toBe('<html>1</html>')
  })

  it('falls back to the trimmed input when there are no markers', () => {
    expect(extractHtml('   just text   ')).toBe('just text')
  })
})
