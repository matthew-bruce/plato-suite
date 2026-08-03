import { createElement, Fragment, type ReactNode } from 'react'

// Implemented with createElement rather than JSX sugar so this file can be
// imported directly by tests: the app's tsconfig sets jsx:"preserve" (Next.js
// does the JSX transform downstream), which esbuild/vitest's zero-config
// transform cannot handle on its own. No JSX syntax in the file at all sides
// steps that entirely — output is unchanged either way.
export function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return createElement(
    Fragment,
    null,
    text.slice(0, idx),
    createElement(
      'mark',
      {
        style: {
          background: 'var(--rmg-color-tint-yellow)',
          color: 'inherit',
          borderRadius: '2px',
          padding: '0 2px',
        },
      },
      text.slice(idx, idx + query.length),
    ),
    text.slice(idx + query.length),
  )
}
