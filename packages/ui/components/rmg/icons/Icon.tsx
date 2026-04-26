import React from 'react'
import { ICON_PATHS, IconName } from './iconPaths'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
  'aria-hidden'?: boolean
}

export function Icon({
  name,
  size = 20,
  color,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden = true,
}: IconProps) {
  const isSmallChevron = name.endsWith('-sm')
  const isLocation = name === 'location'
  const isEdit = name === 'edit' || name === 'check'

  const innerViewBox = isSmallChevron
    ? name === 'chevron-down-sm' || name === 'chevron-up-sm'
      ? '0 0 16 10'
      : '0 0 10 16'
    : isLocation || isEdit
      ? '0 0 16 16'
      : '0 0 20 20'

  return (
    <svg
      width={size}
      height={size}
      viewBox={innerViewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ color, flexShrink: 0, ...style }}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  )
}
