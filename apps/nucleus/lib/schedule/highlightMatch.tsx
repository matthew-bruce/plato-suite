import type { ReactNode } from 'react'

export function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{
          background: 'var(--rmg-color-tint-yellow)',
          color: 'inherit',
          borderRadius: '2px',
          padding: '0 2px',
        }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}
