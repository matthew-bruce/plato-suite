import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { highlightMatch } from '../highlightMatch'

// Rendered to static HTML so assertions can check the actual <mark> markup
// and the token it carries, not just the ReactNode shape.
function render(text: string, query: string): string {
  return renderToStaticMarkup(highlightMatch(text, query) as ReactElement | string)
}

describe('highlightMatch', () => {
  it('returns the plain text unchanged when the query is empty', () => {
    expect(render('Sarah Ashton', '')).toBe('Sarah Ashton')
  })

  it('returns the plain text unchanged when there is no match', () => {
    expect(render('Sarah Ashton', 'xyz')).toBe('Sarah Ashton')
  })

  it('wraps the matched substring in a <mark> using the tint-yellow token — never the restricted core yellow', () => {
    const html = render('Sarah Ashton', 'ash')
    expect(html).toContain('<mark')
    expect(html).toContain('background:var(--rmg-color-tint-yellow)')
    expect(html).not.toContain('--rmg-color-yellow)')
  })

  it('matches case-insensitively but preserves the original casing of the matched text', () => {
    const html = render('Helion', 'hel')
    expect(html).toContain('<mark')
    expect(html).toContain('>Hel<')
  })

  it('highlights only the first occurrence when the query appears multiple times', () => {
    const html = render('ana banana', 'ana')
    expect((html.match(/<mark/g) ?? []).length).toBe(1)
    // First occurrence is at index 0 ("ana banana"), so nothing precedes the mark.
    expect(html.startsWith('<mark')).toBe(true)
  })
})
