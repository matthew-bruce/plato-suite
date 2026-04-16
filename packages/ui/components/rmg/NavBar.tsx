'use client'

import { useState, useEffect } from 'react'

export interface NavItem {
  label: string
  hasDropdown?: boolean
  active?: boolean
  href?: string
  onClick?: () => void
}

export interface NavBarProps {
  logoSlot: React.ReactNode
  items?: NavItem[]
  variant?: 'logged-out' | 'logged-in'
  authLabel?: string
  ctaLabel?: string
  ctaArrow?: boolean
  onCtaClick?: () => void
  onAuthClick?: () => void
  onSearchClick?: () => void
  onMenuOpen?: () => void
}

function ChevronDownIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11 3.99989L6 8.99989L1 3.99989" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SearchIcon({ onClick }: { onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Search">
        <path fillRule="evenodd" clipRule="evenodd" d="M6.56729 15.4959C6.56729 10.5648 10.5648 6.56727 15.4959 6.56727C20.4271 6.56727 24.4246 10.5648 24.4246 15.4959C24.4246 20.4271 20.4271 24.4245 15.4959 24.4245C10.5648 24.4245 6.56729 20.4271 6.56729 15.4959ZM15.4959 4.96727C9.68112 4.96727 4.96729 9.6811 4.96729 15.4959C4.96729 21.3107 9.68112 26.0245 15.4959 26.0245C18.1159 26.0245 20.5123 25.0676 22.3548 23.4842L25.669 26.7983C25.9814 27.1108 26.4879 27.1108 26.8003 26.7983C27.1128 26.4859 27.1128 25.9794 26.8003 25.667L23.486 22.3526C25.0683 20.5104 26.0246 18.1148 26.0246 15.4959C26.0246 9.6811 21.3107 4.96727 15.4959 4.96727Z" fill="var(--rmg-color-text-heading)"/>
      </svg>
    </div>
  )
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15.9593 16.6279C15.9593 17.107 15.5706 17.5 15.0897 17.5H4.61958C4.14091 17.5 3.75 17.1084 3.75 16.6279C3.75 13.2564 6.48314 10.5233 9.85465 10.5233C13.2262 10.5233 15.9593 13.2564 15.9593 16.6279ZM9.85465 11.5698C7.11949 11.5698 4.89139 13.7407 4.79946 16.4535H14.9098C14.8179 13.7407 12.5898 11.5698 9.85465 11.5698ZM9.85465 9.82558C7.83175 9.82558 6.19186 8.18569 6.19186 6.16279C6.19186 4.13989 7.83175 2.5 9.85465 2.5C11.8776 2.5 13.5174 4.13989 13.5174 6.16279C13.5174 8.18569 11.8776 9.82558 9.85465 9.82558ZM9.85465 8.77907C11.2996 8.77907 12.4709 7.60772 12.4709 6.16279C12.4709 4.71786 11.2996 3.54651 9.85465 3.54651C8.40972 3.54651 7.23837 4.71786 7.23837 6.16279C7.23837 7.60772 8.40972 8.77907 9.85465 8.77907Z" fill="var(--rmg-color-text-heading)" stroke="var(--rmg-color-text-heading)" strokeWidth="0.2"/>
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 9.33337H28M4 16H28M4 22.6667H28" stroke="var(--rmg-color-black)" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  )
}

export function NavBar({
  logoSlot,
  items = [],
  variant = 'logged-out',
  authLabel,
  ctaLabel = 'Send an item',
  ctaArrow = true,
  onCtaClick,
  onAuthClick,
  onSearchClick,
  onMenuOpen,
}: NavBarProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const resolvedAuthLabel = authLabel ?? (
    variant === 'logged-in' ? 'My account  |  Log out' : 'Log in  |  Register'
  )

  const containerBase: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--rmg-color-white)',
    boxShadow: 'var(--rmg-shadow-header)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    boxSizing: 'border-box',
  }

  // ── Mobile layout ─────────────────────────────────────────────────
  if (isMobile) {
    return (
      <nav
        style={{
          ...containerBase,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 13,
          paddingBottom: 13,
        }}
      >
        {logoSlot}
        <button
          onClick={onMenuOpen}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>
      </nav>
    )
  }

  // ── Desktop layout ────────────────────────────────────────────────
  return (
    <nav
      style={{
        ...containerBase,
        paddingLeft: 165,
        paddingRight: 165,
        paddingTop: 10,
        paddingBottom: 10,
      }}
    >
      {/* Left: logo + nav items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {logoSlot}

        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            {items.map((item, index) => {
              const isHovered = hoveredIndex === index
              const labelColor = isHovered
                ? 'var(--rmg-color-red)'
                : 'var(--rmg-color-text-heading)'
              const chevronColor = isHovered
                ? 'var(--rmg-color-red)'
                : 'var(--rmg-color-text-heading)'

              const inner = (
                <>
                  <span
                    style={{
                      fontFamily: 'var(--rmg-font-display)',
                      fontWeight: 700,
                      fontSize: 'var(--rmg-text-b3)',
                      lineHeight: 'var(--rmg-leading-b3)',
                      color: labelColor,
                      transition: 'color 150ms ease',
                    }}
                  >
                    {item.label}
                  </span>
                  {item.hasDropdown && <ChevronDownIcon color={chevronColor} />}
                  {item.active && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: 'var(--rmg-color-red)',
                        borderRadius: 4,
                      }}
                    />
                  )}
                </>
              )

              const commonStyle: React.CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                position: 'relative',
                paddingBottom: 10,
                background: 'none',
                border: 'none',
                textDecoration: 'none',
              }

              return item.href ? (
                <a
                  key={index}
                  href={item.href}
                  style={commonStyle}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {inner}
                </a>
              ) : (
                <button
                  key={index}
                  type="button"
                  style={commonStyle}
                  onClick={item.onClick}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {inner}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Right: auth + search + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Auth area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: variant === 'logged-in' ? 1 : 0 }}>
          {variant === 'logged-in' && <AccountIcon />}
          <span
            onClick={onAuthClick}
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontWeight: 400,
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-text-heading)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedAuthLabel}
          </span>
        </div>

        {/* Search */}
        <SearchIcon onClick={onSearchClick} />

        {/* CTA button */}
        <button
          type="button"
          onClick={onCtaClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 13,
            paddingBottom: 13,
            backgroundColor: 'var(--rmg-color-red)',
            borderRadius: 100,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--rmg-font-body)',
              fontWeight: 700,
              fontSize: 'var(--rmg-text-b3)',
              lineHeight: 'var(--rmg-leading-b3)',
              color: 'var(--rmg-color-white)',
              whiteSpace: 'nowrap',
            }}
          >
            {ctaLabel}
          </span>
          {ctaArrow && (
            <svg width="12" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M7.40198 3L10.402 6L7.40198 9M2 6H10.318" stroke="white" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    </nav>
  )
}
