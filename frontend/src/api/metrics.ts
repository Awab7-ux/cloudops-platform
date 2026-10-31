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
