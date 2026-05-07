import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pyPath, pyFetch } from '../pythonClient'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue(new Response('{}', { status: 200 }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  mockFetch.mockReset()
})

// ── pyPath ─────────────────────────────────────────────────────────────────────

describe('pyPath', () => {
  it('prefixes a leading-slash path with /py', () => {
    expect(pyPath('/anomalies')).toBe('/py/anomalies')
  })

  it('prefixes a path without leading slash with /py/', () => {
    expect(pyPath('anomalies')).toBe('/py/anomalies')
  })

  it('handles nested paths', () => {
    expect(pyPath('/stream/summary')).toBe('/py/stream/summary')
  })

  it('handles nested paths without leading slash', () => {
    expect(pyPath('stream/summary')).toBe('/py/stream/summary')
  })
})

// ── pyFetch ────────────────────────────────────────────────────────────────────

describe('pyFetch', () => {
  it('calls fetch with /py-prefixed path from a leading-slash path', async () => {
    await pyFetch('/anomalies')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/py/anomalies', {})
  })

  it('calls fetch with /py-prefixed path from a path without leading slash', async () => {
    await pyFetch('recommendations')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/py/recommendations', {})
  })

  it('calls fetch with /py-prefixed nested path', async () => {
    await pyFetch('/stream/summary')
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/py/stream/summary', {})
  })

  it('passes Authorization Bearer token header through to fetch', async () => {
    const opts: RequestInit = {
      headers: { Authorization: 'Bearer test-token-py456' },
    }
    await pyFetch('/anomalies', opts)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/py/anomalies',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token-py456' }),
      })
    )
  })

  it('passes all request options through to fetch', async () => {
    const opts: RequestInit = { method: 'POST', body: '{"node_id":"node-1"}' }
    await pyFetch('/anomalies', opts)
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/py/anomalies', opts)
  })

  it('returns the Response from fetch', async () => {
    const mockResponse = new Response('{"anomalies":[]}', { status: 200 })
    mockFetch.mockResolvedValueOnce(mockResponse)
    const result = await pyFetch('/anomalies')
    expect(result).toBe(mockResponse)
  })

  it('propagates fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    await expect(pyFetch('/anomalies')).rejects.toThrow('Network error')
  })
})
