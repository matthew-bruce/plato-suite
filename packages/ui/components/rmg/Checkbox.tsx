'use client'

import { forwardRef, useId } from 'react'

export type CheckboxSize = 'large' | 'small'
export type CheckboxState = 'default' | 'error' | 'success'

export interface CheckboxProps {
  label: string
  size?: CheckboxSize
  state?: CheckboxState
  errorMessage?: string
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
  className?: string
}

const INFO_ICON_LARGE = (
  <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8.5" cy="8.5" r="8" stroke="var(--rmg-color-red)" strokeLinecap="round" strokeLinejoin="round"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M9.4136 5.3624C9.4136 5.8328 9.0328 6.2136 8.5512 6.2136C8.0808 6.2136 7.7 5.8328 7.7 5.3624C7.7 4.8808 8.0808 4.5 8.5512 4.5C9.0328 4.5 9.4136 4.8808 9.4136 5.3624ZM9.3128 12.1608C9.3128 12.5752 8.9768 12.9112 8.5512 12.9112C8.148 12.9112 7.8008 12.5752 7.8008 12.1608V7.7144C7.8008 7.3 8.148 6.9528 8.5512 6.9528C8.9768 6.9528 9.3128 7.3 9.3128 7.7144V12.1608Z" fill="var(--rmg-color-red)"/>
  </svg>
)

const INFO_ICON_SMALL = (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6.5" cy="6.5" r="6" stroke="var(--rmg-color-red)" strokeLinecap="round" strokeLinejoin="round"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M7.1852 4.1468C7.1852 4.4996 6.8996 4.7852 6.5384 4.7852C6.1856 4.7852 5.9 4.4996 5.9 4.1468C5.9 3.7856 6.1856 3.5 6.5384 3.5C6.8996 3.5 7.1852 3.7856 7.1852 4.1468ZM7.1096 9.2456C7.1096 9.5564 6.8576 9.8084 6.5384 9.8084C6.236 9.8084 5.9756 9.5564 5.9756 9.2456V5.9108C5.9756 5.6 6.236 5.3396 6.5384 5.3396C6.8576 5.3396 7.1096 5.6 7.1096 5.9108V9.2456Z" fill="var(--rmg-color-red)"/>
  </svg>
)

const CHECKMARK = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6.64984 12.8523L9.56811 15.516L17.3502 8.48401" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, size = 'large', state = 'default', errorMessage, checked, defaultChecked, disabled, onChange, className }, ref) => {
    const id = useId()
    const isError = state === 'error'
    const isSuccess = state === 'success'

    const labelSize = size === 'large'
      ? 'font-body text-b2 leading-rmg-b2'
      : 'font-body text-c1 leading-rmg-c1'

    const errorTextSize = size === 'large'
      ? 'font-body text-c1 leading-rmg-c1'
      : 'font-body text-c2 leading-rmg-c2'

    return (
      // TODO: add --rmg-color-tint-success to packages/config/tokens/rmg.css
      <div
        className={`inline-flex flex-col items-start gap-0 ${className ?? ''}`}
        style={{ '--rmg-color-tint-success': '#E0EDD6' } as React.CSSProperties}
      >
        <label htmlFor={id} className="inline-flex items-center cursor-pointer group">
          {/* Visually hidden native input — provides accessibility, keyboard, and form behaviour */}
          <input
            ref={ref}
            id={id}
            type="checkbox"
            checked={checked}
            defaultChecked={defaultChecked}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.checked)}
            className="sr-only peer"
            aria-invalid={isError}
          />

          {/* 44×44 touch target wrapping the 24×24 visual box */}
          <span
            className={[
              'relative flex items-center justify-center w-[44px] h-[44px] shrink-0',
              'rounded-[4px]',
            ].join(' ')}
          >
            {/* Visual box — state-driven via peer classes */}
            <span
              className={[
                'w-6 h-6 rounded-[var(--rmg-radius-xs)] border flex items-center justify-center',
                'transition-[border-color,background-color] duration-150',

                // Default unchecked
                !disabled && !isError && !isSuccess
                  ? [
                      'bg-white border-[var(--rmg-color-dark-grey)]',
                      // Hover (unchecked)
                      'group-hover:peer-not-checked:border-[var(--rmg-color-black)]',
                      // Checked state
                      'peer-checked:bg-[var(--rmg-color-red)] peer-checked:border-[var(--rmg-color-red)] peer-checked:text-white',
                      // Focus ring
                      'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--rmg-color-dark-grey)]',
                    ].join(' ')
                  : '',

                // Disabled
                disabled
                  ? 'bg-[var(--rmg-color-grey-2)] border-[var(--rmg-color-grey-1)] cursor-not-allowed text-[var(--rmg-color-grey-1)]'
                  : '',

                // Error (unchecked only — checked error uses default checked style)
                isError && !disabled
                  ? [
                      'bg-white border-[var(--rmg-color-red)]',
                      'peer-checked:bg-[var(--rmg-color-red)] peer-checked:border-[var(--rmg-color-red)] peer-checked:text-white',
                      'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--rmg-color-red)]',
                    ].join(' ')
                  : '',

                // Success
                isSuccess && !disabled
                  ? [
                      'bg-[var(--rmg-color-tint-success)] border-transparent text-[var(--rmg-color-green-contrast)]',
                    ].join(' ')
                  : '',
              ].join(' ')}
              aria-hidden="true"
            >
              {/* Checkmark — shown for checked or success */}
              <span className={[
                'transition-opacity duration-150',
                isSuccess ? 'opacity-100 text-[var(--rmg-color-green-contrast)]' : 'opacity-0 peer-checked:opacity-100',
              ].join(' ')}>
                {CHECKMARK}
              </span>
            </span>
          </span>

          {/* Label */}
          <span
            className={[
              labelSize,
              disabled ? 'text-[var(--rmg-color-grey-1)]' : 'text-[var(--rmg-color-text-heading)]',
            ].join(' ')}
          >
            {label}
          </span>
        </label>

        {/* Error message row — only shown in error state with a message */}
        {isError && errorMessage && !disabled && (
          <div className="flex items-center gap-[6px] pl-[10px] mt-0">
            {size === 'large' ? INFO_ICON_LARGE : INFO_ICON_SMALL}
            <span
              className={`${errorTextSize} text-[var(--rmg-color-red)]`}
            >
              {errorMessage}
            </span>
          </div>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
