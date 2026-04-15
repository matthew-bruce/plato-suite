'use client'

import { forwardRef, useId, useState } from 'react'

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

const CHECKMARK_PATH = 'M6.64984 12.8523L9.56811 15.516L17.3502 8.48401'

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      size = 'large',
      state = 'default',
      errorMessage,
      checked,
      defaultChecked = false,
      disabled = false,
      onChange,
      className,
    },
    ref
  ) => {
    const id = useId()
    const isControlled = checked !== undefined
    const [internalChecked, setInternalChecked] = useState(defaultChecked)
    const [isFocused, setIsFocused] = useState(false)
    const isChecked = isControlled ? checked : internalChecked

    const isError = state === 'error'
    const isSuccess = state === 'success'
    const showCheckmark = isSuccess || (!disabled && isChecked)
    const checkStroke = isSuccess ? 'var(--rmg-color-green-contrast)' : 'var(--rmg-color-white)'

    const boxStyle: React.CSSProperties = {
      width: 24,
      height: 24,
      borderRadius: 'var(--rmg-radius-xs)',
      border: '1px solid',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'background-color 150ms, border-color 150ms',
      outline: isFocused ? '2px solid var(--rmg-color-dark-grey)' : 'none',
      outlineOffset: 2,
      pointerEvents: 'none',
      ...(disabled
        ? { backgroundColor: 'var(--rmg-color-grey-2)', borderColor: 'var(--rmg-color-grey-1)' }
        : isSuccess
        ? { backgroundColor: 'var(--rmg-color-tint-success)', borderColor: 'transparent' }
        : isError
        ? { backgroundColor: 'var(--rmg-color-white)', borderColor: 'var(--rmg-color-red)' }
        : isChecked
        ? { backgroundColor: 'var(--rmg-color-red)', borderColor: 'var(--rmg-color-red)' }
        : { backgroundColor: 'var(--rmg-color-white)', borderColor: 'var(--rmg-color-dark-grey)' }),
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternalChecked(e.target.checked)
      onChange?.(e.target.checked)
    }

    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }} className={className}>
        <label
          htmlFor={id}
          style={{ display: 'inline-flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', userSelect: 'none' }}
        >
          {/* 44×44 touch target */}
          <span style={{ position: 'relative', display: 'flex', width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
            {/* Input fills the touch target invisibly — inline styles because Tailwind does not scan packages/ui */}
            <input
              ref={ref}
              id={id}
              type="checkbox"
              checked={isControlled ? checked : undefined}
              defaultChecked={!isControlled ? defaultChecked : undefined}
              disabled={disabled}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              aria-invalid={isError || undefined}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                top: 0,
                left: 0,
                margin: 0,
                padding: 0,
                cursor: disabled ? 'not-allowed' : 'pointer',
                zIndex: 1,
              }}
            />
            {/* Visual box */}
            <span style={boxStyle} aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ opacity: showCheckmark ? 1 : 0, transition: 'opacity 150ms' }}
                aria-hidden="true"
              >
                <path d={CHECKMARK_PATH} stroke={checkStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </span>

          {/* Label */}
          <span style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: size === 'large' ? 'var(--rmg-text-b2)' : 'var(--rmg-text-c1)',
            lineHeight: size === 'large' ? 'var(--rmg-leading-b2)' : 'var(--rmg-leading-c1)',
            color: disabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-heading)',
          }}>
            {label}
          </span>
        </label>

        {/* Error message */}
        {isError && errorMessage && !disabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: size === 'large' ? 6 : 4, paddingLeft: 10 }}>
            {size === 'large' ? (
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="8" stroke="var(--rmg-color-red)" strokeLinecap="round" strokeLinejoin="round"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M9.4136 5.3624C9.4136 5.8328 9.0328 6.2136 8.5512 6.2136C8.0808 6.2136 7.7 5.8328 7.7 5.3624C7.7 4.8808 8.0808 4.5 8.5512 4.5C9.0328 4.5 9.4136 4.8808 9.4136 5.3624ZM9.3128 12.1608C9.3128 12.5752 8.9768 12.9112 8.5512 12.9112C8.148 12.9112 7.8008 12.5752 7.8008 12.1608V7.7144C7.8008 7.3 8.148 6.9528 8.5512 6.9528C8.9768 6.9528 9.3128 7.3 9.3128 7.7144V12.1608Z" fill="var(--rmg-color-red)"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="6" stroke="var(--rmg-color-red)" strokeLinecap="round" strokeLinejoin="round"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M7.1852 4.1468C7.1852 4.4996 6.8996 4.7852 6.5384 4.7852C6.1856 4.7852 5.9 4.4996 5.9 4.1468C5.9 3.7856 6.1856 3.5 6.5384 3.5C6.8996 3.5 7.1852 3.7856 7.1852 4.1468ZM7.1096 9.2456C7.1096 9.5564 6.8576 9.8084 6.5384 9.8084C6.236 9.8084 5.9756 9.5564 5.9756 9.2456V5.9108C5.9756 5.6 6.236 5.3396 6.5384 5.3396C6.8576 5.3396 7.1096 5.6 7.1096 5.9108V9.2456Z" fill="var(--rmg-color-red)"/>
              </svg>
            )}
            <span style={{
              fontFamily: 'var(--rmg-font-body)',
              fontSize: size === 'large' ? 'var(--rmg-text-c1)' : 'var(--rmg-text-c2)',
              lineHeight: size === 'large' ? 'var(--rmg-leading-c1)' : 'var(--rmg-leading-c2)',
              color: 'var(--rmg-color-red)',
            }}>
              {errorMessage}
            </span>
          </div>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'
