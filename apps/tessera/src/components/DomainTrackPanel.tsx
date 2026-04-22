'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'

export type TrackContent = {
  id: string
  track: 'A' | 'B'
  field_type: FieldType
  content: string
}

export type ParkerQuestion = {
  number: number
  question: string
}

export type FieldType =
  | 'smes'
  | 'extract_topics'
  | 'opening_question'
  | 'test_block'
  | 'red_flag'
  | 'confluence_artefacts'
  | 'parker_mapping'
  | 'notes'
  | 'cg_caveat'
  | 'note_block'

const FIELD_ORDER: FieldType[] = [
  'smes',
  'opening_question',
  'extract_topics',
  'test_block',
  'red_flag',
  'confluence_artefacts',
  'parker_mapping',
  'notes',
  'cg_caveat',
  'note_block',
]

const TRACK_COLOURS = {
  A: { stripe: 'var(--rmg-color-red)', label: 'var(--rmg-color-red)' },
  B: { stripe: 'var(--tessera-tcs-blue)', label: 'var(--tessera-tcs-blue)' },
} as const

const TRACK_LABELS = {
  A: { tag: 'Track A', title: 'Capgemini — Extract' },
  B: { tag: 'Track B', title: 'TCS — Verify' },
} as const

export function DomainTrackPanel({
  track,
  trackContent,
  parkerQuestions,
}: {
  track: 'A' | 'B'
  trackContent: TrackContent[]
  parkerQuestions: ParkerQuestion[]
}) {
  const sorted = [...trackContent].sort(
    (a, b) =>
      FIELD_ORDER.indexOf(a.field_type) - FIELD_ORDER.indexOf(b.field_type),
  )
  const colours = TRACK_COLOURS[track]
  const labels = TRACK_LABELS[track]

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        borderTop: `3px solid ${colours.stripe}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--rmg-spacing-05) var(--rmg-spacing-06)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 'var(--rmg-text-c2)',
            color: colours.label,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
        >
          {labels.tag}
        </div>
        <div
          style={{
            fontFamily: 'var(--rmg-font-display)',
            fontSize: 'var(--rmg-text-h6)',
            lineHeight: 'var(--rmg-leading-h6)',
            color: 'var(--rmg-color-text-heading)',
            marginTop: 2,
            fontWeight: 700,
          }}
        >
          {labels.title}
        </div>
      </div>

      <div
        style={{
          padding: 'var(--rmg-spacing-05) var(--rmg-spacing-06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--rmg-spacing-05)',
        }}
      >
        {sorted.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              color: 'var(--rmg-color-text-light)',
              fontStyle: 'italic',
            }}
          >
            No content for this track yet.
          </p>
        ) : (
          sorted.map((item) => (
            <FieldRenderer
              key={item.id}
              item={item}
              track={track}
              parkerQuestions={parkerQuestions}
            />
          ))
        )}
      </div>
    </div>
  )
}

function FieldRenderer({
  item,
  track,
  parkerQuestions,
}: {
  item: TrackContent
  track: 'A' | 'B'
  parkerQuestions: ParkerQuestion[]
}) {
  const [open, setOpen] = useState(true)

  const hasLabel = ![
    'test_block',
    'red_flag',
    'note_block',
  ].includes(item.field_type)

  if (!hasLabel) {
    return <CalloutField item={item} />
  }

  const label = labelFor(item.field_type, track)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c2)',
          color: 'var(--rmg-color-text-light)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: 'var(--rmg-spacing-02)',
          textAlign: 'left',
        }}
      >
        <span>{label}</span>
        <ChevronDown
          size={14}
          style={{
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
      </button>
      {open && (
        <div>
          <FieldBody
            item={item}
            parkerQuestions={parkerQuestions}
          />
        </div>
      )}
    </div>
  )
}

function labelFor(fieldType: FieldType, track: 'A' | 'B'): string {
  switch (fieldType) {
    case 'smes':
      return track === 'A' ? 'CG SMEs' : 'SME Picture'
    case 'extract_topics':
      return track === 'A' ? 'What to extract' : 'What TCS must demonstrate'
    case 'opening_question':
      return track === 'A' ? 'Opening question' : 'Critical question'
    case 'confluence_artefacts':
      return 'Confluence artefacts'
    case 'parker_mapping':
      return "Parker's questions"
    case 'notes':
      return 'Notes'
    case 'cg_caveat':
      return 'CG note'
    default:
      return fieldType
  }
}

function FieldBody({
  item,
  parkerQuestions,
}: {
  item: TrackContent
  parkerQuestions: ParkerQuestion[]
}) {
  switch (item.field_type) {
    case 'smes':
      return <SmesChips content={item.content} />
    case 'extract_topics':
      return <PlainParagraph content={item.content} />
    case 'opening_question':
      return <OpeningQuestion content={item.content} />
    case 'confluence_artefacts':
      return <ConfluenceList content={item.content} />
    case 'parker_mapping':
      return (
        <ParkerMapping content={item.content} questions={parkerQuestions} />
      )
    case 'notes':
      return (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
          }}
        >
          {item.content}
        </p>
      )
    case 'cg_caveat':
      return (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
            fontStyle: 'italic',
          }}
        >
          {item.content}
        </p>
      )
    default:
      return <PlainParagraph content={item.content} />
  }
}

function CalloutField({ item }: { item: TrackContent }) {
  switch (item.field_type) {
    case 'test_block':
      return (
        <div
          style={{
            backgroundColor: 'rgba(253, 218, 36, 0.18)',
            borderLeft: '3px solid var(--rmg-color-orange)',
            padding: 'var(--rmg-spacing-04)',
            borderRadius: 'var(--rmg-radius-s)',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-orange)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            Test
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.content}
          </p>
        </div>
      )
    case 'red_flag':
      return (
        <div
          style={{
            backgroundColor: 'var(--rmg-color-tint-red)',
            borderLeft: '3px solid var(--rmg-color-red)',
            padding: 'var(--rmg-spacing-04)',
            borderRadius: 'var(--rmg-radius-s)',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              color: 'var(--rmg-color-red)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            ⚑ Flag
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.content}
          </p>
        </div>
      )
    case 'note_block':
      return (
        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-light)',
            borderLeft: '3px solid var(--rmg-color-blue)',
            padding: 'var(--rmg-spacing-04)',
            borderRadius: 'var(--rmg-radius-s)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-c1)',
              lineHeight: 'var(--rmg-leading-c1)',
              color: 'var(--rmg-color-text-body)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.content}
          </p>
        </div>
      )
    default:
      return null
  }
}

function SmesChips({ content }: { content: string }) {
  const names = content
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      {names.map((name, i) => {
        const { bg, fg } = supplierChipColours(name)
        return (
          <span
            key={`${name}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px var(--rmg-spacing-03)',
              backgroundColor: bg,
              color: fg,
              borderRadius: 'var(--rmg-radius-xs)',
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              fontWeight: 600,
            }}
          >
            {name}
          </span>
        )
      })}
    </div>
  )
}

function supplierChipColours(name: string): { bg: string; fg: string } {
  const n = name.toUpperCase()
  if (/\bCG\b|\bCAPGEMINI\b/.test(n)) {
    return { bg: 'var(--rmg-color-tint-red)', fg: 'var(--rmg-color-red)' }
  }
  if (/\bRMG\b|\bROYAL MAIL\b/.test(n)) {
    return {
      bg: 'var(--rmg-color-tint-green)',
      fg: 'var(--rmg-color-green-contrast)',
    }
  }
  if (/\bHT\b|HAPPY TEAM/.test(n)) {
    return { bg: 'rgba(74, 158, 255, 0.14)', fg: 'var(--tessera-happy-blue)' }
  }
  if (/\bNH\b|NORTH HIGHLAND/.test(n)) {
    return { bg: 'rgba(245, 166, 35, 0.14)', fg: 'var(--tessera-nh-amber)' }
  }
  if (/\bTCS\b|\bTBC\b|TATA/.test(n)) {
    return { bg: 'rgba(155, 89, 182, 0.10)', fg: 'var(--tessera-scoped-purple)' }
  }
  return { bg: 'rgba(155, 89, 182, 0.10)', fg: 'var(--tessera-scoped-purple)' }
}

function PlainParagraph({ content }: { content: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-b3)',
        lineHeight: 'var(--rmg-leading-b3)',
        color: 'var(--rmg-color-text-body)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {content}
    </p>
  )
}

function OpeningQuestion({ content }: { content: string }) {
  return (
    <blockquote
      style={{
        margin: 0,
        paddingLeft: 'var(--rmg-spacing-04)',
        borderLeft: '3px solid var(--rmg-color-grey-2)',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-b3)',
        lineHeight: 'var(--rmg-leading-b3)',
        color: 'var(--rmg-color-text-body)',
        fontStyle: 'italic',
      }}
    >
      {content}
    </blockquote>
  )
}

function ConfluenceList({ content }: { content: string }) {
  const items = content
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  return (
    <ul
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      {items.map((it, i) => (
        <li
          key={i}
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-text-light)',
            paddingLeft: 'var(--rmg-spacing-04)',
            position: 'relative',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              color: 'var(--rmg-color-grey-1)',
            }}
          >
            —
          </span>
          {it}
        </li>
      ))}
    </ul>
  )
}

function ParkerMapping({
  content,
  questions,
}: {
  content: string
  questions: ParkerQuestion[]
}) {
  const tokens = content
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^P\d+/i.test(s))
  const byNumber = new Map(questions.map((q) => [q.number, q]))
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--rmg-spacing-02)',
      }}
    >
      {tokens.map((tok, i) => {
        const num = parseInt(tok.replace(/[^0-9]/g, ''), 10)
        const q = byNumber.get(num)
        return (
          <Link
            key={`${tok}-${i}`}
            href={`/parker#q${num}`}
            title={q ? q.question : undefined}
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px var(--rmg-spacing-03)',
              backgroundColor: 'rgba(243, 146, 13, 0.12)',
              color: 'var(--rmg-color-orange)',
              borderRadius: 'var(--rmg-radius-xl)',
              fontFamily: 'monospace',
              fontSize: 'var(--rmg-text-c2)',
              fontWeight: 700,
            }}
          >
            {tok.toUpperCase()}
          </Link>
        )
      })}
    </div>
  )
}
