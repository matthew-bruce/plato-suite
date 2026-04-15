import React from 'react'

export interface ChevronButtonProps {
  size: 'large' | 'small'
  direction: 'left' | 'right'
  state: 'active' | 'disabled'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  'aria-label'?: string
}

export function ChevronButton({
  size,
  direction,
  state,
  onClick,
  'aria-label': ariaLabel,
}: ChevronButtonProps) {
  const dimension = size === 'large' ? '64px' : '48px'
  const isDisabled = state === 'disabled'

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-label={ariaLabel ?? (direction === 'right' ? 'Next' : 'Previous')}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        borderRadius: '50%',
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--rmg-color-grey-4)',
        color: isDisabled ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-bright-red)',
        outline: 'none',
        transition: 'background-color 150ms ease, color 150ms ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return
        e.currentTarget.style.backgroundColor = 'var(--rmg-color-warm-red)'
        e.currentTarget.style.color = 'var(--rmg-color-white)'
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return
        e.currentTarget.style.backgroundColor = 'var(--rmg-color-grey-4)'
        e.currentTarget.style.color = 'var(--rmg-color-bright-red)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--rmg-color-red)'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none'
        e.currentTarget.style.outlineOffset = ''
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{
          transform: direction === 'left' ? 'rotate(180deg)' : undefined,
          flexShrink: 0,
        }}
      >
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

export default ChevronButton
