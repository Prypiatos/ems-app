import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, wsUrl, gatewayBase, API_GATEWAY } from '../apiGateway'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  mockFetch.mockReset()
})

// ── API_GATEWAY ────────────────────────────────────────────────────────────────

describe('API_GATEWAY', () => {
  it('reads base URL from NEXT_PUBLIC_API_GATEWAY_URL env var', () => {
    expect(API_GATEWAY).toBe('http://localhost:8000')
  })
})

// ── gatewayBase ────────────────────────────────────────────────────────────────

describe('gatewayBase', () => {
  it('returns the API_GATEWAY value', () => {
    expect(gatewayBase()).toBe('http://localhost:8000')
  })
})

// ── apiFetch ───────────────────────────────────────────────────────────────────

describe('apiFetch', () => {
  it('joins base URL and leading-slash path correctly', async () => {
    await apiFetch('/api/v1/nodes')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/nodes', {})
  })

  it('joins base URL and path without leading slash correctly', async () => {
    await apiFetch('health')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/health', {})
  })

  it('returns base URL when path is empty', async () => {
    await apiFetch('')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000', {})
  })

  it('passes request options to fetch', async () => {
    const opts: RequestInit = { method: 'POST', body: JSON.stringify({ key: 'value' }) }
    await apiFetch('/api/v1/data', opts)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/api/v1/data', opts)
  })

  it('passes Authorization Bearer token header to fetch', async () => {
    const opts: RequestInit = {
      headers: { Authorization: 'Bearer test-token-abc123' },
    }
    await apiFetch('/api/v1/nodes', opts)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/nodes',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token-abc123' }),
      })
    )
  })

  it('passes additional headers alongside Authorization', async () => {
    const opts: RequestInit = {
      headers: {
        Authorization: 'Bearer test-token-abc123',
        'Content-Type': 'application/json',
      },
    }
    await apiFetch('/api/v1/nodes', opts)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/nodes',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-abc123',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('returns the Response from fetch', async () => {
    const mockResponse = new Response('{"ok":true}', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)
    const result = await apiFetch('/api/v1/nodes')
    expect(result).toBe(mockResponse)
  })

  it('propagates fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    await expect(apiFetch('/api/v1/nodes')).rejects.toThrow('Network error')
  })
})

// ── wsUrl ──────────────────────────────────────────────────────────────────────

describe('wsUrl', () => {
  it('converts http gateway to ws URL', () => {
    expect(wsUrl('/ws/live')).toBe('ws://localhost:8000/ws/live')
  })

  it('adds leading slash to path when missing', () => {
    expect(wsUrl('ws/live')).toBe('ws://localhost:8000/ws/live')
  })

  it('preserves hostname and port from API_GATEWAY', () => {
    expect(wsUrl('/ws/stream')).toContain('localhost:8000')
  })

  it('converts https gateway to wss URL', async () => {
    vi.resetModules()
    process.env.NEXT_PUBLIC_API_GATEWAY_URL = 'https://example.com:8443'
    const { wsUrl: wsUrlSecure } = await import('../apiGateway')

    expect(wsUrlSecure('/ws/live')).toBe('wss://example.com:8443/ws/live')

    process.env.NEXT_PUBLIC_API_GATEWAY_URL = 'http://localhost:8000'
    vi.resetModules()
  })
})
