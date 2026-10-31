import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listApplications } from '../api/applications';
import { listLogs } from '../api/logs';
import type { Application, LogPage, LogRecord } from '../api/types';
import { LogsPage } from './LogsPage';

vi.mock('../api/applications', () => ({ listApplications: vi.fn() }));
vi.mock('../api/logs', () => ({ listLogs: vi.fn() }));

const application: Application = {
  id: 'app-1', name: 'payments', description: null, environment: 'production', status: 'healthy',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

const log: LogRecord = {
  id: 'log-1', application_id: 'app-1', deployment_id: 'dep-1', level: 'warning',
  message: 'worker restarted', source: 'worker', created_at: '2026-01-01T00:00:00Z',
};

function page(items: LogRecord[], total = items.length, offset = 0): LogPage {
  return { items, total, limit: 50, offset };
}

describe('LogsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listApplications).mockResolvedValue({ items: [application], total: 1, limit: 200, offset: 0 });
    vi.mocked(listLogs).mockResolvedValue(page([log]));
  });

  it('renders backend log fields and the API state', async () => {
    render(<LogsPage />);
    expect(await screen.findByText('worker restarted')).toBeInTheDocument();
    expect(screen.getByText('[worker]')).toBeInTheDocument();
    expect(screen.getAllByText('Live API').length).toBeGreaterThan(0);
    expect(listLogs).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it('preserves the log stream design and limits details to backend fields', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);
    expect(await screen.findByRole('heading', { name: 'Structured Log Stream' })).toBeInTheDocument();
    expect(screen.getByText('Log levels in the loaded page')).toBeInTheDocument();
    expect(screen.getByText('Backend log records')).toBeInTheDocument();
    await user.click(screen.getByText('worker restarted'));
    expect(screen.getByText('Application ID:')).toBeInTheDocument();
    expect(screen.getByText('Trace IDs, attributes, stack traces, and container output are not provided by the logs API.')).toBeInTheDocument();
  });

  it('sends severity and application filters to the backend', async () => {
    const user = userEvent.setup();
    render(<LogsPage />);
    await screen.findByText('worker restarted');
    await user.click(screen.getByRole('button', { name: 'WARN' }));
    await waitFor(() => expect(listLogs).toHaveBeenLastCalledWith({ limit: 50, offset: 0, level: 'warning' }));
    await user.selectOptions(screen.getByLabelText('Filter logs by application'), 'app-1');
    await waitFor(() => expect(listLogs).toHaveBeenLastCalledWith({
      limit: 50, offset: 0, level: 'warning', application_id: 'app-1',
    }));
  });

  it('shows application-list failures and retries the selector request', async () => {
    const user = userEvent.setup();
    vi.mocked(listApplications).mockRejectedValueOnce(new Error('applications offline'));
    render(<LogsPage />);

    expect(await screen.findByText('applications offline')).toBeInTheDocument();
    expect(screen.getByText('worker restarted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('option', { name: 'payments' })).toBeInTheDocument();
    expect(screen.queryByText('applications offline')).not.toBeInTheDocument();
    expect(listApplications).toHaveBeenCalledTimes(2);
  });

  it('searches loaded message, application, and source values without requesting unloaded records', async () => {
    const user = userEvent.setup();
    vi.mocked(listLogs).mockResolvedValue(page([log], 2));
    render(<LogsPage />);
    await screen.findByText('worker restarted');

    const search = screen.getByPlaceholderText(/Search logs by message, application, or source/);
    await user.type(search, 'payments');
    expect(screen.getByText('worker restarted')).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'record only on an unloaded page');
    expect(screen.getByText('No log entries match filter criteria.')).toBeInTheDocument();
    expect(listLogs).toHaveBeenCalledTimes(1);
  });

  it('auto tails new latest records while following the latest entry', async () => {
    const newest: LogRecord = {
      ...log,
      id: 'log-2',
      message: 'newest event',
      created_at: '2026-01-02T00:00:00Z',
    };
    vi.useFakeTimers();
    vi.mocked(listLogs)
      .mockResolvedValueOnce(page([log], 2))
      .mockResolvedValueOnce(page([newest, log], 3));
    const { unmount } = render(<LogsPage />);

    try {
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByText('worker restarted')).toBeInTheDocument();
      const viewport = screen.getByText('worker restarted').closest('.max-h-\\[600px\\]') as HTMLDivElement;
      Object.defineProperties(viewport, {
        scrollHeight: { configurable: true, value: 700 },
        scrollTop: { configurable: true, writable: true, value: 12 },
        clientHeight: { configurable: true, value: 600 },
      });
      fireEvent.scroll(viewport);

      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

      expect(screen.getByText('newest event')).toBeInTheDocument();
      expect(viewport.scrollTop).toBe(0);
      expect(listLogs).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('does not move away from older entries when Auto Tail is enabled', async () => {
    const newest: LogRecord = {
      ...log,
      id: 'log-2',
      message: 'newest event',
      created_at: '2026-01-02T00:00:00Z',
    };
    vi.useFakeTimers();
    vi.mocked(listLogs)
      .mockResolvedValueOnce(page([log], 2))
      .mockResolvedValueOnce(page([newest, log], 3));
    const { unmount } = render(<LogsPage />);

    try {
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByText('worker restarted')).toBeInTheDocument();
      const viewport = screen.getByText('worker restarted').closest('.max-h-\\[600px\\]') as HTMLDivElement;
      Object.defineProperties(viewport, {
        scrollHeight: { configurable: true, value: 1000 },
        scrollTop: { configurable: true, writable: true, value: 200 },
        clientHeight: { configurable: true, value: 600 },
      });
      fireEvent.scroll(viewport);

      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

      expect(screen.getByText('newest event')).toBeInTheDocument();
      expect(viewport.scrollTop).toBe(200);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('does not auto tail or move the viewport when Auto Tail is disabled', async () => {
    const newest: LogRecord = {
      ...log,
      id: 'log-2',
      message: 'newest event',
      created_at: '2026-01-02T00:00:00Z',
    };
    vi.useFakeTimers();
    vi.mocked(listLogs)
      .mockResolvedValueOnce(page([log], 2))
      .mockResolvedValueOnce(page([newest, log], 3));
    const { unmount } = render(<LogsPage />);

    try {
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByText('worker restarted')).toBeInTheDocument();
      const viewport = screen.getByText('worker restarted').closest('.max-h-\\[600px\\]') as HTMLDivElement;
      Object.defineProperties(viewport, {
        scrollHeight: { configurable: true, value: 1000 },
        scrollTop: { configurable: true, writable: true, value: 200 },
        clientHeight: { configurable: true, value: 600 },
      });
      fireEvent.scroll(viewport);
      fireEvent.click(screen.getByLabelText('Auto Tail'));

      await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });

      expect(screen.getByText('newest event')).toBeInTheDocument();
      expect(viewport.scrollTop).toBe(200);
      expect(listLogs).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it('shows empty, loading, and retryable error states without fixture log records', async () => {
    const user = userEvent.setup();
    vi.mocked(listLogs)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page([]));
    render(<LogsPage />);
    expect(await screen.findByText('offline')).toBeInTheDocument();
    expect(screen.queryByText('OAuth2 token refreshed successfully for client session')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No log entries are available.')).toBeInTheDocument();
  });

  it('loads the next backend page when the existing log viewport reaches its end', async () => {
    const next: LogRecord = { ...log, id: 'log-2', level: 'info', message: 'next page' };
    vi.mocked(listLogs)
      .mockResolvedValueOnce(page([log], 2))
      .mockResolvedValueOnce(page([next], 2, 1));
    render(<LogsPage />);
    await screen.findByText('worker restarted');
    const viewport = screen.getByText('worker restarted').closest('.max-h-\\[600px\\]');
    expect(viewport).not.toBeNull();
    Object.defineProperties(viewport!, {
      scrollHeight: { configurable: true, value: 700 },
      scrollTop: { configurable: true, value: 690 },
      clientHeight: { configurable: true, value: 600 },
    });
    fireEvent.scroll(viewport!);
    expect(await screen.findByText('next page')).toBeInTheDocument();
    expect(listLogs).toHaveBeenLastCalledWith({ limit: 50, offset: 1 });
  });
});
