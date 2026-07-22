import { describe, it, expect, vi } from 'vitest'
import { verifyStepUpPassword } from '../stepUp'

describe('verifyStepUpPassword', () => {
  it('returns ok when the injected sign-in succeeds', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: true })
    const res = await verifyStepUpPassword('user@example.com', 'correct-horse', signIn)
    expect(res).toEqual({ ok: true })
    expect(signIn).toHaveBeenCalledWith('user@example.com', 'correct-horse')
  })

  it('returns not-ok when the injected sign-in fails', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: false, error: 'Invalid login credentials' })
    const res = await verifyStepUpPassword('user@example.com', 'wrong', signIn)
    expect(res).toEqual({ ok: false })
  })

  it('does not leak the provider error — only a boolean is returned', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: false, error: 'user not found' })
    const res = await verifyStepUpPassword('user@example.com', 'wrong', signIn)
    expect(Object.keys(res)).toEqual(['ok'])
  })

  it('short-circuits to not-ok without calling sign-in when email is missing', async () => {
    const signIn = vi.fn()
    expect(await verifyStepUpPassword(null, 'anything', signIn)).toEqual({ ok: false })
    expect(await verifyStepUpPassword(undefined, 'anything', signIn)).toEqual({ ok: false })
    expect(await verifyStepUpPassword('   ', 'anything', signIn)).toEqual({ ok: false })
    expect(signIn).not.toHaveBeenCalled()
  })

  it('short-circuits to not-ok without calling sign-in when password is empty', async () => {
    const signIn = vi.fn()
    const res = await verifyStepUpPassword('user@example.com', '', signIn)
    expect(res).toEqual({ ok: false })
    expect(signIn).not.toHaveBeenCalled()
  })

  it('trims a padded email before verifying', async () => {
    const signIn = vi.fn().mockResolvedValue({ ok: true })
    await verifyStepUpPassword('  user@example.com  ', 'pw', signIn)
    expect(signIn).toHaveBeenCalledWith('user@example.com', 'pw')
  })
})
