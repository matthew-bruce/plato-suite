import { describe, expect, it } from 'vitest'
import { isPublicPath, PUBLIC_PATHS } from '../routes'

describe('isPublicPath', () => {
  it('treats the three auth pages as public', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/forgot-password')).toBe(true)
    expect(isPublicPath('/reset-password')).toBe(true)
  })

  it('exposes exactly those three as PUBLIC_PATHS', () => {
    expect([...PUBLIC_PATHS]).toEqual(['/login', '/forgot-password', '/reset-password'])
  })

  it('treats the /auth code-exchange routes as public', () => {
    expect(isPublicPath('/auth')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
    expect(isPublicPath('/auth/confirm')).toBe(true)
  })

  it('gates every application route', () => {
    expect(isPublicPath('/')).toBe(false)
    expect(isPublicPath('/schedule')).toBe(false)
    expect(isPublicPath('/rates')).toBe(false)
    expect(isPublicPath('/domains')).toBe(false)
    expect(isPublicPath('/domains/some-slug')).toBe(false)
  })

  it('does not treat a path that merely starts with an auth-page name as public', () => {
    // Guards against a naive startsWith('/login') that would also match these.
    expect(isPublicPath('/login-history')).toBe(false)
    expect(isPublicPath('/reset-password-admin')).toBe(false)
    expect(isPublicPath('/authorised')).toBe(false)
  })
})
