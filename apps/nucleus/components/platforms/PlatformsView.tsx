'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@plato/ui/components/rmg'
import type { PlatformRow } from '@/lib/supabase/platforms'
import {
  createPlatform,
  updatePlatform,
  deletePlatform,
} from '@/lib/actions/platforms'

type Props = {
  platforms: PlatformRow[]
}

type ModalMode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; platform: PlatformRow }

/* ── Page ───────────────────────────────────────────────────────────── */

export function PlatformsView({ platforms }: Props) {
  const [modal, setModal] = useState<ModalMode>({ kind: 'closed' })

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: 'var(--rmg-spacing-09) var(--rmg-spacing-07)',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--rmg-spacing-06)',
          marginBottom: 'var(--rmg-spacing-09)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h2)',
              lineHeight: 'var(--rmg-leading-h2)',
              color: 'var(--rmg-color-text-heading)',
              marginBottom: 'var(--rmg-spacing-03)',
            }}
          >
            Platforms
          </h1>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b2)',
              lineHeight: 'var(--rmg-leading-b2)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            Technology-owned platform groups
          </p>
        </div>
        <Button
          variant="solid"
          size="medium"
          background="light"
          onClick={() => setModal({ kind: 'create' })}
        >
          Add Platform
        </Button>
      </div>

      {/* Empty state */}
      {platforms.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--rmg-spacing-13) var(--rmg-spacing-07)',
            backgroundColor: 'var(--rmg-color-surface-light)',
            borderRadius: 'var(--rmg-radius-m)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h5)',
              lineHeight: 'var(--rmg-leading-h5)',
              color: 'var(--rmg-color-text-heading)',
              marginBottom: 'var(--rmg-spacing-03)',
            }}
          >
            No platforms configured yet.
          </p>
          <p
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-light)',
            }}
          >
            Platforms will appear here once they have been added to the system.
          </p>
        </div>
      )}

      {/* Platform grid */}
      {platforms.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))',
            gap: 'var(--rmg-spacing-06)',
          }}
        >
          {platforms.map((platform) => (
            <PlatformCard
              key={platform.platform_id}
              platform={platform}
              onEdit={() => setModal({ kind: 'edit', platform })}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.kind !== 'closed' && (
        <PlatformModal
          mode={modal}
          onClose={() => setModal({ kind: 'closed' })}
        />
      )}
    </div>
  )
}

/* ── Card ───────────────────────────────────────────────────────────── */

function PlatformCard({
  platform,
  onEdit,
}: {
  platform: PlatformRow
  onEdit: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <Link
        href={`/platforms/${platform.platform_slug}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: hovered ? 'var(--rmg-shadow-megamenu)' : 'var(--rmg-shadow-card)',
            transition: 'box-shadow 150ms ease',
            cursor: 'pointer',
            padding: 'var(--rmg-spacing-07)',
            paddingTop: 'var(--rmg-spacing-08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--rmg-spacing-03)',
          }}
        >
          {/* Name and code badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--rmg-spacing-04)',
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--rmg-font-display)',
                fontSize: 'var(--rmg-text-h5)',
                lineHeight: 'var(--rmg-leading-h5)',
                color: 'var(--rmg-color-text-heading)',
                fontWeight: 700,
                margin: 0,
              }}
            >
              {platform.platform_name}
            </h2>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'var(--rmg-text-c1)',
                lineHeight: 'var(--rmg-leading-c1)',
                color: 'var(--rmg-color-text-light)',
                backgroundColor: 'var(--rmg-color-surface-light)',
                borderRadius: 'var(--rmg-radius-xs)',
                padding: '2px var(--rmg-spacing-03)',
                whiteSpace: 'nowrap',
              }}
            >
              {platform.platform_code}
            </span>
          </div>

          {/* Description */}
          {platform.platform_description && (
            <p
              style={{
                fontFamily: 'var(--rmg-font-body)',
                fontSize: 'var(--rmg-text-b3)',
                lineHeight: 'var(--rmg-leading-b3)',
                color: 'var(--rmg-color-text-light)',
                margin: 0,
              }}
            >
              {platform.platform_description}
            </p>
          )}
        </div>
      </Link>

      {/* Edit button — sits in card top-right, above the link */}
      <button
        onClick={(e) => {
          e.preventDefault()
          onEdit()
        }}
        style={{
          position: 'absolute',
          top: 'var(--rmg-spacing-04)',
          right: 'var(--rmg-spacing-04)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--rmg-font-body)',
          fontSize: 'var(--rmg-text-c1)',
          lineHeight: 'var(--rmg-leading-c1)',
          color: 'var(--rmg-color-text-light)',
          padding: 'var(--rmg-spacing-02) var(--rmg-spacing-03)',
          borderRadius: 'var(--rmg-radius-xs)',
        }}
        aria-label={`Edit ${platform.platform_name}`}
      >
        Edit
      </button>
    </div>
  )
}

/* ── Modal ──────────────────────────────────────────────────────────── */

function PlatformModal({
  mode,
  onClose,
}: {
  mode: { kind: 'create' } | { kind: 'edit'; platform: PlatformRow }
  onClose: () => void
}) {
  const isEdit = mode.kind === 'edit'
  const platform = isEdit ? mode.platform : null

  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const headingId = 'platform-modal-heading'

  // Autofocus first field and trap Escape
  useEffect(() => {
    firstFieldRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = isEdit && platform
        ? await updatePlatform(platform.platform_id, formData)
        : await createPlatform(formData)

      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  function handleDelete() {
    if (!platform) return
    startTransition(async () => {
      const result = await deletePlatform(platform.platform_id)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(42, 42, 45, 0.5)',
          zIndex: 40,
        }}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--rmg-spacing-06)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--rmg-color-surface-white)',
            borderRadius: 'var(--rmg-radius-m)',
            boxShadow: 'var(--rmg-shadow-megamenu)',
            padding: 'var(--rmg-spacing-08)',
            width: '100%',
            maxWidth: '480px',
            pointerEvents: 'auto',
          }}
        >
          {/* Modal heading */}
          <h2
            id={headingId}
            style={{
              fontFamily: 'var(--rmg-font-display)',
              fontSize: 'var(--rmg-text-h4)',
              lineHeight: 'var(--rmg-leading-h4)',
              color: 'var(--rmg-color-text-heading)',
              marginBottom: 'var(--rmg-spacing-07)',
            }}
          >
            {isEdit ? 'Edit Platform' : 'Add Platform'}
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Platform Name */}
            <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
              <FieldLabel htmlFor="platform_name">Platform Name</FieldLabel>
              <input
                ref={firstFieldRef}
                id="platform_name"
                name="platform_name"
                type="text"
                required
                defaultValue={platform?.platform_name ?? ''}
                style={inputStyle}
              />
            </div>

            {/* Platform Code */}
            <div style={{ marginBottom: 'var(--rmg-spacing-06)' }}>
              <FieldLabel htmlFor="platform_code">Platform Code</FieldLabel>
              <input
                id="platform_code"
                name="platform_code"
                type="text"
                required
                maxLength={6}
                defaultValue={platform?.platform_code ?? ''}
                onChange={(e) => {
                  e.currentTarget.value = e.currentTarget.value.toUpperCase()
                }}
                style={{ ...inputStyle, fontFamily: 'monospace', textTransform: 'uppercase' }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 'var(--rmg-spacing-07)' }}>
              <FieldLabel htmlFor="platform_description">Description</FieldLabel>
              <textarea
                id="platform_description"
                name="platform_description"
                rows={3}
                defaultValue={platform?.platform_description ?? ''}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '80px',
                }}
              />
            </div>

            {/* Inline error */}
            {error && (
              <p
                style={{
                  fontFamily: 'var(--rmg-font-body)',
                  fontSize: 'var(--rmg-text-b3)',
                  lineHeight: 'var(--rmg-leading-b3)',
                  color: 'var(--rmg-color-text-accent)',
                  marginBottom: 'var(--rmg-spacing-05)',
                }}
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Submit row */}
            <div style={{ display: 'flex', gap: 'var(--rmg-spacing-04)', flexWrap: 'wrap' }}>
              <Button
                variant="solid"
                size="medium"
                background="light"
                disabled={isPending}
              >
                {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add Platform'}
              </Button>
              <Button
                variant="outline"
                size="medium"
                background="light"
                type="button"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>

          {/* Delete section — edit mode only */}
          {isEdit && (
            <div
              style={{
                marginTop: 'var(--rmg-spacing-08)',
                paddingTop: 'var(--rmg-spacing-06)',
                borderTop: '1px solid var(--rmg-color-grey-3)',
              }}
            >
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--rmg-font-body)',
                    fontSize: 'var(--rmg-text-b3)',
                    lineHeight: 'var(--rmg-leading-b3)',
                    color: 'var(--rmg-color-text-accent)',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Delete platform
                </button>
              ) : (
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--rmg-font-body)',
                      fontSize: 'var(--rmg-text-b3)',
                      lineHeight: 'var(--rmg-leading-b3)',
                      color: 'var(--rmg-color-text-body)',
                      marginBottom: 'var(--rmg-spacing-05)',
                    }}
                  >
                    Are you sure? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--rmg-spacing-04)' }}>
                    <Button
                      variant="solid"
                      size="medium"
                      background="light"
                      onClick={handleDelete}
                      disabled={isPending}
                    >
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </Button>
                    <Button
                      variant="outline"
                      size="medium"
                      background="light"
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Shared primitives ──────────────────────────────────────────────── */

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontFamily: 'var(--rmg-font-body)',
        fontSize: 'var(--rmg-text-b3)',
        lineHeight: 'var(--rmg-leading-b3)',
        color: 'var(--rmg-color-text-heading)',
        fontWeight: 700,
        marginBottom: 'var(--rmg-spacing-02)',
      }}
    >
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--rmg-font-body)',
  fontSize: 'var(--rmg-text-b2)',
  lineHeight: 'var(--rmg-leading-b2)',
  color: 'var(--rmg-color-text-body)',
  backgroundColor: 'var(--rmg-color-surface-white)',
  border: '1px solid var(--rmg-color-grey-2)',
  borderRadius: 'var(--rmg-radius-s)',
  padding: 'var(--rmg-spacing-04) var(--rmg-spacing-05)',
  outline: 'none',
}
