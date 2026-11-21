import { afterEach, describe, expect, it, vi } from 'vitest';

import { listAlerts } from './alerts';

describe('alerts API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the backend pagination and alert filter parameter names', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: 'alert-1', type: 'deployment_failed', severity: 'high', application_id: 'app-1',
        application_name: 'payments', deployment_id: 'dep-1', message: 'Deployment failed',
        since: '2026-01-01T00:00:00Z',
      }],
      total: 1,
      limit: 25,
      offset: 5,
      generated_at: '2026-01-01T00:01:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await listAlerts({ limit: 25, offset: 5, severity: 'high', type: 'deployment_failed', application_id: 'app-1' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/alerts?limit=25&offset=5&severity=high&type=deployment_failed&application_id=app-1',
    );
  });

  it('rejects malformed alert payloads instead of trusting their TypeScript type', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ id: 'alert-1', severity: 'critical' }], total: 1, limit: 10, offset: 0,
      generated_at: '2026-01-01T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(listAlerts({ limit: 10, offset: 0 })).rejects.toMatchObject({ kind: 'parse' });
  });
});
