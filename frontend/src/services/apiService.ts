/**
 * Backend API service layer.
 * Probes real endpoints GET /health and GET /version at VITE_API_BASE_URL (default: http://localhost:8000).
 */

export interface ProbeResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  rttMs: number;
  timestamp: Date;
}

export function resolveBaseUrl(customUrl?: string): string {
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  const envUrl = (import.meta.env?.VITE_API_BASE_URL as string | undefined);
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
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
  const fullUrl = `${baseUrl}${cleanEndpoint}`;
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
