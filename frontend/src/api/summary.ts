import { request } from './client';
import type { SummaryResponse } from './types';
import { isSummaryResponse } from './validators';

/**
 * Function: getSummary
 * Purpose: Retrieve validated operational summary aggregates.
 * @returns Counts and recent failed deployment data from the backend.
 * @throws ApiError when the request fails or the response violates the contract.
 */
export function getSummary(): Promise<SummaryResponse> {
  return request<SummaryResponse>('/summary', {}, isSummaryResponse);
}
