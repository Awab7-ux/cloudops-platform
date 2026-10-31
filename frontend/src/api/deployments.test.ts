import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './client';
import {
  allowedTransitions,
  createDeployment,
  getDeployment,
  listDeployments,
  updateDeploymentStatus,
} from './deployments';
import type { Deployment } from './types';

// WHY: stable timestamps make exact API response assertions deterministic.
function deployment(status: Deployment['status'] = 'pending'): Deployment {
  return {
    id: 'deploy/1',
    application_id: 'app/1',
    version: 'v1.2.3',
    commit_sha: null,
    status,
    started_at: null,
    finished_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

// WHY: a JSON fetch stub exercises request serialization without network access.
function mockSuccess(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('deployment API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('lists deployments using the selected application and pagination query', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    const fetchMock = mockSuccess({ items: [deployment()], total: 1, limit: 25, offset: 5 });
    await expect(listDeployments('app/1', { limit: 25, offset: 5 })).resolves.toMatchObject({
      total: 1,
      offset: 5,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/applications/app%2F1/deployments?limit=25&offset=5',
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  it('gets a deployment with an encoded identifier', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = mockSuccess(deployment());
    await expect(getDeployment('deploy/1')).resolves.toMatchObject({ status: 'pending' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/deployments/deploy%2F1');
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  it('creates a deployment using only the supported request fields', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = mockSuccess(deployment(), 201);
    await createDeployment('app/1', { version: 'v1.2.3', commit_sha: 'abcdef1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/applications/app%2F1/deployments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ version: 'v1.2.3', commit_sha: 'abcdef1' }),
      }),
    );
  });

  it('patches status with the backend status body key', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const fetchMock = mockSuccess(deployment('running'));
    await updateDeploymentStatus('deploy/1', 'running');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/deployments/deploy%2F1/status',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'running' }) }),
    );
  });

  it('propagates HTTP errors including 500, 404, 409, and field-level 422 errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    for (const [status, detail, fields] of [
      [404, 'deployment not found', {}],
      [409, 'invalid status transition', { name: 'invalid status transition' }],
      [422, 'validation error', { version: 'String should have at least 1 character' }],
      [500, 'Request failed (HTTP 500).', {}],
    ] as const) {
      const body = status === 422
        ? { detail: [{ loc: ['body', 'version'], msg: fields.version ?? 'invalid' }] }
        : { detail };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
      ));
      await expect(getDeployment('id')).rejects.toMatchObject({
        status,
        kind: 'http',
        fieldErrors: fields,
      });
    }
  });

  it('maps network failures and invalid successful JSON to typed errors', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(getDeployment('id')).rejects.toMatchObject({ kind: 'network' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ));
    await expect(getDeployment('id')).rejects.toMatchObject({ kind: 'parse' });
  });

  it('aborts timed-out requests and handles a bodyless 204 response', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const pending = getDeployment('id');
    const pendingAssertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(10_000);
    await pendingAssertion;

    vi.useRealTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(updateDeploymentStatus('id', 'running')).resolves.toBeUndefined();
  });

  it.each([
    ['pending', ['running']],
    ['running', ['succeeded', 'failed']],
    ['succeeded', ['rolled_back']],
    ['failed', ['rolled_back']],
    ['rolled_back', []],
  ] as const)('returns allowed transitions from %s', (status, transitions) => {
    expect(allowedTransitions(status)).toEqual(transitions);
  });

  it('exposes typed API failures', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'missing' }), { status: 404 }),
    ));
    try {
      await getDeployment('id');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
    }
  });
});
