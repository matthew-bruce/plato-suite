import { describe, expect, it } from 'vitest'
import { computeCalendarPopupPosition, type TriggerRect } from '../calendarPopupPosition'

const VIEWPORT_HEIGHT = 800
const POPUP_HEIGHT = 320

function trigger(overrides: Partial<TriggerRect> = {}): TriggerRect {
  return { top: 100, bottom: 130, left: 40, width: 200, ...overrides }
}

describe('computeCalendarPopupPosition', () => {
  it('opens below when there is plenty of room', () => {
    const result = computeCalendarPopupPosition(trigger(), POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(result.openUp).toBe(false)
    expect(result.top).toBe(130 + 6) // trigger.bottom + default gap
    expect(result.left).toBe(40)
    expect(result.width).toBe(200)
  })

  it('flips upward when there is not enough room below but plenty above', () => {
    // Trigger near the bottom of an 800px-tall viewport, popup needs 320px.
    const rect = trigger({ top: 650, bottom: 680 })
    const result = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(result.openUp).toBe(true)
    expect(result.top).toBe(650 - 6 - 320) // trigger.top - gap - popupHeight
  })

  it('does not flip when space below exactly equals the popup height', () => {
    // spaceBelow = viewportHeight - bottom - gap = 800 - 474 - 6 = 320 = popupHeight, not < it
    const rect = trigger({ top: 444, bottom: 474 })
    const result = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(result.openUp).toBe(false)
  })

  it('stays down when neither direction fully fits but below has more room', () => {
    // spaceBelow = 800 - 500 - 6 = 294; spaceAbove = 480 - 6 = 474... make below bigger instead
    const rect = trigger({ top: 100, bottom: 780 }) // spaceBelow=14, spaceAbove=94 -> above bigger, should flip
    const flipped = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(flipped.openUp).toBe(true)

    // Now the opposite: more room below than above, neither fits -> stays down.
    const rect2 = trigger({ top: 20, bottom: 700 }) // spaceAbove=14, spaceBelow=94 -> below bigger, stays down
    const stays = computeCalendarPopupPosition(rect2, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(stays.openUp).toBe(false)
  })

  it('clamps the flipped-up top to the margin instead of going off-screen', () => {
    // Trigger very close to the top edge; popup taller than the space above it.
    const rect = trigger({ top: 50, bottom: 900 }) // spaceBelow negative -> definitely flips
    const result = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(result.openUp).toBe(true)
    expect(result.top).toBe(8) // clamped to default margin, not 50 - 6 - 320 (negative)
  })

  it('respects custom gap and margin overrides', () => {
    const rect = trigger({ top: 650, bottom: 680 })
    const result = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT, { gap: 10, margin: 20 })
    expect(result.top).toBe(650 - 10 - 320)
  })

  it('passes left and width through unchanged regardless of direction', () => {
    const rect = trigger({ left: 77, width: 260, top: 650, bottom: 680 })
    const result = computeCalendarPopupPosition(rect, POPUP_HEIGHT, VIEWPORT_HEIGHT)
    expect(result.left).toBe(77)
    expect(result.width).toBe(260)
  })
})
