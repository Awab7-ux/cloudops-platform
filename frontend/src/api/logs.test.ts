import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './client';
import {
  createApplicationLog,
  listApplicationLogs,
  listDeploymentLogs,
  listLogs,
} from './logs';
import type { LogRecord } from './types';

const record: LogRecord = {
  id: 'log-1',
  application_id: 'app/1',
  deployment_id: 'dep-1',
  level: 'warning',
  message: 'worker restarted',
  source: 'worker',
  created_at: '2026-01-01T00:00:00Z',
};

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('logs API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends backend-supported pagination and filters to the global feed', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/root/');
    const fetchMock = respond({ items: [record], total: 51, limit: 50, offset: 0 });
    await listLogs({ limit: 50, offset: 0, level: 'warning', application_id: 'app/1', since: '2026-01-01T00:00:00Z' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/root/logs?limit=50&offset=0&level=warning&application_id=app%2F1&since=2026-01-01T00%3A00%3A00Z',
    );
  });

  it('uses encoded application and deployment-scoped log routes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const page = { items: [record], total: 1, limit: 10, offset: 0 };
    const fetchMock = respond(page).mockResolvedValueOnce(new Response(JSON.stringify(page), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await listApplicationLogs('app/1', { limit: 10, offset: 0 });
    await listDeploymentLogs('dep/1', { limit: 10, offset: 0, level: 'error' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/applications/app%2F1/logs?limit=10&offset=0');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.test/deployments/dep%2F1/logs?limit=10&offset=0&level=error');
  });

  it('creates only fields accepted by the log schema', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = respond(record, 201);
    await createApplicationLog('app/1', { level: 'warning', message: 'worker restarted', source: 'worker', deployment_id: 'dep-1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/applications/app%2F1/logs');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      level: 'warning', message: 'worker restarted', source: 'worker', deployment_id: 'dep-1',
    });
  });

  it('reports malformed responses as parse errors and preserves HTTP errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    respond({ items: [{ id: 'incomplete' }], total: 1, limit: 10, offset: 0 });
    await expect(listLogs({ limit: 10, offset: 0 })).rejects.toMatchObject({ kind: 'parse' });
    respond({ detail: 'logs unavailable' }, 503);
    await expect(listLogs({ limit: 10, offset: 0 })).rejects.toBeInstanceOf(ApiError);
    await expect(listLogs({ limit: 10, offset: 0 })).rejects.toMatchObject({ status: 503, kind: 'http' });
  });
});
