'use client'

import { Fragment } from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string  // undefined = current page (rendered as plain text, no underline)
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  paddingX?: number
}

export function Breadcrumb({ items, paddingX = 30 }: BreadcrumbProps) {
  return (
    <div
      style={{
        width: '100%',
        backgroundColor: 'var(--rmg-color-dark-grey)',
        paddingTop: 17,
        paddingBottom: 17,
      }}
    >
      <div
        style={{
          paddingLeft: paddingX,
          paddingRight: paddingX,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'nowrap',
        }}
      >
        {items.map((item, index) => {
          const isFirst = index === 0
          const isLast = index === items.length - 1
          const isCurrentPage = isLast && !item.href

          const textStyle: React.CSSProperties = {
            fontFamily: 'var(--rmg-font-body)',
            fontSize: 16,
            lineHeight: '22px',
            color: 'var(--rmg-color-white)',
            fontWeight: isFirst ? 700 : 400,
            textDecoration: isCurrentPage ? 'none' : 'underline',
            textDecorationColor: 'var(--rmg-color-white)',
            whiteSpace: 'nowrap',
          }

          const node = item.href ? (
            <a href={item.href} style={textStyle}>
              {item.label}
            </a>
          ) : (
            <span style={textStyle}>
              {item.label}
            </span>
          )

          return (
            <Fragment key={index}>
              {node}
              {!isLast && (
                <svg
                  width={6}
                  height={10}
                  viewBox="0 0 6 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <path
                    d="M0.75 0.75L4.75 4.75L0.75 8.75"
                    stroke="var(--rmg-color-white)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
