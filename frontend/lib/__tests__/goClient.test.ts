import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { goPath, goFetch } from '../goClient'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  mockFetch.mockReset()
})

// ── goPath ─────────────────────────────────────────────────────────────────────

describe('goPath', () => {
  it('prefixes a leading-slash path with /go', () => {
    expect(goPath('/nodes')).toBe('/go/nodes')
  })

  it('prefixes a path without leading slash with /go/', () => {
    expect(goPath('nodes')).toBe('/go/nodes')
  })

  it('handles nested paths', () => {
    expect(goPath('/api/v1/nodes')).toBe('/go/api/v1/nodes')
  })

  it('handles nested paths without leading slash', () => {
    expect(goPath('api/v1/nodes')).toBe('/go/api/v1/nodes')
  })
})

// ── goFetch ────────────────────────────────────────────────────────────────────

describe('goFetch', () => {
  it('calls fetch with /go-prefixed path from a leading-slash path', async () => {
    await goFetch('/nodes')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/go/nodes', {})
  })

  it('calls fetch with /go-prefixed path from a path without leading slash', async () => {
    await goFetch('health')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/go/health', {})
  })

  it('calls fetch with /go-prefixed nested path', async () => {
    await goFetch('/api/v1/nodes')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/go/api/v1/nodes', {})
  })

  it('passes Authorization Bearer token header through to fetch', async () => {
    const opts: RequestInit = {
      headers: { Authorization: 'Bearer test-token-xyz789' },
    }
    await goFetch('/nodes', opts)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/go/nodes',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token-xyz789' }),
      })
    )
  })

  it('passes all request options through to fetch', async () => {
    const opts: RequestInit = { method: 'POST', body: '{"sensor":"A1"}' }
    await goFetch('/nodes', opts)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/go/nodes', opts)
  })

  it('returns the Response from fetch', async () => {
    const mockResponse = new Response('{"nodes":[]}', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)
    const result = await goFetch('/nodes')
    expect(result).toBe(mockResponse)
  })

  it('propagates fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    await expect(goFetch('/nodes')).rejects.toThrow('Network error')
  })
})
