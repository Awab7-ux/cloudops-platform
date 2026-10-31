import React, { useEffect, useState } from 'react';
import { getSummary } from '../api/summary';
import { listLogs } from '../api/logs';
import type { SummaryResponse } from '../api/types';
import { useApi } from '../context/ApiContext.tsx';

export const OverviewPage: React.FC = () => {
  const { health, version, root, isProbing, refreshProbes, lastChecked, baseUrl } = useApi();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryState, setSummaryState] = useState<'loading' | 'success' | 'error'>('loading');
  const [summaryError, setSummaryError] = useState('');
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null);
  const nodeCapacity: Array<{ id: string; name: string; instanceType: string; cpu: number; ram: number; status: string }> = [];

  useEffect(() => {
    let active = true;
    setSummaryState('loading');
    setSummaryError('');
    void getSummary()
      .then(result => {
        if (!active) return;
        setSummary(result);
        setSummaryState('success');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSummary(null);
        setSummaryError(error instanceof Error ? error.message : 'Unable to load summary.');
        setSummaryState('error');
      });
    return () => { active = false; };
  }, [summaryRefresh]);

  const summaryValue = summaryState === 'loading'
    ? 'Loading…'
    : summaryState === 'error' ? 'Unavailable' : '—';
  const applicationTotal = summary?.applications.total;
  const applicationHealthy = summary?.applications.by_status.healthy ?? 0;
  const applicationDegraded = summary?.applications.by_status.degraded ?? 0;
  const applicationDown = summary?.applications.by_status.down ?? 0;
  const applicationUnknown = summary?.applications.by_status.unknown ?? 0;
  const applicationOther = applicationDegraded + applicationDown + applicationUnknown;
  const applicationStatusTotal = (applicationTotal ?? 0) > 0 ? applicationTotal ?? 0 : 0;
  const applicationHealthyPercent = applicationStatusTotal > 0
    ? (applicationHealthy / applicationStatusTotal) * 100
    : 0;
  const applicationOtherPercent = applicationStatusTotal > 0
    ? (applicationOther / applicationStatusTotal) * 100
    : 0;
  const deploymentTotal = summary?.deployments.total;
  const deploymentSucceeded = summary?.deployments.by_status.succeeded ?? 0;
  const deploymentSuccessPercent = (deploymentTotal ?? 0) > 0
    ? (deploymentSucceeded / (deploymentTotal ?? 1)) * 100
    : 0;
  const activityFeed = summary?.recent_failed_deployments.map(deployment => ({
    id: deployment.id,
    summary: `Latest deployment failed for ${deployment.application_name}`,
    detail: deployment.commit_sha ? `Commit: ${deployment.commit_sha}` : 'Commit not available',
    environment: 'Unavailable',
    actor: 'Backend API',
    status: deployment.status,
    timestamp: deployment.finished_at
      ? new Date(deployment.finished_at).toLocaleString()
      : 'Timestamp unavailable',
  })) ?? [];
  const summaryBadge = summaryState === 'success'
    ? 'Live API'
    : summaryState === 'loading' ? 'Loading…' : 'Unavailable';

  const isConnected = health.status === 'success';

  // Quick Action handlers
  const handleInspectHealth = async () => {
    await refreshProbes();
    setQuickActionMessage(
      health.status === 'success'
        ? `GET /health succeeded: ${JSON.stringify(health.data)}`
        : `GET /health failed: ${health.error || 'Server offline'}`
    );
    setTimeout(() => setQuickActionMessage(null), 4000);
  };

  const handleCheckVersion = async () => {
    await refreshProbes();
    setQuickActionMessage(
      version.status === 'success'
        ? `GET /version succeeded: ${JSON.stringify(version.data)}`
        : `GET /version failed: ${version.error || 'Server offline'}`
    );
    setTimeout(() => setQuickActionMessage(null), 4000);
  };

  const handleExportLogs = async () => {
    try {
      const result = await listLogs({ limit: 200, offset: 0 });
      const jsonStr = JSON.stringify(result.items, null, 2);
      const url = URL.createObjectURL(new Blob([jsonStr], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cloudops-logs-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setQuickActionMessage(`Exported ${result.items.length} backend log records.`);
    } catch (error: unknown) {
      setQuickActionMessage(error instanceof Error ? error.message : 'Unable to export backend logs.');
    }
    setTimeout(() => setQuickActionMessage(null), 3500);
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl space-y-space-lg pt-4">
      {/* Quick Action Feedback Toast */}
      {quickActionMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">info</span>
          <span>{quickActionMessage}</span>
        </div>
      )}

      {/* Operational Mode Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low shadow-sm px-space-lg py-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md border border-surface-container-high/40">
        <div className="flex items-start md:items-center gap-space-md">
          <div className="h-9 w-9 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">info</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                CloudOps Platform Overview
              </span>
              <span className="px-space-xs py-space-xxs rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                Live Probe Active
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Target backend URL:{' '}
              <span className="font-code-inline text-code-inline text-primary bg-surface-container px-1 py-0.5 rounded">
                {baseUrl}
              </span>
              . FastAPI probes on{' '}
              <span className="font-code-inline text-code-inline text-primary bg-surface-container px-1 py-0.5 rounded">
                /health
              </span>{' '}
              and{' '}
              <span className="font-code-inline text-code-inline text-primary bg-surface-container px-1 py-0.5 rounded">
                /version
              </span>
              . Application and deployment totals are live backend data; Prometheus cluster metrics are not connected to this view.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-xs shrink-0 self-start md:self-auto">
          <div className="flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg bg-surface-container-lowest shadow-sm font-label-sm text-label-sm text-on-surface">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-primary animate-ping' : 'bg-error'
              }`}
            ></span>
            <span className="font-label-md text-label-md text-on-surface">
              {isConnected && health.rttMs !== undefined ? `${health.rttMs}ms` : 'Unavailable'}
            </span>
            <span className="text-on-surface-variant">RTT</span>
          </div>
          <button
            onClick={() => {
              void refreshProbes();
              setSummaryRefresh(value => value + 1);
            }}
            disabled={isProbing}
            className="px-space-sm py-1.5 rounded-lg bg-primary text-on-primary font-body-sm text-body-sm flex items-center gap-space-xs shadow-sm hover:bg-tertiary transition-colors cursor-pointer disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isProbing ? 'animate-spin' : ''
              }`}
            >
              sync
            </span>
            <span>{isProbing ? 'Checking...' : 'Run Health Check'}</span>
          </button>
        </div>
      </div>

      {/* Live Backend Node Probe Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm border border-surface-container-high/40">
        <div className="flex items-center gap-space-md px-space-sm py-space-xs">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">dns</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Service State
            </span>
            <div className="flex items-center gap-space-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? 'bg-primary' : 'bg-error'
                }`}
              ></span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {isConnected
                  ? (health.data?.status === 'healthy' ? 'Healthy (Operational)' : String(health.data?.status || 'Online'))
                  : 'Backend Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-space-md px-space-sm py-space-xs">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">code</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Engine / Build
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-md truncate">
              {version.status === 'success' && version.data?.version
                ? `v${version.data.version}${version.data.build ? ` (${version.data.build})` : ''}`
                : version.status === 'loading' ? 'Checking…' : 'Unavailable'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md px-space-sm py-space-xs">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">speed</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Health Probe RTT
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-md truncate">
              {health.status === 'success' && health.rttMs !== undefined
                ? `${health.rttMs} ms`
                : health.status === 'loading' ? 'Checking…' : 'Unavailable'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md px-space-sm py-space-xs">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Environment
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">
              Local environment
            </span>
            <span className="px-space-xs py-space-xxs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
              Local
            </span>
          </div>
        </div>
      </div>

      {/* Backend summary and unavailable cluster metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Card 1: Applications */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Applications
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {summaryState === 'success'
                  ? `Down: ${applicationDown} · Unknown: ${applicationUnknown}`
                  : summaryValue}
              </span>
            </div>
            <span title={summaryError || undefined} className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              {summaryBadge}
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {applicationTotal ?? summaryValue}
            </span>
            <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              {summaryState === 'success' ? '—' : summaryValue}
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>{summaryState === 'success' ? applicationHealthy : summaryValue} Healthy</span>
              <span className="text-error flex items-center gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-error"></span>
                {summaryState === 'success' ? applicationOther : summaryValue} Other
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden flex">
              <div
                className="bg-primary h-full rounded-l-full"
                style={{ width: `${applicationHealthyPercent}%` }}
              ></div>
              <div
                className="bg-error h-full rounded-r-full"
                style={{ width: `${applicationOtherPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 2: Deployments */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Deployments
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                All recorded deployment states
              </span>
            </div>
            <span title={summaryError || undefined} className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              {summaryBadge}
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {deploymentTotal ?? summaryValue}
            </span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              {summaryState === 'success'
                ? `${summary?.deployments.last_24h ?? 0} in last 24h`
                : summaryValue}
            </span>
          </div>
          <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Succeeded:</span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {summaryState === 'success' ? deploymentSucceeded : summaryValue}
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden mt-space-xs">
            <div
              className="bg-primary-container h-full rounded-full"
              style={{ width: `${deploymentSuccessPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Card 3: CPU Allocation */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                CPU Utilization
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Not available through the current API
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Unavailable
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              Not available
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              No Prometheus connection configured in the frontend
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>Normal envelope</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Not available
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: '0%' }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 4: Memory Allocation */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Memory Allocation
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Not available through the current API
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Unavailable
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              Not available
            </span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              No Prometheus connection configured in the frontend
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>Resource totals unavailable</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                —
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="bg-secondary-container h-full rounded-full"
                style={{ width: '0%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Grid: 2-Column Split (Data Telemetry vs Live Probes) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left: Resource Charts & Cluster Breakdown (8 cols) */}
        <div className="lg:col-span-8 flex flex-col space-y-space-lg">
          {/* Telemetry Chart Card */}
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container-high/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pb-space-md">
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Cluster Telemetry &amp; Throughput
                  </span>
                  <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-medium">
                    Unavailable
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Prometheus cluster metrics are not available to this frontend.
                </span>
              </div>

              <span className="px-space-sm py-1 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                No metrics connection
              </span>
            </div>

            <div role="status" className="mt-space-md flex h-64 items-center justify-center rounded-lg bg-surface-container-low text-center font-body-sm text-body-sm text-on-surface-variant">
              No CPU or memory time series are available from the frontend API.
            </div>
          </div>

          {/* Node Resource Cluster Breakdown */}
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container-high/40">
            <div className="flex items-center justify-between pb-space-md">
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Node Cluster Capacity Breakdown
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Node inventory and resource metrics are unavailable through the backend.
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-space-xs py-space-xxs rounded">
                Unavailable
              </span>
            </div>

            <div className="space-y-space-md">
              {nodeCapacity.length === 0 && (
                <p className="rounded-lg bg-surface-container-low p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">
                  No node capacity data is available.
                </p>
              )}
              {nodeCapacity.map(node => (
                <div
                  key={node.id}
                  className="p-space-md rounded-lg bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-sm"
                >
                  <div className="flex items-center gap-space-md min-w-[200px]">
                    <div className="h-8 w-8 rounded bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm font-label-sm font-bold">
                      {node.id}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        {node.name}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {node.instanceType}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-space-lg">
                    <div className="space-y-1">
                      <div className="flex justify-between text-body-sm font-body-sm">
                        <span className="text-on-surface-variant">CPU</span>
                        <span className="font-label-sm text-on-surface font-semibold">{node.cpu}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${node.cpu}%` }}></div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-body-sm font-body-sm">
                        <span className="text-on-surface-variant">RAM</span>
                        <span className="font-label-sm text-on-surface font-semibold">{node.ram}%</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                        <div className="bg-secondary-container h-full rounded-full" style={{ width: `${node.ram}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-xs justify-end min-w-[90px]">
                    <span className="px-space-xs py-space-xxs rounded bg-surface-container-lowest text-primary font-label-sm text-label-sm shadow-sm font-semibold">
                      {node.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Service Health & FastAPI Probe Card (4 cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-space-lg">
          {/* API Probe Detail Console */}
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col border border-surface-container-high/40">
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[20px]">network_check</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">Live API Probes</span>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected ? 'bg-primary animate-pulse' : 'bg-error'
                }`}
                title={isConnected ? 'Socket Active' : 'Socket Offline'}
              ></span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              Real-time validation against host backend: <code className="text-primary font-code-inline">{baseUrl}</code>
            </p>

            {/* Probe Endpoints */}
            <div className="space-y-space-sm">
              {/* Probe Endpoint 1: GET /health */}
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-medium text-on-surface">
                    GET /health
                  </span>
                  <span
                    className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-bold shadow-sm ${
                      health.status === 'success'
                        ? 'bg-surface-container-lowest text-primary'
                        : health.status === 'loading'
                        ? 'bg-surface-container text-tertiary'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {health.status === 'loading'
                      ? 'PROBING...'
                      : health.status === 'success'
                      ? '200 OK'
                      : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm overflow-x-auto">
                  <span className="font-code-inline truncate max-w-[200px]">
                    {health.data
                      ? JSON.stringify(health.data)
                      : health.error
                      ? health.error
                      : 'No response received'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {health.rttMs !== undefined ? `${health.rttMs}ms` : '-'}
                  </span>
                </div>
              </div>

              {/* Probe Endpoint 2: GET /version */}
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-medium text-on-surface">
                    GET /version
                  </span>
                  <span
                    className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-bold shadow-sm ${
                      version.status === 'success'
                        ? 'bg-surface-container-lowest text-primary'
                        : version.status === 'loading'
                        ? 'bg-surface-container text-tertiary'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {version.status === 'loading'
                      ? 'PROBING...'
                      : version.status === 'success'
                      ? '200 OK'
                      : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm overflow-x-auto">
                  <span className="font-code-inline truncate max-w-[200px]">
                    {version.data
                      ? JSON.stringify(version.data)
                      : version.error
                      ? version.error
                      : 'No response received'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {version.rttMs !== undefined ? `${version.rttMs}ms` : '-'}
                  </span>
                </div>
              </div>

              {/* Probe Endpoint 3: GET / */}
              <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-medium text-on-surface">
                    GET /
                  </span>
                  <span
                    className={`px-space-xs py-0.5 rounded font-label-sm text-label-sm font-bold shadow-sm ${
                      root.status === 'success'
                        ? 'bg-surface-container-lowest text-primary'
                        : root.status === 'loading'
                        ? 'bg-surface-container text-tertiary'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {root.status === 'loading'
                      ? 'PROBING...'
                      : root.status === 'success'
                      ? '200 OK'
                      : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm overflow-x-auto">
                  <span className="font-code-inline truncate max-w-[200px]">
                    {root.data
                      ? JSON.stringify(root.data)
                      : root.error
                      ? root.error
                      : 'No response received'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {root.rttMs !== undefined ? `${root.rttMs}ms` : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Uptime Stats Card */}
            <div className="mt-space-lg p-space-md rounded-lg bg-surface-container-high space-y-space-sm">
              <div className="flex justify-between items-center font-body-sm text-body-sm">
                <span className="text-on-surface-variant">SLA Availability (30d)</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Not available</span>
              </div>
              <span className="px-space-xs py-space-xxs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                Unavailable
              </span>
              <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden flex">
                <div className="bg-primary h-full w-0"></div>
              </div>
              <div className="flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant pt-1">
                <span>
                  Last checked:{' '}
                  <span className="text-on-surface font-semibold">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Unavailable'}
                  </span>
                </span>
                <span className="text-on-surface-variant font-semibold">Incident history unavailable</span>
              </div>
            </div>

            {/* Latency mini-histogram */}
            <div className="mt-space-md">
              <div className="flex items-center gap-space-xs mb-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
                  Latest probe response
                </span>
              </div>
              <div className="flex h-16 items-center justify-center rounded bg-surface-container-low text-body-sm text-body-sm text-on-surface-variant">
                Probe history is not available.
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-1">
                <span>-6m</span>
                <span className="font-semibold text-primary">
                  Current: {health.rttMs !== undefined ? `${health.rttMs}ms` : 'Unavailable'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container-high/40">
            <span className="font-headline-sm text-headline-sm text-on-surface block mb-space-sm">
              Operations Quick Actions
            </span>
            <div className="grid grid-cols-2 gap-space-xs">
              <button
                type="button"
                onClick={handleInspectHealth}
                className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors flex flex-col items-start gap-1 text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">stethoscope</span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Inspect Health</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Query /health</span>
              </button>

              <button
                type="button"
                onClick={handleCheckVersion}
                className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors flex flex-col items-start gap-1 text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">history_toggle_off</span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Check Version</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Verify backend tag</span>
              </button>

              <button
                type="button"
                disabled
                title="Synthetic load injection is not available through the backend."
                className="p-space-sm rounded-lg bg-surface-container-low flex flex-col items-start gap-1 text-left cursor-not-allowed opacity-60"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">trending_up</span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Load testing unavailable</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">No backend load-test action</span>
              </button>

              <button
                type="button"
                onClick={handleExportLogs}
                className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors flex flex-col items-start gap-1 text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface">download</span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Export Logs</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Download JSON feed</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Activity Feed Table */}
      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-md">
          <div>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              Operational Activity Feed
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Recent failed deployment records returned by the backend summary.
            </p>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Feed status:</span>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container text-primary font-label-sm text-label-sm font-semibold">
              {summaryBadge}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-space-sm px-space-md rounded-l-lg">Type</th>
                <th className="py-space-sm px-space-md">Event Summary</th>
                <th className="py-space-sm px-space-md">Environment</th>
                <th className="py-space-sm px-space-md">Actor / Source</th>
                <th className="py-space-sm px-space-md">Status</th>
                <th className="py-space-sm px-space-md text-right rounded-r-lg">Timestamp</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-container-high/40">
              {summaryState === 'loading' && (
                <tr><td colSpan={6} className="py-space-md px-space-md text-center">Loading activity…</td></tr>
              )}
              {summaryState === 'success' && activityFeed.length === 0 && (
                <tr><td colSpan={6} className="py-space-md px-space-md text-center text-on-surface-variant">No recent failed deployments were returned.</td></tr>
              )}
              {summaryState === 'error' && (
                <tr><td colSpan={6} className="py-space-md px-space-md text-center text-on-surface-variant">Activity is unavailable while the summary API is offline.</td></tr>
              )}
              {activityFeed.map(event => (
                <tr key={event.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-space-md px-space-md">
                    <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded font-medium bg-surface-container text-primary">
                      <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
                      Deployment
                    </span>
                  </td>
                  <td className="py-space-md px-space-md font-medium">
                    <div className="flex flex-col">
                      <span>{event.summary}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant font-code-inline">
                        {event.detail}
                      </span>
                    </div>
                  </td>
                  <td className="py-space-md px-space-md font-label-sm text-label-sm text-on-surface-variant">
                    {event.environment}
                  </td>
                  <td className="py-space-md px-space-md">{event.actor}</td>
                  <td className="py-space-md px-space-md">
                    <span className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                      {event.status}
                    </span>
                  </td>
                  <td className="py-space-md px-space-md text-right text-on-surface-variant font-label-sm text-label-sm">
                    {event.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
