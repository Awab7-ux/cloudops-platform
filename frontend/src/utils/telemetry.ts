/**
 * Pure telemetry calculation and formatting utilities.
 */

/**
 * Calculates Apdex (Application Performance Index) score:
 * (Satisfied + Tolerating / 2) / Total
 * Returns a number between 0.0 and 1.0 rounded to 2 decimal places.
 */
export function calculateApdex(satisfied: number, tolerating: number, total: number): number {
  if (total <= 0) return 1.0;
  const score = (satisfied + tolerating / 2) / total;
  return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
}

/**
 * Formats milliseconds into human-readable latency string.
 */
export function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${ms.toFixed(ms % 1 === 0 ? 0 : 1)}ms`;
}

/**
 * Calculates percentage with safe division and fixed precision.
 */
export function calculatePercentage(part: number, total: number, decimals: number = 1): number {
  if (total <= 0) return 0;
  const val = (part / total) * 100;
  return Number(val.toFixed(decimals));
}

/**
 * Formats memory in MiB or GiB.
 */
export function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GiB`;
  }
  return `${Math.round(mb)}MiB`;
}

/**
 * Parses and categorizes HTTP status code.
 */
export function categorizeHttpStatus(statusCode: number): '2xx' | '3xx' | '4xx' | '5xx' | 'other' {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}
