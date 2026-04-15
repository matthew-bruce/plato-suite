import React, { useId, useState } from 'react'

export interface FormFieldProps {
  variant?: 'default' | 'error' | 'validated' | 'disabled'
  size?: 'small' | 'large'
  label: string
  required?: boolean
  errorMessage?: string
  type?: 'text' | 'dropdown' | 'date'
  name?: string
  value?: string
  defaultValue?: string
  placeholder?: string
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>
}

function ChevronDownIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CheckmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function resolveBorder(
  variant: FormFieldProps['variant'],
  focused: boolean,
  hasValue: boolean,
): string {
  if (focused) return '2px solid var(--rmg-color-blue)'
  if (variant === 'error') return '1px solid var(--rmg-color-red)'
  if (variant === 'validated') return '1px solid var(--rmg-color-green)'
  if (variant === 'disabled') return '1px solid var(--rmg-color-grey-2)'
  if (hasValue) return '1px solid var(--rmg-color-grey-1)'
  return '1px solid var(--rmg-color-grey-2)'
}

export function FormField({
  variant = 'default',
  size = 'large',
  label,
  required = false,
  errorMessage,
  type = 'text',
  name,
  value,
  defaultValue,
  placeholder,
  onChange,
}: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const isDisabled = variant === 'disabled'
  const [focused, setFocused] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')

  const controlled = value !== undefined
  const currentValue = controlled ? value : internalValue
  const hasValue = currentValue.length > 0

  const inputHeight = size === 'large' ? '56px' : '40px'
  const fontSize = size === 'large' ? 'var(--rmg-text-b2)' : 'var(--rmg-text-b3)'
  const hasTrailing = type !== 'text' || variant === 'validated'

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--rmg-font-body)',
    fontSize: 'var(--rmg-text-c1)',
    lineHeight: 'var(--rmg-leading-c1)',
    color: isDisabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-body)',
    display: 'block',
    marginBottom: '4px',
  }

  const sharedInputStyle: React.CSSProperties = {
    width: '100%',
    height: inputHeight,
    padding: '0 12px',
    paddingRight: hasTrailing ? '40px' : '12px',
    border: resolveBorder(variant, focused, hasValue),
    borderRadius: 'var(--rmg-radius-s)',
    backgroundColor: isDisabled ? 'var(--rmg-color-grey-3)' : 'var(--rmg-color-surface-white)',
    fontFamily: 'var(--rmg-font-body)',
    fontSize,
    color: isDisabled ? 'var(--rmg-color-grey-1)' : 'var(--rmg-color-text-body)',
    outline: 'none',
    appearance: 'none' as const,
    boxSizing: 'border-box' as const,
    cursor: isDisabled ? 'not-allowed' : 'default',
  }

  const trailingStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: isDisabled ? 'var(--rmg-color-grey-2)' : 'var(--rmg-color-grey-1)',
    display: 'flex',
    alignItems: 'center',
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    if (!controlled) setInternalValue(e.target.value)
    onChange?.(e)
  }

  let TrailingIcon: React.ReactNode = null
  if (variant === 'validated') {
    TrailingIcon = (
      <span style={{ ...trailingStyle, color: 'var(--rmg-color-green)' }}>
        <CheckmarkIcon />
      </span>
    )
  } else if (type === 'dropdown') {
    TrailingIcon = <span style={trailingStyle}><ChevronDownIcon /></span>
  } else if (type === 'date') {
    TrailingIcon = <span style={trailingStyle}><CalendarIcon /></span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: 'var(--rmg-color-red)', marginLeft: '2px' }}>*</span>
        )}
      </label>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {type === 'dropdown' ? (
          <select
            id={id}
            name={name}
            disabled={isDisabled}
            value={controlled ? value : internalValue}
            onChange={handleChange}
            aria-invalid={variant === 'error'}
            aria-describedby={variant === 'error' && errorMessage ? errorId : undefined}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={sharedInputStyle}
          >
            {placeholder && <option value="" disabled>{placeholder}</option>}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            type={type === 'date' ? 'date' : 'text'}
            disabled={isDisabled}
            value={controlled ? value : internalValue}
            placeholder={placeholder}
            onChange={handleChange}
            aria-invalid={variant === 'error'}
            aria-describedby={variant === 'error' && errorMessage ? errorId : undefined}
            aria-required={required}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={sharedInputStyle}
          />
        )}
        {TrailingIcon}
      </div>

      {variant === 'error' && errorMessage && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 'var(--rmg-text-c1)',
            lineHeight: 'var(--rmg-leading-c1)',
            color: 'var(--rmg-color-red)',
            marginTop: '4px',
          }}
        >
          {errorMessage}
        </span>
      )}
    </div>
  )
}

export default FormField
