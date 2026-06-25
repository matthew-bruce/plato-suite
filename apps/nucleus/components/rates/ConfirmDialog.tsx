'use client'

/** Small soft-warning confirm dialog shared by the rate-setting surfaces
 *  (the Blended Rates page form and the Schedule page inline widget). */
export function ConfirmDialog({
  message,
  confirmLabel = 'Continue',
  onConfirm,
  onCancel,
}: {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const btn: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)', fontSize: 13, fontWeight: 500, cursor: 'pointer', borderRadius: 6, padding: '7px 16px',
  }
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(42,42,45,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--rmg-color-white)', borderRadius: 12, padding: 22, width: 420,
          maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', fontFamily: 'var(--rmg-font-body)',
        }}
      >
        <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--rmg-color-text-heading)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} style={{ ...btn, background: 'transparent', color: 'var(--rmg-color-text-body)', border: '1px solid var(--rmg-color-grey-2)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} style={{ ...btn, background: 'var(--rmg-color-red)', color: '#fff', border: 'none' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
