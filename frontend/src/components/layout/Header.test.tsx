import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAlerts } from '../../api/alerts';
import type { AlertPage, AlertRecord } from '../../api/types';
import { Header } from './Header';

vi.mock('../../api/alerts', () => ({ listAlerts: vi.fn() }));
vi.mock('../../api/applications', () => ({
  listApplications: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 200, offset: 0 }),
}));
vi.mock('../../api/summary', () => ({
  getSummary: vi.fn().mockResolvedValue({ recent_failed_deployments: [] }),
}));
vi.mock('../../context/ApiContext.tsx', () => ({
  useApi: () => ({
    health: { status: 'success', data: { service: 'CloudOps Platform' }, error: null, rttMs: 7, httpStatus: 200 },
    isProbing: false,
    refreshProbes: vi.fn(),
  }),
}));

/**
 * Function: alertPage
 * Purpose: Build a typed page response for header alert tests.
 *
 * Args:
 *   items: Alerts returned in the current page.
 *   total: Total alerts matching the backend query.
 * Returns:
 *   An alerts API response with stable pagination metadata.
 */
function alertPage(items: AlertRecord[], total = items.length): AlertPage {
  return { items, total, limit: 3, offset: 0, generated_at: '2026-11-01T10:00:00Z' };
}

const failedDeployment: AlertRecord = {
  id: 'deployment_failed:app-1:dep-4',
  type: 'deployment_failed',
  severity: 'high',
  application_id: 'app-1',
  application_name: 'billing-api',
  deployment_id: 'dep-4',
  message: 'Deployment failed.',
  since: '2026-11-01T09:30:00Z',
};

/**
 * Function: renderHeader
 * Purpose: Render the header inside the router context it requires.
 *
 * Returns:
 *   Testing Library render helpers for the mounted header.
 */
function renderHeader() {
  return render(<MemoryRouter><Header /></MemoryRouter>);
}

describe('Header alerts', () => {
  beforeEach(() => {
    vi.mocked(listAlerts).mockReset();
  });

  it('shows live alert details and the count returned by the API', async () => {
    vi.mocked(listAlerts).mockResolvedValue(alertPage([failedDeployment], 4));
    renderHeader();

    expect(await screen.findByLabelText('4 active alerts')).toBeInTheDocument();
    await fireEvent.click(screen.getByTitle('View Alerts'));

    const region = screen.getByRole('region', { name: 'Active alerts' });
    expect(within(region).getByText('Deployment failed.')).toBeInTheDocument();
    expect(within(region).getByText('deployment failed · billing-api')).toBeInTheDocument();
    expect(listAlerts).toHaveBeenCalledWith({ limit: 3, offset: 0 });
    expect(screen.queryByText('demo@cloudops.internal')).not.toBeInTheDocument();
  });

  it('shows an empty state and no badge when the API returns no alerts', async () => {
    vi.mocked(listAlerts).mockResolvedValue(alertPage([]));
    renderHeader();
    await fireEvent.click(screen.getByTitle('View Alerts'));

    expect(await screen.findByText('No active alerts.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/active alerts$/)).not.toBeInTheDocument();
  });

  it('shows a retryable error when the alerts request fails', async () => {
    vi.mocked(listAlerts)
      .mockRejectedValueOnce(new Error('Alert feed unavailable.'))
      .mockResolvedValueOnce(alertPage([failedDeployment]));
    renderHeader();
    await fireEvent.click(screen.getByTitle('View Alerts'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Alert feed unavailable.');
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Deployment failed.')).toBeInTheDocument();
  });

  it('opens global search with the Ctrl+K shortcut', async () => {
    vi.mocked(listAlerts).mockResolvedValue(alertPage([]));
    renderHeader();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    expect(await screen.findByPlaceholderText('Search applications, recent failed deployments, or alerts...'))
      .toBeInTheDocument();
  });
});
