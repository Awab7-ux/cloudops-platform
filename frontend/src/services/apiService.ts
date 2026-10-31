/**
 * Backend API service layer.
 * Probes the configured API endpoints using the shared API base URL resolver.
 */

import { resolveApiBaseUrl } from '../api/client';
import { formatEndpointUrl } from '../utils/apiHealth';

// Preserve the existing service export while sharing the API client's resolver.
export { resolveApiBaseUrl as resolveBaseUrl } from '../api/client';

export interface ProbeResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  rttMs: number;
  timestamp: Date;
}

/**
 * Execute probe against an endpoint with timeout and latency timing.
 */
export async function executeProbe<T = unknown>(
  baseUrl: string,
  endpoint: string,
  timeoutMs: number = 4000
): Promise<ProbeResult<T>> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = formatEndpointUrl(resolveApiBaseUrl(baseUrl), cleanEndpoint);
  const startTime = performance.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const duration = Math.round(performance.now() - startTime);

    let data: T | null = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data,
        error: `HTTP ${response.status} ${response.statusText || 'Error'}`,
        rttMs: duration,
        timestamp: new Date(),
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
      rttMs: Math.max(1, duration),
      timestamp: new Date(),
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const duration = Math.round(performance.now() - startTime);
    const errorMsg = err instanceof Error ? err.message : 'Network error';

    return {
      ok: false,
      status: 0,
      data: null,
      error: errorMsg.includes('abort') ? 'Connection timed out (>4s)' : `${errorMsg} (${fullUrl})`,
      rttMs: duration,
      timestamp: new Date(),
    };
  }
}
