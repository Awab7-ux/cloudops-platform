import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_BASE_URL, setConfiguredApiBaseUrl } from '../api/client';
import { executeProbe } from '../services/apiService';
import type { ProbeResult } from '../services/apiService';
import { ApiProvider, useApi } from './ApiContext';

vi.mock('../services/apiService.ts', () => ({ executeProbe: vi.fn() }));

/**
 * Function: ContextProbe
 * Purpose: Expose selected API context state and actions to interaction tests.
 *
 * Returns:
 *   Test controls for changing the base URL and checking a candidate URL.
 */
function ContextProbe() {
  const api = useApi();
  const [message, setMessage] = useState('');

  return (
    <div>
      <output data-testid="api-url">{api.baseUrl}</output>
      <output data-testid="health-status">{api.health.status}</output>
      <button type="button" onClick={() => api.setBaseUrl('http://localhost:9000')}>Change API URL</button>
      <button
        type="button"
        onClick={() => void api.testCustomUrl('http://candidate.test').then(result => setMessage(result.message))}
      >
        Test candidate URL
      </button>
      <output data-testid="candidate-result">{message}</output>
    </div>
  );
}

/** Function: healthyProbe. Purpose: Return a successful probe result for provider tests. */
function healthyProbe(): ProbeResult {
  return {
    ok: true,
    status: 200,
    data: { status: 'ok', version: '0.1.0' },
    rttMs: 12,
    timestamp: new Date('2026-11-01T10:00:00Z'),
  };
}

describe('ApiProvider', () => {
  beforeEach(() => {
    setConfiguredApiBaseUrl(DEFAULT_API_BASE_URL);
    vi.mocked(executeProbe).mockReset().mockResolvedValue(healthyProbe());
  });

  it('probes the configured origin on mount and immediately after it changes', async () => {
    render(<ApiProvider><ContextProbe /></ApiProvider>);
    expect(await screen.findByTestId('health-status')).toHaveTextContent('success');
    expect(executeProbe).toHaveBeenCalledWith(DEFAULT_API_BASE_URL, '/health');

    fireEvent.click(screen.getByRole('button', { name: 'Change API URL' }));

    await waitFor(() => expect(screen.getByTestId('api-url')).toHaveTextContent('http://localhost:9000'));
    await waitFor(() => expect(executeProbe).toHaveBeenCalledWith('http://localhost:9000', '/health'));
  });

  it('tests a candidate URL without changing the configured origin', async () => {
    render(<ApiProvider><ContextProbe /></ApiProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Test candidate URL' }));

    expect(await screen.findByTestId('candidate-result')).toHaveTextContent('Connected');
    expect(executeProbe).toHaveBeenCalledWith('http://candidate.test', '/health', 3000);
    expect(screen.getByTestId('api-url')).toHaveTextContent(DEFAULT_API_BASE_URL);
  });
});
