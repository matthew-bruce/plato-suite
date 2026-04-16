'use client'

import { useId, useState } from 'react'

export type RadioSize = 'large' | 'small'
export type RadioState = 'default' | 'error' | 'success' | 'disabled'

export interface RadioProps {
  label: string
  size?: RadioSize
  state?: RadioState
  checked?: boolean
  defaultChecked?: boolean
  errorMessage?: string
  name?: string
  value?: string
  onChange?: (value: string) => void
}

export function Radio({
  label,
  size = 'large',
  state = 'default',
  checked,
  defaultChecked = false,
  errorMessage,
  name,
  value,
  onChange,
}: RadioProps) {
  const id = useId()
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const [isFocused, setIsFocused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const isChecked = isControlled ? checked : internalChecked
  const isDisabled = state === 'disabled'
  const isError = state === 'error'
  const isSuccess = state === 'success'

  // Hover on the outer ring for default unselected only — not defined in Figma spec, added for UX
  const isHoverActive = isHovered && !isChecked && !isError && !isSuccess && !isDisabled

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) setInternalChecked(e.target.checked)
    if (e.target.checked) onChange?.(value ?? '')
  }

  // Derive circle colours from state
  let outerFill: string
  let outerStroke: string
  let showDot = false
  let dotFill = ''

  if (isDisabled) {
    outerFill = 'var(--rmg-color-grey-2)'
    outerStroke = 'var(--rmg-color-grey-1)'
    if (isChecked) {
      showDot = true
      dotFill = 'var(--rmg-color-grey-1)'
    }
  } else if (isSuccess) {
    outerFill = 'var(--rmg-color-tint-success)' // #E0EDD6 — token confirmed, was pending
    outerStroke = 'var(--rmg-color-green-contrast)'
    showDot = true
    dotFill = 'var(--rmg-color-green-contrast)'
  } else if (isError) {
    outerFill = 'var(--rmg-color-white)'
    outerStroke = 'var(--rmg-color-red)'
  } else if (isChecked) {
    outerFill = 'var(--rmg-color-white)'
    outerStroke = 'var(--rmg-color-dark-grey)'
    showDot = true
    dotFill = 'var(--rmg-color-red)'
  } else if (isHoverActive) {
    outerFill = 'var(--rmg-color-grey-4)'
    outerStroke = 'var(--rmg-color-dark-grey)'
  } else {
    outerFill = 'var(--rmg-color-white)'
    outerStroke = 'var(--rmg-color-dark-grey)'
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <label
        htmlFor={id}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          userSelect: 'none',
        }}
        onMouseEnter={() => { if (!isDisabled) setIsHovered(true) }}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 44×44 touch target */}
        <span
          style={{
            position: 'relative',
            display: 'flex',
            width: 44,
            height: 44,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Native input — visually hidden, fills touch target for click + keyboard */}
          <input
            id={id}
            type="radio"
            name={name}
            value={value}
            checked={isControlled ? checked : undefined}
            defaultChecked={!isControlled ? defaultChecked : undefined}
            disabled={isDisabled}
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
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              zIndex: 1,
            }}
          />
          {/* Visual SVG — all interaction handled by the input above */}
          <svg
            width="44"
            height="44"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Focus ring — TODO: replace #4C33E6 with --rmg-color-focus once confirmed by RMG DS team */}
            {isFocused && (
              <circle cx="22" cy="22" r="16" strokeWidth="2" fill="none" stroke="#4C33E6" />
            )}
            {/* Outer ring */}
            <circle cx="22" cy="22" r="11.5" fill={outerFill} stroke={outerStroke} strokeWidth="1" />
            {/* Inner dot */}
            {showDot && (
              <circle cx="22" cy="22" r="7" fill={dotFill} />
            )}
          </svg>
        </span>

        {/* Label text */}
        <span
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: size === 'large' ? 'var(--rmg-text-b3)' : 'var(--rmg-text-c1)',
            lineHeight: size === 'large' ? 'var(--rmg-leading-b3)' : 'var(--rmg-leading-c1)',
            fontWeight: 400,
            color: isDisabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-heading)',
          }}
        >
          {label}
        </span>
      </label>

      {/* Error message row */}
      {isError && errorMessage && !isDisabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10 }}>
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
