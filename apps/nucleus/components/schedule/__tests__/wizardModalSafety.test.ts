// Source-content regression test for the wizard-modals-close-on-outside-click
// bug: an accidental click on the backdrop used to call onClose directly,
// discarding everything entered across a multi-step wizard with no warning.
//
// No DOM-rendering test setup exists for this codebase's React components, so
// this pins the relevant source text directly — see the note in
// schedulePrivacyMode.test.ts for the precedent.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = fileURLToPath(new URL('.', import.meta.url))

function readSource(name: string): string {
  return readFileSync(new URL(`../${name}`, `file://${testDir}`), 'utf8')
}

// Both are multi-step ("Search/Details/Confirm" and "Period/Copy
// forward/Confirm") wizards that build up entered state across steps before
// submitting — the same shape and the same risk the bug report named.
const WIZARD_FILES = ['AddResourceWizard.tsx', 'CreatePeriodWizard.tsx']

describe.each(WIZARD_FILES)('%s', (file) => {
  const source = readSource(file)

  it('never closes on an outside click of its overlay', () => {
    // The top-level wizard overlay (role="dialog" aria-modal — distinct from
    // any nested confirmation dialog the wizard may also render, which has
    // its own separate overlay/onCancel and isn't the bug this pins) must
    // render with no onClick handler at all: a click there has to be a
    // no-op, not a call to onClose.
    expect(source).toMatch(/<div style=\{overlay\} role="dialog" aria-modal>/)
    expect(source).not.toMatch(/<div style=\{overlay\} role="dialog" aria-modal onClick=/)
    expect(source).not.toMatch(/<div style=\{overlay\}[^>]*onClick=\{onClose\}/)
  })

  it('Escape has no handler either, consistent with outside-click also doing nothing', () => {
    // Neither should silently bypass the other: outside-click is now a no-op,
    // so Escape must not be the one remaining way to lose entered data. Not a
    // bare /Escape/ check — this file's own comments explain that choice in
    // words, which would otherwise make this test fail on its own commentary.
    expect(source).not.toMatch(/addEventListener\(\s*['"]keydown['"]/)
    expect(source).not.toMatch(/key\s*===\s*['"]Escape['"]/)
  })

  it('the explicit X button still closes immediately — a deliberate exit stays unprompted', () => {
    expect(source).toContain('aria-label="Close"')
    expect(source).toMatch(/onClick=\{onClose\}/)
  })
})
