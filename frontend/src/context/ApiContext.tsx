import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { resolveApiBaseUrl, setConfiguredApiBaseUrl } from '../api/client';
import { executeProbe } from '../services/apiService.ts';

export interface HealthState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: any;
  error: string | null;
  rttMs: number;
  responseTimeMs?: number;
  httpStatus: number;
  url?: string;
}

export interface VersionState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: any;
  error: string | null;
  rttMs: number;
  responseTimeMs?: number;
  httpStatus: number;
  url?: string;
}

export interface RootState {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: any;
  error: string | null;
  rttMs: number;
  responseTimeMs?: number;
  httpStatus: number;
  url?: string;
}

export interface ProbeSnapshot {
  health: HealthState;
  version: VersionState;
  root: RootState;
}

export interface ApiContextType {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  health: HealthState;
  version: VersionState;
  root: RootState;
  lastChecked: Date | null;
  isProbing: boolean;
  isChecking: boolean;
  refreshProbes: () => Promise<ProbeSnapshot | null>;
  testCustomUrl: (url: string) => Promise<{ ok: boolean; message: string; rttMs: number }>;
  autoRefreshInterval: number | null;
  setAutoRefreshInterval: (ms: number | null) => void;
  pollingInterval: number;
  setPollingInterval: (ms: number) => void;
}

const ApiContext = createContext<ApiContextType | null>(null);

/**
 * Function: ApiProvider
 * Purpose: Share the configured API URL and live health probe state with the UI.
 *
 * Args:
 *   children: React subtree that consumes the API context.
 * Returns:
 *   The subtree wrapped in an API state provider.
 * Side effects:
 *   Probes the API on mount and at the configured refresh interval.
 */
export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrlState] = useState<string>(() => resolveApiBaseUrl());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(10000);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const probeSequence = useRef(0);

  const [health, setHealth] = useState<HealthState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${baseUrl}/health`,
  });

  const [version, setVersion] = useState<VersionState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${baseUrl}/version`,
  });

  const [root, setRoot] = useState<RootState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${baseUrl}/`,
  });

  /**
   * Function: setBaseUrl
   * Purpose: Apply a new API base URL and mark its probes as loading.
   *
   * Args:
   *   url: API origin entered in Settings.
   * Side effects:
   *   Stores the configured origin, invalidates older results, and starts new probes.
   */
  const setBaseUrl = (url: string) => {
    const cleaned = setConfiguredApiBaseUrl(url);
    probeSequence.current += 1;
    setBaseUrlState(cleaned);
    setIsProbing(true);
    setHealth(prev => ({ ...prev, status: 'loading', url: `${cleaned}/health` }));
    setVersion(prev => ({ ...prev, status: 'loading', url: `${cleaned}/version` }));
    setRoot(prev => ({ ...prev, status: 'loading', url: `${cleaned}/` }));
    void refreshProbes();
  };

  /**
   * Function: setPollingInterval
   * Purpose: Set or disable periodic health checks.
   *
   * Args:
   *   ms: Refresh interval in milliseconds; non-positive values disable polling.
   * Side effects:
   *   Updates the interval consumed by the refresh effect.
   */
  const setPollingInterval = (ms: number) => {
    setAutoRefreshInterval(ms > 0 ? ms : null);
  };

  /**
   * Function: refreshProbes
   * Purpose: Fetch health, version, and root status from the configured API.
   *
   * Returns:
   *   The latest probe states, or null when a newer probe superseded this request.
   * Side effects:
   *   Updates probe results and the last-checked time; stale responses are ignored.
   */
  const refreshProbes = useCallback(async () => {
    const sequence = ++probeSequence.current;
    const probeBaseUrl = resolveApiBaseUrl();
    setIsProbing(true);
    setHealth(prev => ({ ...prev, status: 'loading', url: `${probeBaseUrl}/health` }));
    setVersion(prev => ({ ...prev, status: 'loading', url: `${probeBaseUrl}/version` }));
    setRoot(prev => ({ ...prev, status: 'loading', url: `${probeBaseUrl}/` }));

    const [healthRes, versionRes, rootRes] = await Promise.all([
      executeProbe(probeBaseUrl, '/health'),
      executeProbe(probeBaseUrl, '/version'),
      executeProbe(probeBaseUrl, '/'),
    ]);

    if (sequence !== probeSequence.current) return null;

    const healthState: HealthState = {
      status: healthRes.ok ? 'success' : 'error',
      data: healthRes.data,
      error: healthRes.error || null,
      rttMs: healthRes.rttMs,
      responseTimeMs: healthRes.rttMs,
      httpStatus: healthRes.status,
      url: `${probeBaseUrl}/health`,
    };

    const versionState: VersionState = {
      status: versionRes.ok ? 'success' : 'error',
      data: versionRes.data,
      error: versionRes.error || null,
      rttMs: versionRes.rttMs,
      responseTimeMs: versionRes.rttMs,
      httpStatus: versionRes.status,
      url: `${probeBaseUrl}/version`,
    };

    const rootState: RootState = {
      status: rootRes.ok ? 'success' : 'error',
      data: rootRes.data,
      error: rootRes.error || null,
      rttMs: rootRes.rttMs,
      responseTimeMs: rootRes.rttMs,
      httpStatus: rootRes.status,
      url: `${probeBaseUrl}/`,
    };

    setHealth(healthState);
    setVersion(versionState);
    setRoot(rootState);

    setLastChecked(new Date());
    setIsProbing(false);
    return { health: healthState, version: versionState, root: rootState };
  }, []);

  /**
   * Function: testCustomUrl
   * Purpose: Check whether a candidate API origin responds to its health route.
   *
   * Args:
   *   url: Candidate API origin to probe.
   * Returns:
   *   Connection status, a readable result message, and measured round-trip time.
   * Side effects:
   *   Sends one health request without changing the configured API origin.
   */
  const testCustomUrl = async (url: string) => {
    const target = resolveApiBaseUrl(url);
    const res = await executeProbe(target, '/health', 3000);
    if (res.ok) {
      return { ok: true, message: `Connected (HTTP 200, ${res.rttMs}ms)`, rttMs: res.rttMs };
    }
    return { ok: false, message: res.error || 'Connection failed', rttMs: res.rttMs };
  };

  // Probe the active origin on mount. setBaseUrl triggers later probes directly.
  useEffect(() => {
    refreshProbes();
  }, [refreshProbes]);

  // Periodic refresh loop if interval is set
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      refreshProbes();
    }, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, refreshProbes]);

  return (
    <ApiContext.Provider
      value={{
        baseUrl,
        setBaseUrl,
        health,
        version,
        root,
        lastChecked,
        isProbing,
        isChecking: isProbing,
        refreshProbes,
        testCustomUrl,
        autoRefreshInterval,
        setAutoRefreshInterval,
        pollingInterval: autoRefreshInterval ?? 0,
        setPollingInterval,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

/**
 * Function: useApi
 * Purpose: Read the API provider state from a React component.
 *
 * Returns:
 *   The current API context value.
 * Throws:
 *   Error when called outside an ApiProvider.
 */
export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
