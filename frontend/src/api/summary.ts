import { request } from './client';
import type { SummaryResponse } from './types';
import { isSummaryResponse } from './validators';

export function getSummary(): Promise<SummaryResponse> {
  return request<SummaryResponse>('/summary', {}, isSummaryResponse);
}
