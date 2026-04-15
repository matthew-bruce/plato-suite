'use client'

import { forwardRef, useState } from 'react'

export type ButtonVariant = 'solid' | 'outline' | 'link'
export type ButtonSize = 'large' | 'medium' | 'small'
export type ButtonBackground = 'light' | 'dark'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  background?: ButtonBackground
  iconLeft?: React.ReactNode
  children: React.ReactNode
}

const ARROW_PATH = 'M7.40198 3L10.402 6L7.40198 9M2 6H10.318'

const SIZE_CONFIG = {
  large:  { height: 56, paddingInline: 32, fontSize: 'var(--rmg-text-b2)',  lineHeight: 'var(--rmg-leading-b2)',  iconSize: 16, gap: 10 },
  medium: { height: 48, paddingInline: 28, fontSize: 'var(--rmg-text-b3)',  lineHeight: 'var(--rmg-leading-b3)',  iconSize: 14, gap: 8  },
  small:  { height: 40, paddingInline: 24, fontSize: 'var(--rmg-text-c1)',  lineHeight: 'var(--rmg-leading-c1)',  iconSize: 12, gap: 6  },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'solid',
      size = 'large',
      background = 'light',
      iconLeft,
      children,
      disabled = false,
      style,
      onMouseEnter,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false)
    const [isPressed, setIsPressed] = useState(false)
    const [isFocused, setIsFocused] = useState(false)

    const { height, paddingInline, fontSize, lineHeight, iconSize, gap } = SIZE_CONFIG[size]

    const focusColor = background === 'dark'
      ? 'var(--rmg-color-white)'
      : 'var(--rmg-color-black)'

    // Link variant: gap animates from 4px → 6px on hover/pressed
    const computedGap = variant === 'link'
      ? ((isHovered || isPressed) && !disabled ? 6 : 4)
      : gap

    // ── Solid styles ────────────────────────────────────────────────
    const getSolidStyle = (): React.CSSProperties => {
      let backgroundColor: string
      let color: string

      if (disabled) {
        backgroundColor = 'var(--rmg-color-grey-2)'
        color = 'var(--rmg-color-grey-1)'
      } else if (background === 'dark') {
        backgroundColor = isPressed
          ? 'var(--rmg-color-grey-2)'
          : isHovered
          ? 'var(--rmg-color-grey-3)'
          : 'var(--rmg-color-white)'
        color = isPressed ? 'var(--rmg-color-warm-red)' : 'var(--rmg-color-red)'
      } else {
        backgroundColor = isPressed
          ? 'var(--rmg-color-deep-red)'
          : isHovered
          ? 'var(--rmg-color-warm-red)'
          : 'var(--rmg-color-red)'
        color = 'var(--rmg-color-white)'
      }

      return {
        height,
        paddingInline,
        borderRadius: 'var(--rmg-radius-xl)',
        backgroundColor,
        color,
        outline: isFocused && !disabled ? `2px solid ${focusColor}` : 'none',
        outlineOffset: isFocused && !disabled ? 2 : undefined,
      }
    }

    // ── Outline styles ───────────────────────────────────────────────
    const getOutlineStyle = (): React.CSSProperties => {
      if (isFocused && !disabled) {
        return {
          height,
          paddingInline,
          borderRadius: 'var(--rmg-radius-xl)',
          backgroundColor: 'transparent',
          color: background === 'dark' ? 'var(--rmg-color-white)' : 'var(--rmg-color-red)',
          outline: `2px solid ${focusColor}`,
          outlineOffset: 2,
        }
      }

      if (disabled) {
        return {
          height,
          paddingInline,
          borderRadius: 'var(--rmg-radius-xl)',
          backgroundColor: 'transparent',
          color: 'var(--rmg-color-grey-1)',
          outline: '2px solid var(--rmg-color-grey-2)',
          outlineOffset: -2,
        }
      }

      if (background === 'dark') {
        const bg = isPressed
          ? 'rgba(255, 255, 255, 0.2)'
          : isHovered
          ? 'rgba(255, 255, 255, 0.1)'
          : 'transparent'
        return {
          height,
          paddingInline,
          borderRadius: 'var(--rmg-radius-xl)',
          backgroundColor: bg,
          color: 'var(--rmg-color-white)',
          outline: '2px solid var(--rmg-color-white)',
          outlineOffset: -2,
        }
      }

      // light background
      const accentColor = isPressed
        ? 'var(--rmg-color-deep-red)'
        : isHovered
        ? 'var(--rmg-color-warm-red)'
        : 'var(--rmg-color-red)'

      return {
        height,
        paddingInline,
        borderRadius: 'var(--rmg-radius-xl)',
        backgroundColor: 'transparent',
        color: accentColor,
        outline: `2px solid ${accentColor}`,
        outlineOffset: -2,
      }
    }

    // ── Link styles ──────────────────────────────────────────────────
    const getLinkStyle = (): React.CSSProperties => {
      let color: string

      if (disabled) {
        color = background === 'dark'
          ? 'rgba(255, 255, 255, 0.4)'
          : 'var(--rmg-color-grey-1)'
      } else if (background === 'dark') {
        color = (isHovered || isPressed)
          ? 'var(--rmg-color-yellow)'
          : 'var(--rmg-color-white)'
      } else {
        color = isPressed
          ? 'var(--rmg-color-deep-red)'
          : isHovered
          ? 'var(--rmg-color-warm-red)'
          : 'var(--rmg-color-red)'
      }

      return {
        height: 'auto',
        paddingInline: 0,
        backgroundColor: 'transparent',
        color,
        outline: isFocused && !disabled ? `2px solid ${focusColor}` : 'none',
        outlineOffset: isFocused && !disabled ? 2 : undefined,
        borderRadius: 2,
      }
    }

    const variantStyle =
      variant === 'solid'
        ? getSolidStyle()
        : variant === 'outline'
        ? getOutlineStyle()
        : getLinkStyle()

    const computedStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: computedGap,
      fontFamily: 'var(--rmg-font-body)',
      fontSize,
      lineHeight,
      fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      padding: 0,
      transition: 'background-color 150ms, color 150ms, outline-color 150ms, gap 150ms',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      textDecoration: 'none',
      ...variantStyle,
      ...style,
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        style={computedStyle}
        onMouseEnter={(e) => { if (!disabled) setIsHovered(true); onMouseEnter?.(e) }}
        onMouseLeave={(e) => { setIsHovered(false); setIsPressed(false); onMouseLeave?.(e) }}
        onMouseDown={(e) => { if (!disabled) setIsPressed(true); onMouseDown?.(e) }}
        onMouseUp={(e) => { setIsPressed(false); onMouseUp?.(e) }}
        onFocus={(e) => { setIsFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setIsFocused(false); onBlur?.(e) }}
        {...rest}
      >
        {iconLeft && variant !== 'link' && (
          <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">
            {iconLeft}
          </span>
        )}
        {children}
        {variant === 'link' && (
          <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 13 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path
              d={ARROW_PATH}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
