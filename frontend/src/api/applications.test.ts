import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from './applications';
import { ApiError } from './client';

// WHY: deterministic JSON responses keep client contract checks independent of a server.
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function applicationResponse(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    environment: 'development',
    status: 'unknown',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('application API client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // WHY: callers must use the configured API origin and the backend pagination contract.
  it('uses the environment base URL and URL-encodes list and item paths', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/root/');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, limit: 25, offset: 50 }))
      .mockResolvedValueOnce(jsonResponse(applicationResponse('a/b', 'App')));
    vi.stubGlobal('fetch', fetchMock);

    await listApplications({ limit: 25, offset: 50 });
    await getApplication('a/b');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.example.test/root/applications?limit=25&offset=50',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.example.test/root/applications/a%2Fb',
    );
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Content-Type')).toBe(false);
  });

  it('sends supported application filters as backend query parameters', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ items: [], total: 0, limit: 10, offset: 0 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listApplications({
      limit: 10,
      offset: 0,
      environment: 'production',
      status: 'degraded',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/applications?limit=10&offset=0&environment=production&status=degraded',
    );
  });

  // WHY: JSON content type is required on writes but should not be attached to bodyless reads.
  it('sends only schema fields as JSON for create requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ ...applicationResponse('app-1', 'New'), description: null }, 201),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createApplication({
      name: 'New',
      description: null,
      environment: 'development',
      status: 'unknown',
    });

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Content-Type'))
      .toBe('application/json');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      name: 'New',
      description: null,
      environment: 'development',
      status: 'unknown',
    });
  });

  // WHY: failures, item request details, and body-dependent headers are public client contracts.
  describe('application API error and request contracts', () => {
    const LOCAL_API_BASE_URL = 'http://api.test';
    const API_BASE_URL = 'https://api.example.test/root/';
    const ENCODED_APPLICATION_URL = 'https://api.example.test/root/applications/a%20b%2Fc';
    const APPLICATION_ID = 'app-1';
    const ENCODED_APPLICATION_ID = 'a b/c';
    const CONTENT_TYPE_HEADER = 'Content-Type';
    const JSON_CONTENT_TYPE = 'application/json';

    // WHY: request tests must not leak environment or fetch stubs into other contracts.
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    // WHY: server failures must retain their HTTP status and typed error category.
    it('maps HTTP 500 to a typed HTTP error with its status', async () => {
      vi.stubEnv('VITE_API_BASE_URL', LOCAL_API_BASE_URL);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        jsonResponse({ detail: 'internal server error' }, 500),
      ));

      let error: unknown;
      try {
        await createApplication({ name: 'Server error', environment: 'development' });
      } catch (caught: unknown) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 500, kind: 'http' });
    });

    // WHY: transport rejections must be distinguishable from server responses.
    it('maps a fetch TypeError to a typed network error', async () => {
      vi.stubEnv('VITE_API_BASE_URL', LOCAL_API_BASE_URL);
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      let error: unknown;
      try {
        await getApplication(APPLICATION_ID);
      } catch (caught: unknown) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 0, kind: 'network' });
    });

    // WHY: successful responses with unreadable bodies must not appear successful.
    it('maps invalid JSON in a successful response to a typed parse error', async () => {
      vi.stubEnv('VITE_API_BASE_URL', LOCAL_API_BASE_URL);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ));

      let error: unknown;
      try {
        await getApplication(APPLICATION_ID);
      } catch (caught: unknown) {
        error = caught;
      }

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 200, kind: 'parse' });
    });

    // WHY: item reads must encode identifiers and remain bodyless requests.
    it('gets an encoded application URL without a body or Content-Type header', async () => {
      vi.stubEnv('VITE_API_BASE_URL', API_BASE_URL);
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(applicationResponse('a b/c', 'Encoded')),
      );
      vi.stubGlobal('fetch', fetchMock);

      await getApplication(ENCODED_APPLICATION_ID);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        ENCODED_APPLICATION_URL,
      );
      expect(fetchMock.mock.calls[0][1]?.method ?? 'GET').toBe('GET');
      expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has(CONTENT_TYPE_HEADER)).toBe(false);
    });

    // WHY: PATCH must preserve the exact partial payload and declare its JSON body.
    it('patches an encoded application URL with only the supplied fields', async () => {
      vi.stubEnv('VITE_API_BASE_URL', API_BASE_URL);
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(applicationResponse('a b/c', 'Updated')),
      );
      vi.stubGlobal('fetch', fetchMock);
      const update = { description: null };

      await updateApplication(ENCODED_APPLICATION_ID, update);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        ENCODED_APPLICATION_URL,
      );
      expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
      expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify(update));
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get(CONTENT_TYPE_HEADER))
        .toBe(JSON_CONTENT_TYPE);
    });

    // WHY: DELETE must use an encoded bodyless request and accept the API's 204 response.
    it('deletes an encoded application without a body or Content-Type header', async () => {
      vi.stubEnv('VITE_API_BASE_URL', API_BASE_URL);
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(deleteApplication(ENCODED_APPLICATION_ID)).resolves.toBeUndefined();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(
        ENCODED_APPLICATION_URL,
      );
      expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE');
      expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has(CONTENT_TYPE_HEADER)).toBe(false);
    });
  });

  // WHY: server conflicts should be actionable on the application name field.
  it('maps HTTP 409 to a typed conflict error', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ detail: 'application name already exists' }, 409),
    ));

    await expect(createApplication({ name: 'Duplicate', environment: 'development' }))
      .rejects.toMatchObject({
        status: 409,
        kind: 'http',
        message: 'application name already exists',
        fieldErrors: { name: 'application name already exists' },
      });
  });

  // WHY: FastAPI validation locations must become field-level form feedback.
  it('extracts 422 field messages from the FastAPI error shape', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({
        detail: [
          { loc: ['body', 'name'], msg: 'String should have at least 1 character' },
          { loc: ['body', 'environment'], msg: 'Input should be valid' },
        ],
      }, 422),
    ));

    await expect(updateApplication('app-1', { name: '' })).rejects.toMatchObject({
      status: 422,
      fieldErrors: {
        name: 'String should have at least 1 character',
        environment: 'Input should be valid',
      },
    });
  });

  // WHY: requests must terminate even when the network never settles.
  it('aborts requests at the shared timeout and reports a typed timeout', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = getApplication('app-1');
    const result = request.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(10_000);

    const error = await result;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, kind: 'timeout' });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  // WHY: DELETE's successful 204 response intentionally has no JSON body.
  it('accepts 204 without attempting to parse a response body', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.test');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteApplication('app-1')).resolves.toBeUndefined();
  });
});
