import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const mocks = vi.hoisted(() => ({
  setBaseUrl: vi.fn(),
  setPollingInterval: vi.fn(),
  refreshProbes: vi.fn(),
}));

vi.mock('../context/ApiContext', () => ({
  useApi: () => ({
    baseUrl: 'http://localhost:8000',
    setBaseUrl: mocks.setBaseUrl,
    health: { status: 'success', data: { status: 'ok' }, error: null, rttMs: 8, httpStatus: 200, url: 'http://localhost:8000/health' },
    version: { status: 'success', data: { version: '0.1.0' }, error: null, rttMs: 8, httpStatus: 200, url: 'http://localhost:8000/version' },
    isChecking: false,
    refreshProbes: mocks.refreshProbes,
    pollingInterval: 10_000,
    setPollingInterval: mocks.setPollingInterval,
  }),
}));
vi.mock('../utils/apiHealth', () => ({ getDefaultApiBaseUrl: () => 'http://configured-default:8000' }));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the entered API URL and describes the available settings accurately', () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Backend Base URL' }), {
      target: { value: 'http://api.internal:9000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply & Test' }));

    expect(mocks.setBaseUrl).toHaveBeenCalledWith('http://api.internal:9000');
    expect(screen.getByText('Target backend API updated to http://api.internal:9000')).toBeInTheDocument();
    expect(screen.queryByText('Compact Table Density')).not.toBeInTheDocument();
    expect(screen.queryByText('Critical Incident Audio Chimes')).not.toBeInTheDocument();
  });

  it('resets the API origin to the configured default and restores polling', () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset All Settings to Defaults' }));

    expect(mocks.setBaseUrl).toHaveBeenCalledWith('http://configured-default:8000');
    expect(mocks.setPollingInterval).toHaveBeenCalledWith(10_000);
    expect(mocks.refreshProbes).not.toHaveBeenCalled();
  });
});
