import type * as React from 'react'

export interface PageToolbarProps {
  primaryRow: React.ReactNode
  filterRow?: React.ReactNode
  className?: string
}

export interface PageToolbarSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
}

export interface PageToolbarFilterPillProps {
  label: string
  active: boolean
  colour: string
  onClick: () => void
  style?: React.CSSProperties
}

export interface PageToolbarDropdownOption {
  value: string
  label: string
}

export interface PageToolbarDropdownProps {
  label: string
  value: string
  options: PageToolbarDropdownOption[]
  onChange: (value: string) => void
  style?: React.CSSProperties
}

export interface PageToolbarDividerProps {
  style?: React.CSSProperties
}

export interface PageToolbarPrimaryActionsProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export interface PageToolbarExpandButtonProps {
  expanded: boolean
  onToggle: () => void
  style?: React.CSSProperties
}

export interface PageToolbarResourceCountProps {
  children: React.ReactNode
  style?: React.CSSProperties
}
