export const REQUEST_TIMEOUT_MS = 10_000;

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export class ApiError extends Error {
  // WHY: callers need stable status, category, and field data without inspecting raw responses.
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: ApiErrorKind,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorDetail {
  loc?: unknown;
  msg?: unknown;
}

interface ErrorBody {
  detail?: unknown;
}

// WHY: only FastAPI's documented validation shape is exposed as field feedback.
function validationFieldErrors(body: ErrorBody): Record<string, string> {
  if (!Array.isArray(body.detail)) return {};

  const fields: Record<string, string> = {};
  for (const item of body.detail) {
    if (typeof item !== 'object' || item === null) continue;
    const entry = item as ErrorDetail;
    const field = Array.isArray(entry.loc) ? entry.loc.at(-1) : undefined;
    if (typeof entry.msg === 'string' && typeof field === 'string') {
      fields[field] = entry.msg;
    }
  }
  return fields;
}

// WHY: all API calls share one configured origin, timeout policy, and safe error mapping.
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!configuredBaseUrl?.trim()) {
    throw new ApiError(
      'API base URL is not configured. Set VITE_API_BASE_URL.',
      0,
      'network',
    );
  }

  const baseUrl = configuredBaseUrl.trim().replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (response.ok) {
        throw new ApiError('The server returned an unreadable response.', response.status, 'parse');
      }
      body = undefined;
    }

    if (!response.ok) {
      const errorBody = typeof body === 'object' && body !== null
        ? body as ErrorBody
        : {};
      const detail = typeof errorBody.detail === 'string'
        ? errorBody.detail
        : `Request failed (HTTP ${response.status}).`;
      const fieldErrors = response.status === 422
        ? validationFieldErrors(errorBody)
        : response.status === 409
          ? { name: detail }
          : {};
      throw new ApiError(detail, response.status, 'http', fieldErrors);
    }

    return body as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('The request timed out. Please try again.', 0, 'timeout');
    }
    throw new ApiError('Unable to reach the API. Check the connection and try again.', 0, 'network');
  } finally {
    clearTimeout(timeout);
  }
}
