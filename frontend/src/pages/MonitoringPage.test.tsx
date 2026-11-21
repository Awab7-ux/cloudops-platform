import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetrics } from '../api/metrics';
import type { MetricsSnapshot } from '../api/metrics';
import { MonitoringPage } from './MonitoringPage';

vi.mock('../api/metrics', () => ({ getMetrics: vi.fn() }));
vi.mock('../context/ApiContext', () => ({
  useApi: () => ({
    health: { status: 'success', data: { status: 'ok' }, rttMs: 6 },
    version: { status: 'success', data: { version: '0.1.0' } },
    isProbing: false,
    refreshProbes: vi.fn(),
    baseUrl: 'http://localhost:8000',
  }),
}));

const liveMetrics: MetricsSnapshot = {
  scrapedAt: '2026-11-01T10:00:00Z',
  samples: [
    { name: 'cloudops_applications_total', labels: {}, value: 4 },
    { name: 'cloudops_deployments_total', labels: {}, value: 8 },
    { name: 'cloudops_logs_total', labels: {}, value: 12 },
    { name: 'cloudops_active_alerts', labels: { type: 'deployment_failed' }, value: 1 },
    { name: 'cloudops_http_requests_total', labels: { status_code: '200' }, value: 9 },
    { name: 'cloudops_http_requests_total', labels: { status_code: '500' }, value: 3 },
    { name: 'cloudops_http_request_duration_seconds_count', labels: {}, value: 4 },
    { name: 'cloudops_http_request_duration_seconds_sum', labels: {}, value: 2 },
    { name: 'cloudops_log_errors_last_24h', labels: {}, value: 2 },
    { name: 'cloudops_applications_by_status', labels: { status: 'healthy' }, value: 4 },
  ],
};

describe('MonitoringPage', () => {
  beforeEach(() => {
    vi.mocked(getMetrics).mockReset();
  });

  it('renders metrics from the backend and keeps cluster data unavailable', async () => {
    vi.mocked(getMetrics).mockResolvedValue(liveMetrics);
    render(<MonitoringPage />);

    expect(await screen.findByText('Live API metrics')).toBeInTheDocument();
    const requestCount = screen.getByText('Requests recorded').parentElement;
    expect(within(requestCount as HTMLElement).getByText('12')).toBeInTheDocument();
    expect(screen.getByText('500.0 ms')).toBeInTheDocument();
    expect(screen.getByText('Current backend-derived alerts')).toBeInTheDocument();
    expect(screen.getByText('Cluster target visibility')).toBeInTheDocument();
    expect(getMetrics).toHaveBeenCalledOnce();
  });

  it('shows a retryable error when the metrics endpoint is unavailable', async () => {
    vi.mocked(getMetrics)
      .mockRejectedValueOnce(new Error('Metrics endpoint unavailable.'))
      .mockResolvedValueOnce(liveMetrics);
    render(<MonitoringPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Metrics endpoint unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry metrics' }));
    expect(await screen.findByText('Live API metrics')).toBeInTheDocument();
    expect(getMetrics).toHaveBeenCalledTimes(2);
  });
});
