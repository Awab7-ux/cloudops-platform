import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeProbe } from './apiService';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('executeProbe', () => {
  it('normalizes the endpoint and returns a successful JSON payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const result = await executeProbe<{ status: string }>('https://api.example.test/', 'health');

    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.objectContaining({ method: 'GET' }));
    expect(result).toMatchObject({ ok: true, status: 200, data: { status: 'ok' } });
    expect(result.rttMs).toBeGreaterThanOrEqual(1);
  });

  it('returns a safe network error without echoing the request URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')));

    const result = await executeProbe('https://api.example.test/?token=secret', '/health');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network unavailable');
    expect(result.error).not.toContain('secret');
  });

  it('reports the configured timeout and aborts the request', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);

    const probe = executeProbe('https://api.example.test', '/health', 250);
    await vi.advanceTimersByTimeAsync(250);
    const result = await probe;

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Connection timed out after 250 ms');
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('keeps the timeout active while reading the response body', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      json: () => new Promise<unknown>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), { once: true });
      }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    const probe = executeProbe('https://api.example.test', '/health', 100);
    await vi.advanceTimersByTimeAsync(100);
    const result = await probe;

    expect(result).toMatchObject({ ok: false, error: 'Connection timed out after 100 ms' });
  });

  it('keeps a successful probe result when the response body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));

    const result = await executeProbe('https://api.example.test', '/health');

    expect(result).toMatchObject({ ok: true, status: 200, data: null });
  });
});
