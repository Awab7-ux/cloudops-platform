export const REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_API_BASE_URL = 'http://localhost:8000';
export const API_BASE_URL_ENV_VAR = 'VITE_API_BASE_URL';

let configuredApiBaseUrl: string | null = null;

/**
 * Function: resolveApiBaseUrl
 * Purpose: Select and normalize the active API origin.
 *
 * Args:
 *   customUrl: Optional URL that takes precedence over configured values.
 *   options: Resolver flags, including whether to ignore the runtime override.
 * Returns:
 *   The selected origin without trailing slashes.
 */
export function resolveApiBaseUrl(
  customUrl?: string | null,
  options: { ignoreConfiguredUrl?: boolean } = {},
): string {
  const environmentUrl = (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim();
  const configuredUrl = options.ignoreConfiguredUrl ? null : configuredApiBaseUrl;
  const selectedUrl = customUrl?.trim() || configuredUrl || environmentUrl || DEFAULT_API_BASE_URL;
  return selectedUrl.trim().replace(/\/+$/, '');
}

/**
 * Function: setConfiguredApiBaseUrl
 * Purpose: Store the normalized API origin selected in Settings.
 *
 * Args:
 *   url: User-selected API origin.
 * Returns:
 *   The normalized origin stored for subsequent API calls.
 */
export function setConfiguredApiBaseUrl(url: string): string {
  const resolvedUrl = resolveApiBaseUrl(url, { ignoreConfiguredUrl: true });
  configuredApiBaseUrl = resolvedUrl;
  return resolvedUrl;
}

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse';

export class ApiError extends Error {
  /**
   * Function: ApiError.constructor
   * Purpose: Attach stable HTTP status, error kind, and validation fields.
   *
   * Args:
   *   message: Safe error message for the caller.
   *   status: HTTP status code, or zero for transport errors.
   *   kind: Network, timeout, HTTP, or response-parse error category.
   *   fieldErrors: Optional validation messages keyed by field.
   */
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

/**
 * Function: validationFieldErrors
 * Purpose: Extract field messages from FastAPI's validation error response.
 *
 * Args:
 *   body: Parsed error response body.
 * Returns:
 *   Validation messages keyed by field, or an empty object for other shapes.
 */
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

/**
 * Function: request
 * Purpose: Send a typed API request using shared timeout and error handling.
 *
 * Args:
 *   path: API path relative to the configured origin.
 *   init: Optional Fetch request options.
 *   isValidResponse: Optional runtime validator for the response body.
 * Returns:
 *   The parsed response body, or undefined for an empty successful response.
 * Throws:
 *   ApiError for network, timeout, HTTP, parse, or contract-validation failures.
 */
export async function request<T>(
  path: string,
  init: RequestInit = {},
  isValidResponse?: (body: unknown) => body is T,
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
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

    if (isValidResponse && !isValidResponse(body)) {
      throw new ApiError(
        'The server returned data in an unexpected format.',
        response.status,
        'parse',
      );
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
