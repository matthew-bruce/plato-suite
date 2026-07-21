export interface TriggerRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface CalendarPopupPosition {
  top: number
  left: number
  width: number
  /** True when the popup is being opened above the trigger instead of below. */
  openUp: boolean
}

/**
 * Decide whether the calendar popup should open below (the default) or
 * above the trigger, and where.
 *
 * Flips upward only when there's genuinely not enough room below AND more
 * room above than below — so a popup that doesn't fit in either direction
 * (a very short viewport) still opens on whichever side gives it more
 * space, rather than flipping into an even tighter spot.
 */
export function computeCalendarPopupPosition(
  triggerRect: TriggerRect,
  popupHeight: number,
  viewportHeight: number,
  opts: { gap?: number; margin?: number } = {},
): CalendarPopupPosition {
  const gap = opts.gap ?? 6
  const margin = opts.margin ?? 8

  const spaceBelow = viewportHeight - triggerRect.bottom - gap
  const spaceAbove = triggerRect.top - gap
  const openUp = spaceBelow < popupHeight && spaceAbove > spaceBelow

  const top = openUp
    ? Math.max(margin, triggerRect.top - gap - popupHeight)
    : triggerRect.bottom + gap

  return { top, left: triggerRect.left, width: triggerRect.width, openUp }
}
