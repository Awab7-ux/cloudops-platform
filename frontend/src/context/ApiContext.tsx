import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { executeProbe, resolveBaseUrl } from '../services/apiService.ts';

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

export interface ApiContextType {
  baseUrl: string;
  setBaseUrl: (url: string) => void;
  health: HealthState;
  version: VersionState;
  root: RootState;
  lastChecked: Date | null;
  isProbing: boolean;
  isChecking: boolean;
  refreshProbes: () => Promise<void>;
  testCustomUrl: (url: string) => Promise<{ ok: boolean; message: string; rttMs: number }>;
  autoRefreshInterval: number | null;
  setAutoRefreshInterval: (ms: number | null) => void;
  pollingInterval: number;
  setPollingInterval: (ms: number) => void;
  chaosSpike: boolean;
  setChaosSpike: (val: boolean) => void;
  canaryFailure: boolean;
  setCanaryFailure: (val: boolean) => void;
  resetDemoState: () => void;
}

const ApiContext = createContext<ApiContextType | null>(null);

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [baseUrl, setBaseUrlState] = useState<string>(() => resolveBaseUrl());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number | null>(10000);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Chaos & simulation toggles
  const [chaosSpike, setChaosSpike] = useState<boolean>(false);
  const [canaryFailure, setCanaryFailure] = useState<boolean>(false);

  const [health, setHealth] = useState<HealthState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${resolveBaseUrl()}/health`,
  });

  const [version, setVersion] = useState<VersionState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${resolveBaseUrl()}/version`,
  });

  const [root, setRoot] = useState<RootState>({
    status: 'idle',
    data: null,
    error: null,
    rttMs: 0,
    responseTimeMs: 0,
    httpStatus: 0,
    url: `${resolveBaseUrl()}/`,
  });

  const setBaseUrl = (url: string) => {
    const cleaned = resolveBaseUrl(url);
    setBaseUrlState(cleaned);
  };

  const setPollingInterval = (ms: number) => {
    setAutoRefreshInterval(ms > 0 ? ms : null);
  };

  const refreshProbes = useCallback(async () => {
    setIsProbing(true);
    setHealth(prev => ({ ...prev, status: 'loading' }));
    setVersion(prev => ({ ...prev, status: 'loading' }));
    setRoot(prev => ({ ...prev, status: 'loading' }));

    const [healthRes, versionRes, rootRes] = await Promise.all([
      executeProbe(baseUrl, '/health'),
      executeProbe(baseUrl, '/version'),
      executeProbe(baseUrl, '/'),
    ]);

    setHealth({
      status: healthRes.ok ? 'success' : 'error',
      data: healthRes.data,
      error: healthRes.error || null,
      rttMs: healthRes.rttMs,
      responseTimeMs: healthRes.rttMs,
      httpStatus: healthRes.status,
      url: `${baseUrl}/health`,
    });

    setVersion({
      status: versionRes.ok ? 'success' : 'error',
      data: versionRes.data,
      error: versionRes.error || null,
      rttMs: versionRes.rttMs,
      responseTimeMs: versionRes.rttMs,
      httpStatus: versionRes.status,
      url: `${baseUrl}/version`,
    });

    setRoot({
      status: rootRes.ok ? 'success' : 'error',
      data: rootRes.data,
      error: rootRes.error || null,
      rttMs: rootRes.rttMs,
      responseTimeMs: rootRes.rttMs,
      httpStatus: rootRes.status,
      url: `${baseUrl}/`,
    });

    setLastChecked(new Date());
    setIsProbing(false);
  }, [baseUrl]);

  const testCustomUrl = async (url: string) => {
    const target = resolveBaseUrl(url);
    const res = await executeProbe(target, '/health', 3000);
    if (res.ok) {
      return { ok: true, message: `Connected (HTTP 200, ${res.rttMs}ms)`, rttMs: res.rttMs };
    }
    return { ok: false, message: res.error || 'Connection failed', rttMs: res.rttMs };
  };

  const resetDemoState = () => {
    setChaosSpike(false);
    setCanaryFailure(false);
    setAutoRefreshInterval(10000);
    setBaseUrlState(resolveBaseUrl());
    refreshProbes();
  };

  // Initial probe on mount
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
        chaosSpike,
        setChaosSpike,
        canaryFailure,
        setCanaryFailure,
        resetDemoState,
      }}
    >
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};
