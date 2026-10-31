import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ApiError } from '../api/client';
import { getApplication } from '../api/applications';
import type { Application } from '../api/types';
import type { Deployment, LogRecord } from '../api/types';
import { listDeployments } from '../api/deployments';
import { listApplicationLogs } from '../api/logs';
import { ApplicationDetailPage } from './ApplicationDetailPage';

vi.mock('../api/applications', () => ({
  getApplication: vi.fn(),
}));
vi.mock('../api/deployments', () => ({ listDeployments: vi.fn() }));
vi.mock('../api/logs', () => ({ listApplicationLogs: vi.fn() }));
vi.mock('../context/ApiContext.tsx', () => ({
  useApi: () => ({
    health: { status: 'success', data: { status: 'ok' } },
    version: { status: 'success', data: { version: '1.0.0' } },
  }),
}));

const application: Application = {
  id: 'app-1', name: 'payments-api', description: null, environment: 'production', status: 'degraded',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/applications/app-1']}>
      <Routes>
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getApplication).mockResolvedValue(application);
    vi.mocked(listDeployments).mockResolvedValue({ items: [], total: 0, limit: 3, offset: 0 });
    vi.mocked(listApplicationLogs).mockResolvedValue({ items: [], total: 0, limit: 5, offset: 0 });
  });

  it('loads and displays application identity, backend status, and environment', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'payments-api' })).toBeInTheDocument();
    expect(screen.getByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(getApplication).toHaveBeenCalledWith('app-1');
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
  });

  it('preserves the original application detail design landmarks', async () => {
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'payments-api' })).toBeInTheDocument();
    expect(screen.getByText('Backend data availability:')).toBeInTheDocument();
    expect(screen.getByText('Environment:')).toBeInTheDocument();
    expect(screen.getByText('Namespace:')).toBeInTheDocument();
  });

  it('loads deployment history and persisted application logs from their APIs', async () => {
    const deployment: Deployment = {
      id: 'dep-1', application_id: 'app-1', version: 'v1.2.3', commit_sha: 'abcdef1234567',
      status: 'succeeded', started_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-01T00:01:00Z',
      created_at: '2026-01-01T00:00:00Z',
    };
    const log: LogRecord = {
      id: 'log-1', application_id: 'app-1', deployment_id: 'dep-1', level: 'error',
      message: 'deployment health check failed', source: 'backend', created_at: '2026-01-01T00:02:00Z',
    };
    vi.mocked(listDeployments).mockResolvedValue({ items: [deployment], total: 1, limit: 3, offset: 0 });
    vi.mocked(listApplicationLogs).mockResolvedValue({ items: [log], total: 1, limit: 5, offset: 0 });

    renderDetail();

    expect(await screen.findByText('v1.2.3')).toBeInTheDocument();
    expect(await screen.findByText('deployment health check failed')).toBeInTheDocument();
    expect(listDeployments).toHaveBeenCalledWith('app-1', { limit: 3, offset: 0 });
    expect(listApplicationLogs).toHaveBeenCalledWith('app-1', { limit: 5, offset: 0 });
  });

  it('shows a not-found state and retries a failed detail request', async () => {
    const user = userEvent.setup();
    vi.mocked(getApplication)
      .mockRejectedValueOnce(new ApiError('not found', 404, 'http'))
      .mockResolvedValueOnce(application);
    renderDetail();
    expect(await screen.findByText('Application not found.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'payments-api' })).toBeInTheDocument();
    expect(getApplication).toHaveBeenCalledTimes(2);
  });

  it('shows a retry control for non-404 errors', async () => {
    const user = userEvent.setup();
    vi.mocked(getApplication)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(application);
    renderDetail();
    expect(await screen.findByText('offline')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'payments-api' })).toBeInTheDocument();
  });
});
