import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listAlerts } from '../api/alerts';
import type { AlertPage, AlertRecord } from '../api/types';
import { AlertsPage } from './AlertsPage';

vi.mock('../api/alerts', () => ({ listAlerts: vi.fn() }));

const alert: AlertRecord = {
  id: 'alert-1', type: 'deployment_failed', severity: 'high', application_id: 'app-1',
  application_name: 'payments', deployment_id: 'dep-1', message: 'Deployment did not complete',
  since: '2026-01-01T00:00:00Z',
};

function page(items: AlertRecord[], total = items.length): AlertPage {
  return { items, total, limit: 200, offset: 0, generated_at: '2026-01-01T00:01:00Z' };
}

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listAlerts).mockResolvedValue(page([alert]));
  });

  it('renders live alert fields and disables unsupported operations', async () => {
    const user = userEvent.setup();
    render(<AlertsPage />);
    expect(await screen.findByText('Deployment did not complete')).toBeInTheDocument();
    expect(screen.getAllByText('payments').length).toBeGreaterThan(0);
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(listAlerts).toHaveBeenCalledWith({ limit: 200, offset: 0 });
    expect(screen.getByRole('button', { name: 'Acknowledge alert unavailable' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resolve alert unavailable' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'View Alert Details' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Backend alert data')).toBeInTheDocument();
    expect(within(dialog).getByText('The backend does not provide alert timeline events or responder records.')).toBeInTheDocument();
    expect(within(dialog).getByText('Deployment did not complete')).toBeInTheDocument();
  });

  it('does not change alert state when backend write actions are unavailable', async () => {
    const user = userEvent.setup();
    render(<AlertsPage />);
    await screen.findByText('Deployment did not complete');
    await user.click(screen.getByRole('button', { name: 'Acknowledge alert unavailable' }));
    await user.click(screen.getByRole('button', { name: 'Resolve alert unavailable' }));
    expect(screen.getByText('Deployment did not complete')).toBeInTheDocument();
    expect(listAlerts).toHaveBeenCalledOnce();
  });

  it('preserves the original empty-state design landmarks', async () => {
    vi.mocked(listAlerts).mockResolvedValue(page([]));
    render(<AlertsPage />);
    expect(await screen.findByRole('heading', { name: 'Incidents & Alerts' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'All Systems Operational' })).toBeInTheDocument();
    expect(screen.getByText('The backend returned no active alerts.')).toBeInTheDocument();
  });

  it('distinguishes an empty alert result from a failed request and retries', async () => {
    const user = userEvent.setup();
    vi.mocked(listAlerts).mockRejectedValueOnce(new Error('API unavailable')).mockResolvedValueOnce(page([]));
    render(<AlertsPage />);
    expect(await screen.findByText('API unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unavailable Active Alerts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No Alerts Returned')).toBeInTheDocument();
    expect(listAlerts).toHaveBeenCalledTimes(2);
  });
});
