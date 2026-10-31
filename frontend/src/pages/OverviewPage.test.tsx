import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSummary } from '../api/summary';
import type { SummaryResponse } from '../api/types';
import { OverviewPage } from './OverviewPage';

vi.mock('../api/summary', () => ({ getSummary: vi.fn() }));
vi.mock('../context/ApiContext.tsx', () => ({
  useApi: () => ({
    health: { status: 'success', data: { status: 'healthy' }, rttMs: 12 },
    version: { status: 'success', data: { version: '2.0.0' }, rttMs: 9 },
    root: { status: 'success', data: { name: 'CloudOps' }, rttMs: 8 },
    isProbing: false,
    refreshProbes: vi.fn(),
    lastChecked: new Date('2026-01-01T00:00:00Z'),
    baseUrl: 'https://api.example.test',
  }),
}));

const summary: SummaryResponse = {
  applications: {
    total: 6,
    by_status: { healthy: 3, degraded: 1, down: 1, unknown: 1 },
    by_environment: { production: 3, staging: 2, development: 1 },
  },
  deployments: {
    total: 8,
    by_status: { pending: 1, running: 0, succeeded: 5, failed: 1, rolled_back: 1 },
    last_24h: 7,
  },
  logs: { total: 10, errors_last_24h: 2 },
  recent_failed_deployments: [],
  generated_at: '2026-01-01T00:00:00Z',
};

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getSummary).mockResolvedValue(summary);
  });

  it('renders API summary counts and marks unsupported cluster metrics unavailable', async () => {
    render(<OverviewPage />);
    expect(await screen.findByText('7 in last 24h')).toBeInTheDocument();
    expect(screen.getByText('3 Healthy')).toBeInTheDocument();
    expect(screen.getByText('3 Other')).toBeInTheDocument();
    expect(screen.getByText('CPU Utilization')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(getSummary).toHaveBeenCalledOnce();
  });

  it('preserves the original overview design landmarks', async () => {
    render(<OverviewPage />);
    expect(await screen.findByText('CloudOps Platform Overview')).toBeInTheDocument();
    expect(screen.getByText('Live Probe Active')).toBeInTheDocument();
    expect(screen.getByText('SLA Availability (30d)')).toBeInTheDocument();
    expect(screen.getByText('Incident history unavailable')).toBeInTheDocument();
  });

  it('does not fall back to demo counts when the summary API fails', async () => {
    vi.mocked(getSummary).mockRejectedValue(new Error('offline'));
    render(<OverviewPage />);
    expect((await screen.findAllByText('Unavailable', { exact: true })).length).toBeGreaterThan(0);
    expect(screen.queryByText('14 Active')).not.toBeInTheDocument();
    expect(screen.queryByText('38 Today')).not.toBeInTheDocument();
  });
});
