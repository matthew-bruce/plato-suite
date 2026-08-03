import { describe, it, expect, vi } from 'vitest'
import { checkIsSuperuser } from '@plato/schema'

describe('checkIsSuperuser', () => {
  it('returns true when plato_is_superuser() RPC resolves true', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) }
    await expect(checkIsSuperuser(client)).resolves.toBe(true)
    expect(client.rpc).toHaveBeenCalledWith('plato_is_superuser')
  })

  it('returns false when plato_is_superuser() RPC resolves false', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) }
    await expect(checkIsSuperuser(client)).resolves.toBe(false)
  })

  it('fails closed (false) when the RPC errors, rather than surfacing a false positive', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) }
    await expect(checkIsSuperuser(client)).resolves.toBe(false)
  })

  it('fails closed (false) on an unexpected non-boolean data shape', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: 'yes', error: null }) }
    await expect(checkIsSuperuser(client)).resolves.toBe(false)
  })
})
