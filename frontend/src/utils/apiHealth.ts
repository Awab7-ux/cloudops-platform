/**
 * API Health client configuration and payload validation helpers.
 */

export interface HealthResponse {
  status: string;
  service?: string;
  [key: string]: unknown;
}

export interface VersionResponse {
  version: string;
  build?: string;
  [key: string]: unknown;
}

export function getDefaultApiBaseUrl(): string {
  // Check import.meta.env for VITE_API_BASE_URL, default to http://localhost:8000
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export function isValidHealthPayload(data: unknown): data is HealthResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.status === 'string';
}

export function isValidVersionPayload(data: unknown): data is VersionResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.version === 'string';
}

export function formatEndpointUrl(baseUrl: string, endpoint: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}
