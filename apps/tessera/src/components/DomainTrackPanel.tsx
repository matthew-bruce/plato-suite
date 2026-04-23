'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import {
  TRACK_COLOURS,
  getSupplierColour,
  type SupplierColourMap,
} from '@plato/ui/tokens'

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

// Callout field types — rendered without a collapsible label
const CALLOUT_TYPES: FieldType[] = ['test_block', 'red_flag', 'note_block', 'cg_caveat']

const TRACK_META = {
  A: { label: 'Track A — CG Extraction', colour: TRACK_COLOURS.A },
  B: { label: 'Track B — TCS Onboarding', colour: TRACK_COLOURS.B },
} as const

export function DomainTrackPanel({
  track,
  trackContent,
  parkerQuestions,
  smeSupplierMap = {},
  supplierMap = {},
}: {
  track: 'A' | 'B'
  trackContent: TrackContent[]
  parkerQuestions: ParkerQuestion[]
  smeSupplierMap?: Record<string, string>
  supplierMap?: SupplierColourMap
}) {
  const sorted = [...trackContent].sort(
    (a, b) =>
      FIELD_ORDER.indexOf(a.field_type) - FIELD_ORDER.indexOf(b.field_type),
  )
  const meta = TRACK_META[track]

  return (
    <div
      style={{
        backgroundColor: 'var(--rmg-color-surface-white)',
        borderRadius: 'var(--rmg-radius-m)',
        boxShadow: 'var(--rmg-shadow-card)',
        borderTop: `3px solid ${meta.colour}`,
        overflow: 'hidden',
      }}
    >
      {/* Track header */}
      <div
        style={{
          padding: 'var(--rmg-spacing-05) var(--rmg-spacing-06)',
          borderBottom: '1px solid var(--rmg-color-grey-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: meta.colour,
          }}
        >
          {meta.label}
        </div>
      </div>

      {/* Track body */}
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
              smeSupplierMap={smeSupplierMap}
              supplierMap={supplierMap}
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
  smeSupplierMap,
  supplierMap,
}: {
  item: TrackContent
  track: 'A' | 'B'
  parkerQuestions: ParkerQuestion[]
  smeSupplierMap: Record<string, string>
  supplierMap: SupplierColourMap
}) {
  const [open, setOpen] = useState(true)

  if (CALLOUT_TYPES.includes(item.field_type)) {
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
        <FieldBody
          item={item}
          track={track}
          parkerQuestions={parkerQuestions}
          smeSupplierMap={smeSupplierMap}
          supplierMap={supplierMap}
        />
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
    default:
      return fieldType
  }
}

function FieldBody({
  item,
  track,
  parkerQuestions,
  smeSupplierMap,
  supplierMap,
}: {
  item: TrackContent
  track: 'A' | 'B'
  parkerQuestions: ParkerQuestion[]
  smeSupplierMap: Record<string, string>
  supplierMap: SupplierColourMap
}) {
  switch (item.field_type) {
    case 'smes':
      return (
        <SmesChips
          content={item.content}
          smeSupplierMap={smeSupplierMap}
          supplierMap={supplierMap}
        />
      )
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
    default:
      return <PlainParagraph content={item.content} />
  }
}

// ── Tool callouts (Section 6) ─────────────────────────────────────────────────
// Tab border-radius: no top-left corner (analyst annotation style)

function CalloutField({ item }: { item: TrackContent }) {
  const bodyStyle: React.CSSProperties = {
    margin: 0,
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-b3)',
    lineHeight: 'var(--rmg-leading-b3)',
    color: 'var(--rmg-color-text-body)',
    whiteSpace: 'pre-wrap',
  }

  switch (item.field_type) {
    case 'test_block':
      return (
        <div
          style={{
            backgroundColor: 'var(--rmg-color-tint-yellow)',
            borderLeft: '3px solid var(--rmg-color-orange)',
            borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
            padding: 'var(--rmg-spacing-04)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--rmg-color-orange)',
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            🧪 Test
          </div>
          <p style={bodyStyle}>{item.content}</p>
        </div>
      )

    case 'red_flag':
      return (
        <div
          style={{
            backgroundColor: 'var(--rmg-color-tint-red)',
            borderLeft: '3px solid var(--rmg-color-red)',
            borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
            padding: 'var(--rmg-spacing-04)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--rmg-color-red)',
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            🚩 Flag
          </div>
          <p style={bodyStyle}>{item.content}</p>
        </div>
      )

    case 'note_block':
      return (
        <div
          style={{
            // #EBF5FB — permitted non-token hex, documented in spec Section 6
            backgroundColor: '#EBF5FB',
            borderLeft: '3px solid var(--rmg-color-blue)',
            borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
            padding: 'var(--rmg-spacing-04)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--rmg-color-blue)',
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            📝 Note
          </div>
          <p style={bodyStyle}>{item.content}</p>
        </div>
      )

    case 'cg_caveat':
      return (
        <div
          style={{
            // #002E6614 bg, #003C82 border — supplier colour, documented in spec Section 6
            backgroundColor: '#002E6614',
            borderLeft: '3px solid #003C82',
            borderRadius: '0 var(--rmg-radius-s) var(--rmg-radius-s) var(--rmg-radius-s)',
            padding: 'var(--rmg-spacing-04)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: '#003C82',
              marginBottom: 'var(--rmg-spacing-02)',
            }}
          >
            ⚠️ CG Caveat
          </div>
          <p style={bodyStyle}>{item.content}</p>
        </div>
      )

    default:
      return null
  }
}

// ── SME chips (Section 3A / Section 13) ──────────────────────────────────────

function SmesChips({
  content,
  smeSupplierMap,
  supplierMap,
}: {
  content: string
  smeSupplierMap: Record<string, string>
  supplierMap: SupplierColourMap
}) {
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
        const abbrev = smeSupplierMap[name]
        const colour = getSupplierColour(abbrev ?? '', supplierMap)
        return (
          <span
            key={`${name}-${i}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 10px',
              border: `1.5px solid ${colour}`,
              background: `${colour}18`,
              color: colour,
              borderRadius: 'var(--rmg-radius-xl)',
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
        )
      })}
    </div>
  )
}

// ── Shared field renderers ────────────────────────────────────────────────────

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
            style={{ position: 'absolute', left: 0, color: 'var(--rmg-color-grey-1)' }}
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
