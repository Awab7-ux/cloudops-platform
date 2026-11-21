/**
 * Pure telemetry calculation and formatting utilities.
 */

/**
 * Function: calculateApdex
 * Purpose: Calculate a bounded Apdex score from satisfied and tolerating counts.
 *
 * Args:
 *   satisfied: Number of requests within the satisfaction threshold.
 *   tolerating: Number of requests within the toleration threshold.
 *   total: Total measured requests.
 * Returns:
 *   A score from 0 through 1 rounded to two decimal places; empty traffic returns 1.
 */
export function calculateApdex(satisfied: number, tolerating: number, total: number): number {
  if (total <= 0) return 1.0;
  const score = (satisfied + tolerating / 2) / total;
  return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
}

/**
 * Function: formatLatency
 * Purpose: Format latency in microseconds, milliseconds, or seconds.
 *
 * Args:
 *   ms: Latency in milliseconds.
 * Returns:
 *   A compact latency string; sub-millisecond values use the microsecond unit.
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
 * Function: calculatePercentage
 * Purpose: Calculate a percentage with safe division and requested precision.
 *
 * Args:
 *   part: Count or amount represented by the numerator.
 *   total: Denominator; non-positive totals return zero.
 *   decimals: Number of decimal places passed to Number.toFixed.
 * Returns:
 *   The percentage rounded to the requested precision.
 */
export function calculatePercentage(part: number, total: number, decimals: number = 1): number {
  if (total <= 0) return 0;
  const val = (part / total) * 100;
  return Number(val.toFixed(decimals));
}

/**
 * Function: formatMemory
 * Purpose: Format a non-negative memory quantity in MiB or GiB.
 * @param mb Memory quantity in MiB.
 * @returns MiB below 1024, otherwise one-decimal GiB.
 */
export function formatMemory(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)}GiB`;
  }
  return `${Math.round(mb)}MiB`;
}

/**
 * Function: categorizeHttpStatus
 * Purpose: Map an HTTP status code to its response class.
 *
 * Args:
 *   statusCode: Numeric HTTP response status.
 * Returns:
 *   The 2xx, 3xx, 4xx, or 5xx class, or `other` outside those ranges.
 */
export function categorizeHttpStatus(statusCode: number): '2xx' | '3xx' | '4xx' | '5xx' | 'other' {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}
