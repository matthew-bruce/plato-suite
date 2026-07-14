'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export type ManualDimension = 'DOCUMENTATION' | 'SIGN_OFF'
export type ManualChipState = 'none' | 'progress' | 'done'

const DIMENSION_LABELS: Record<ManualDimension, string> = {
  DOCUMENTATION: 'DOCS',
  SIGN_OFF: 'SIGN-OFF',
}

const STATE_ORDER: ManualChipState[] = ['none', 'progress', 'done']

const STATE_SCORE: Record<ManualChipState, 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'> = {
  none: 'NOT_STARTED',
  progress: 'IN_PROGRESS',
  done: 'DONE',
}

const STATE_TEXT: Record<ManualChipState, string> = {
  none: 'Not started',
  progress: 'In progress',
  done: 'Done',
}

const CHIP_STYLE: Record<ManualChipState, { background: string; color: string }> = {
  done: { background: '#C1E3C1', color: '#1A6B00' },
  progress: { background: '#BEE0F5', color: '#005F8A' },
  none: { background: '#EEEEEE', color: '#8F9495' },
}

// Manual 3-state toggle for RAG dimensions that aren't computable from other
// data (DOCUMENTATION, SIGN_OFF). Click cycles Not started → In progress →
// Done → Not started, upserting straight into tessera_rag_scores.
export function ManualStatusToggle({
  domainId,
  dimension,
  initialState,
}: {
  domainId: string
  dimension: ManualDimension
  initialState: ManualChipState
}) {
  const router = useRouter()
  const [state, setState] = useState<ManualChipState>(initialState)
  const [isPending, startTransition] = useTransition()

  const advance = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Card is wrapped in a <Link> on the Dashboard — stop the click reaching it.
    e.preventDefault()
    e.stopPropagation()
    if (isPending) return

    const previous = state
    const next = STATE_ORDER[(STATE_ORDER.indexOf(state) + 1) % STATE_ORDER.length]
    setState(next)

    startTransition(async () => {
      const { error } = await supabase
        .from('tessera_rag_scores')
        .upsert(
          { domain_id: domainId, dimension, score: STATE_SCORE[next] },
          { onConflict: 'domain_id,dimension' },
        )
      if (error) {
        console.error('[ManualStatusToggle] upsert failed:', error)
        setState(previous)
        return
      }
      router.refresh()
    })
  }

  const cs = CHIP_STYLE[state]

  return (
    <button
      type="button"
      onClick={advance}
      disabled={isPending}
      title={`${DIMENSION_LABELS[dimension]} — ${STATE_TEXT[state]} (click to change)`}
      aria-label={`${DIMENSION_LABELS[dimension]}: ${STATE_TEXT[state]}. Click to change.`}
      style={{
        fontFamily: 'inherit',
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 5px',
        borderRadius: 3,
        background: cs.background,
        color: cs.color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        border: 'none',
        margin: 0,
        lineHeight: 'inherit',
        cursor: isPending ? 'wait' : 'pointer',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {DIMENSION_LABELS[dimension]}
    </button>
  )
}
