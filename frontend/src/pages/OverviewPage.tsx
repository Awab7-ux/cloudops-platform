import React, { useState } from 'react';
import { useApi } from '../context/ApiContext.tsx';
import {
  OVERVIEW_METRICS,
  CLUSTER_TELEMETRY,
  NODE_CLUSTER_CAPACITY,
  INITIAL_ACTIVITY_FEED,
  ActivityEvent,
} from '../data/overviewData.ts';

export const OverviewPage: React.FC = () => {
  const { health, version, root, isProbing, refreshProbes, lastChecked, baseUrl } = useApi();
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H' | '7D'>('1H');
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>(INITIAL_ACTIVITY_FEED);
  const [quickActionMessage, setQuickActionMessage] = useState<string | null>(null);

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

  const handleSimulateSpike = () => {
    const spikeEvent: ActivityEvent = {
      id: `sim-${Date.now()}`,
      type: "Simulation",
      summary: "Synthetic Load Injected: +2,500 RPS",
      detail: "Autoscaler spun up 3 temporary worker pods (Demo data)",
      environment: "prod-us-east-1",
      actor: "Operator Console",
      status: "Handled",
      timestamp: "Just now",
    };
    setActivityFeed([spikeEvent, ...activityFeed]);
    setQuickActionMessage("Injected synthetic load spike (+2,500 RPS) into cluster feed");
    setTimeout(() => setQuickActionMessage(null), 3500);
  };

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(activityFeed, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudops-activity-feed-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setQuickActionMessage("Exported operational audit log JSON feed");
    setTimeout(() => setQuickActionMessage(null), 3000);
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
                Frontend Demonstration Mode
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
              . Real FastAPI probes on{' '}
              <span className="font-code-inline text-code-inline text-primary bg-surface-container px-1 py-0.5 rounded">
                /health
              </span>{' '}
              and{' '}
              <span className="font-code-inline text-code-inline text-primary bg-surface-container px-1 py-0.5 rounded">
                /version
              </span>
              . Telemetry metrics below reflect sample demo state.
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
              {isConnected ? `${health.rttMs || 18}ms` : 'ERR'}
            </span>
            <span className="text-on-surface-variant">RTT</span>
          </div>
          <button
            onClick={() => refreshProbes()}
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
                ? `v${version.data.version} (${version.data.build || 'FastAPI-Core'})`
                : 'v1.2.0 (FastAPI-Core)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md px-space-sm py-space-xs">
          <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">speed</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Average Latency
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-label-md truncate">
              {isConnected
                ? `${health.rttMs || 18.4} ms (p95: ${(health.rttMs || 18) + 5}ms)`
                : 'Connection Failed'}
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
              production-demo-east
            </span>
          </div>
        </div>
      </div>

      {/* 4 Top KPI Cards (Labeled "Demo data") */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Card 1: Applications */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                {OVERVIEW_METRICS.applications.title}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {OVERVIEW_METRICS.applications.subtitle}
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Demo data
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {OVERVIEW_METRICS.applications.value}
            </span>
            <span className="font-label-sm text-label-sm text-primary flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
              {OVERVIEW_METRICS.applications.trend}
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>{OVERVIEW_METRICS.applications.healthyCount} Healthy</span>
              <span className="text-error flex items-center gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-error"></span>
                {OVERVIEW_METRICS.applications.degradedCount} Degraded
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden flex">
              <div
                className="bg-primary h-full rounded-l-full"
                style={{ width: `${OVERVIEW_METRICS.applications.healthyPercent}%` }}
              ></div>
              <div
                className="bg-error h-full rounded-r-full"
                style={{ width: `${OVERVIEW_METRICS.applications.degradedPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 2: Deployments */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                {OVERVIEW_METRICS.deployments.title}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {OVERVIEW_METRICS.deployments.subtitle}
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Demo data
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {OVERVIEW_METRICS.deployments.value}
            </span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              {OVERVIEW_METRICS.deployments.trend}
            </span>
          </div>
          <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Avg lead time:</span>
            <span className="font-label-md text-label-md text-on-surface font-semibold">
              {OVERVIEW_METRICS.deployments.avgLeadTime}
            </span>
          </div>
          <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden mt-space-xs">
            <div
              className="bg-primary-container h-full rounded-full"
              style={{ width: `${OVERVIEW_METRICS.deployments.passPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Card 3: CPU Allocation */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                {OVERVIEW_METRICS.cpuUtilization.title}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {OVERVIEW_METRICS.cpuUtilization.subtitle}
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Demo data
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {OVERVIEW_METRICS.cpuUtilization.value}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {OVERVIEW_METRICS.cpuUtilization.trend}
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>Normal envelope</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {OVERVIEW_METRICS.cpuUtilization.breakdown}
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full"
                style={{ width: `${OVERVIEW_METRICS.cpuUtilization.percent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Card 4: Memory Allocation */}
        <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow border border-surface-container-high/40">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                {OVERVIEW_METRICS.memoryAllocation.title}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {OVERVIEW_METRICS.memoryAllocation.subtitle}
              </span>
            </div>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              Demo data
            </span>
          </div>
          <div className="flex items-baseline gap-space-sm my-space-md">
            <span className="font-metric-xl text-metric-xl text-on-surface">
              {OVERVIEW_METRICS.memoryAllocation.value}
            </span>
            <span className="font-label-sm text-label-sm text-primary font-semibold">
              {OVERVIEW_METRICS.memoryAllocation.trend}
            </span>
          </div>
          <div className="space-y-space-xs">
            <div className="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
              <span>20.5 GB / 32 GB</span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                11.5 GB Free
              </span>
            </div>
            <div className="h-1.5 w-full bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="bg-secondary-container h-full rounded-full"
                style={{ width: `${OVERVIEW_METRICS.memoryAllocation.percent}%` }}
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
                    Demo data
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Aggregated CPU core and memory consumption curve
                </span>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center bg-surface-container-low p-1 rounded-lg">
                {(['1H', '6H', '24H', '7D'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-space-sm py-1 text-label-sm font-label-sm rounded transition-colors ${
                      timeRange === range
                        ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend and Metrics Quick Strip */}
            <div className="flex items-center gap-space-xl py-space-xs text-body-sm font-body-sm flex-wrap">
              <div className="flex items-center gap-space-xs">
                <span className="h-3 w-3 rounded-sm bg-primary"></span>
                <span className="text-on-surface">
                  CPU (Average: {CLUSTER_TELEMETRY.cpuAverage} • Peak: {CLUSTER_TELEMETRY.cpuPeak})
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className="h-3 w-3 rounded-sm bg-secondary-container"></span>
                <span className="text-on-surface">
                  Memory (Average: {CLUSTER_TELEMETRY.memAverage} • Peak: {CLUSTER_TELEMETRY.memPeak})
                </span>
              </div>
            </div>

            {/* Inline SVG Visualization */}
            <div className="relative w-full h-64 mt-space-md pt-2">
              <svg
                className="w-full h-full overflow-visible"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 700 220"
              >
                {/* Grid Lines */}
                <line className="text-surface-container-high" stroke="currentColor" strokeDasharray="4 4" x1="0" x2="700" y1="20" y2="20"></line>
                <line className="text-surface-container-high" stroke="currentColor" strokeDasharray="4 4" x1="0" x2="700" y1="70" y2="70"></line>
                <line className="text-surface-container-high" stroke="currentColor" strokeDasharray="4 4" x1="0" x2="700" y1="120" y2="120"></line>
                <line className="text-surface-container-high" stroke="currentColor" strokeDasharray="4 4" x1="0" x2="700" y1="170" y2="170"></line>

                {/* Axis Labels */}
                <text className="fill-current text-outline font-label-sm" fontSize="10" x="5" y="24">80%</text>
                <text className="fill-current text-outline font-label-sm" fontSize="10" x="5" y="74">60%</text>
                <text className="fill-current text-outline font-label-sm" fontSize="10" x="5" y="124">40%</text>
                <text className="fill-current text-outline font-label-sm" fontSize="10" x="5" y="174">20%</text>

                <defs>
                  <linearGradient id="memGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#645efb" stopOpacity="0.25"></stop>
                    <stop offset="100%" stopColor="#645efb" stopOpacity="0.0"></stop>
                  </linearGradient>
                  <linearGradient id="cpuGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#004ac6" stopOpacity="0.30"></stop>
                    <stop offset="100%" stopColor="#004ac6" stopOpacity="0.0"></stop>
                  </linearGradient>
                </defs>

                {/* Memory Path */}
                <path d="M 40 90 Q 120 70 200 85 T 360 60 T 520 75 T 690 65 L 690 200 L 40 200 Z" fill="url(#memGrad)"></path>
                <path d="M 40 90 Q 120 70 200 85 T 360 60 T 520 75 T 690 65" fill="none" stroke="#645efb" strokeLinecap="round" strokeWidth="2.5"></path>

                {/* CPU Path */}
                <path d="M 40 140 Q 120 110 200 130 T 360 100 T 520 125 T 690 110 L 690 200 L 40 200 Z" fill="url(#cpuGrad)"></path>
                <path d="M 40 140 Q 120 110 200 130 T 360 100 T 520 125 T 690 110" fill="none" stroke="#004ac6" strokeLinecap="round" strokeWidth="2.5"></path>

                {/* Marker Points */}
                <circle className="fill-surface-container-lowest stroke-primary" cx="360" cy="100" r="4" strokeWidth="2"></circle>
                <circle className="fill-surface-container-lowest stroke-secondary" cx="360" cy="60" r="4" strokeWidth="2"></circle>
              </svg>
            </div>

            <div className="flex justify-between items-center text-on-surface-variant font-label-sm text-label-sm mt-2 px-6 flex-wrap">
              {CLUSTER_TELEMETRY.timeLabels.map((label, idx) => (
                <span key={idx}>{label}</span>
              ))}
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
                  Regional worker hosts and hypervisor allocation (Demo data)
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-space-xs py-space-xxs rounded">
                3 Availability Zones
              </span>
            </div>

            <div className="space-y-space-md">
              {NODE_CLUSTER_CAPACITY.map(node => (
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
                      : '{ "status": "healthy" }'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {health.rttMs ? `${health.rttMs}ms` : '14ms'}
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
                      : '{ "version": "1.2.0" }'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {version.rttMs ? `${version.rttMs}ms` : '19ms'}
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
                      : '{ "name": "CloudOps API" }'}
                  </span>
                  <span className="text-primary shrink-0 ml-2">
                    {root.rttMs ? `${root.rttMs}ms` : '22ms'}
                  </span>
                </div>
              </div>
            </div>

            {/* Uptime Stats Card */}
            <div className="mt-space-lg p-space-md rounded-lg bg-surface-container-high space-y-space-sm">
              <div className="flex justify-between items-center font-body-sm text-body-sm">
                <span className="text-on-surface-variant">SLA Availability (30d)</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold">99.98%</span>
              </div>
              <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden flex">
                <div className="bg-primary h-full w-[99.98%]"></div>
              </div>
              <div className="flex justify-between items-center font-label-sm text-label-sm text-on-surface-variant pt-1">
                <span>
                  Last checked:{' '}
                  <span className="text-on-surface font-semibold">
                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Just now'}
                  </span>
                </span>
                <span className="text-primary font-semibold">Zero incidents</span>
              </div>
            </div>

            {/* Latency mini-histogram */}
            <div className="mt-space-md">
              <span className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-medium">
                Probe Latency History (Last 12 checks)
              </span>
              <div className="flex items-end gap-1.5 h-16 w-full px-1">
                {[40, 55, 35, 45, 50, 70, 35, 40, 45, 38, 48, 42].map((height, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-colors ${
                      i === 11 ? 'bg-primary' : 'bg-surface-container-highest hover:bg-primary'
                    }`}
                    style={{ height: `${height}%` }}
                    title={`${Math.round(height * 0.4)}ms`}
                  ></div>
                ))}
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant mt-1">
                <span>-6m</span>
                <span className="font-semibold text-primary">
                  Current: {health.rttMs ? `${health.rttMs}ms` : '17ms'}
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
                onClick={handleSimulateSpike}
                className="p-space-sm rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors flex flex-col items-start gap-1 text-left cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">trending_up</span>
                <span className="font-body-sm text-body-sm font-medium text-on-surface">Simulate Spike</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Inject demo metric</span>
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
              Recent orchestrations, automatic rollouts, and infrastructure telemetry events (Demo data)
            </p>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Feed status:</span>
            <span className="px-space-xs py-space-xxs rounded bg-surface-container text-primary font-label-sm text-label-sm font-semibold">
              Streaming
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
              {activityFeed.map(event => (
                <tr key={event.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="py-space-md px-space-md">
                    <span
                      className={`inline-flex items-center gap-1 font-label-sm text-label-sm px-2 py-0.5 rounded font-medium ${
                        event.type === 'Deployment'
                          ? 'bg-surface-container text-primary'
                          : event.type === 'Alert'
                          ? 'bg-surface-container-high text-on-surface'
                          : event.type === 'Simulation'
                          ? 'bg-secondary-fixed text-on-secondary-fixed'
                          : 'bg-surface-container text-secondary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {event.type === 'Deployment'
                          ? 'rocket_launch'
                          : event.type === 'Alert'
                          ? 'warning'
                          : event.type === 'Simulation'
                          ? 'bolt'
                          : 'tune'}
                      </span>
                      {event.type}
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
