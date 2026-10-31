import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSummary } from './summary';

const summary = {
  applications: { total: 1, by_status: { healthy: 1, degraded: 0, down: 0, unknown: 0 }, by_environment: { production: 1, staging: 0, development: 0 } },
  deployments: { total: 2, by_status: { pending: 0, running: 0, succeeded: 1, failed: 1, rolled_back: 0 }, last_24h: 2 },
  logs: { total: 3, errors_last_24h: 1 },
  recent_failed_deployments: [{
    id: 'dep-1', application_id: 'app-1', application_name: 'payments', commit_sha: null,
    status: 'failed', finished_at: '2026-01-01T00:00:00Z',
  }],
  generated_at: '2026-01-01T00:01:00Z',
};

describe('summary API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('loads the real summary endpoint and response schema', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/root/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getSummary()).resolves.toEqual(summary);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/root/summary');
  });

  it('rejects malformed summary values', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...summary,
      deployments: { ...summary.deployments, last_24h: 'two' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(getSummary()).rejects.toMatchObject({ kind: 'parse' });
  });
});
