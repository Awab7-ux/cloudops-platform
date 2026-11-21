import { resolveApiBaseUrl } from './client';

export interface MetricSample {
  name: string;
  labels: Record<string, string>;
  value: number;
}

export interface MetricsSnapshot {
  samples: MetricSample[];
  scrapedAt: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Function: parseLabels
 * Purpose: Parse Prometheus label names and escaped quoted values.
 *
 * Args:
 *   rawLabels: Label text between braces, if the sample has labels.
 * Returns:
 *   A label map; absent or empty input produces an empty map.
 */
function parseLabels(rawLabels: string | undefined): Record<string, string> {
  if (!rawLabels) return {};
  const labels: Record<string, string> = {};
  const expression = /(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  for (const match of rawLabels.matchAll(expression)) {
    labels[match[1]] = match[2]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return labels;
}

/**
 * Function: parsePrometheusMetrics
 * Purpose: Parse supported Prometheus text samples into typed records.
 *
 * Args:
 *   text: Prometheus exposition text.
 * Returns:
 *   Parsed samples; comments and malformed lines are ignored.
 */
export function parsePrometheusMetrics(text: string): MetricSample[] {
  const samples: MetricSample[] = [];
  const samplePattern = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|[+-]?Inf)(?:\s+\S+)?$/;

  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const match = line.match(samplePattern);
    if (!match) continue;
    samples.push({
      name: match[1],
      labels: parseLabels(match[2]),
      value: Number(match[3]),
    });
  }
  return samples;
}

/**
 * Function: getMetrics
 * Purpose: Fetch and parse the backend's Prometheus metrics endpoint.
 *
 * Returns:
 *   Parsed samples and the local time at which the scrape completed.
 * Throws:
 *   Error with a safe message when the endpoint fails, times out, or is unreachable.
 */
export async function getMetrics(): Promise<MetricsSnapshot> {
  const baseUrl = resolveApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/metrics`, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Metrics request failed (HTTP ${response.status}).`);
    }
    return {
      samples: parsePrometheusMetrics(await response.text()),
      scrapedAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Metrics request timed out.');
    }
    if (error instanceof Error && error.message.startsWith('Metrics request failed')) {
      throw error;
    }
    throw new Error('Unable to reach the metrics endpoint.');
  } finally {
    clearTimeout(timeout);
  }
}
