import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../context/ApiContext.tsx';
import { ApiError } from '../api/client';
import { getApplication } from '../api/applications';
import { listDeployments } from '../api/deployments';
import { listApplicationLogs } from '../api/logs';
import type { Application, Deployment, LogRecord } from '../api/types';

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { health, version } = useApi();
  const [application, setApplication] = useState<Application | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [deploymentsState, setDeploymentsState] = useState<'loading' | 'success' | 'error'>('loading');
  const [applicationLogs, setApplicationLogs] = useState<LogRecord[]>([]);
  const [logsState, setLogsState] = useState<'loading' | 'success' | 'error'>('loading');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'env' | 'deployments' | 'pods' | 'metrics'>('overview');

  useEffect(() => {
    let active = true;
    setApplication(null);
    setLoading(true);
    setLoadError(null);
    setNotFound(false);
    void getApplication(id ?? '')
      .then(record => {
        if (!active) return;
        setApplication(record);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(error instanceof Error ? error.message : 'Unable to load application.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id, retry]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setDeployments([]);
    setApplicationLogs([]);
    setDeploymentsState('loading');
    setLogsState('loading');
    void listDeployments(id, { limit: 3, offset: 0 })
      .then(result => {
        if (!active) return;
        setDeployments(result.items);
        setDeploymentsState('success');
      })
      .catch(() => {
        if (!active) return;
        setDeployments([]);
        setDeploymentsState('error');
      });
    void listApplicationLogs(id, { limit: 5, offset: 0 })
      .then(result => {
        if (!active) return;
        setApplicationLogs(result.items);
        setLogsState('success');
      })
      .catch(() => {
        if (!active) return;
        setApplicationLogs([]);
        setLogsState('error');
      });
    return () => { active = false; };
  }, [id, retry]);

  const service = {
    id: application?.id ?? id ?? '',
    name: application?.name ?? 'Unknown application',
    health: application?.status ?? 'unknown',
    environment: application?.environment ?? 'Unavailable',
    version: 'Not available',
    namespace: 'Not available',
    port: 'Not available',
    protocol: 'Not available',
    ingressHost: 'Not available',
    replicasReady: null,
    replicasTotal: null,
    cpu: 'Not available',
    memory: 'Not available',
    runtime: 'Not available',
    minScale: null,
    maxScale: null,
    gracePeriod: 'Not available',
  };
  const isConnected = health.status === 'success';

  if (loading) {
    return (
      <div role="status" className="flex flex-col w-full pb-space-2xl pt-4">
        <p className="font-body-sm text-body-sm text-on-surface-variant">Loading application…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div role="alert" className="flex flex-col w-full pb-space-2xl pt-4">
        <p className="font-body-sm text-body-sm text-on-surface-variant">Application not found.</p>
        <button
          type="button"
          onClick={() => setRetry(value => value + 1)}
          className="mt-space-md self-start px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-body-sm text-body-sm hover:bg-tertiary transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loadError || !application) {
    return (
      <div role="alert" className="flex flex-col w-full pb-space-2xl pt-4">
        <p className="font-body-sm text-body-sm text-on-surface-variant">{loadError ?? 'Unable to load application.'}</p>
        <button
          type="button"
          onClick={() => setRetry(value => value + 1)}
          className="mt-space-md self-start px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-body-sm text-body-sm hover:bg-tertiary transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-space-2xl pt-4">
      {/* Backend coverage notice */}
      <div className="mb-space-lg flex items-center justify-between px-space-lg py-space-sm rounded-xl bg-surface-container-high text-on-surface shadow-sm border border-surface-container-high/60">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
            info
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            <strong className="font-headline-sm text-headline-sm text-on-surface">
              Backend data availability:
            </strong>{' '}
            Application identity, environment, and status are live API data. Cluster telemetry, pods, and release history are not available through the backend.
          </p>
        </div>
        <div className="flex items-center gap-space-xs shrink-0 pl-space-md">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-primary animate-ping' : 'bg-error'
            }`}
          ></span>
          <span className="font-label-sm text-label-sm text-primary font-semibold">
            {isConnected
              ? version.data?.version ? `FastAPI v${version.data.version}` : 'Backend version unavailable'
              : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant mb-space-xs">
        <Link to="/" className="hover:text-primary transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <Link to="/applications" className="hover:text-primary transition-colors">
          Applications
        </Link>
        <span>/</span>
        <span className="font-label-sm text-label-sm text-primary font-semibold">
          {service.name}
        </span>
      </div>

      {/* Application Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md pt-space-xs mb-space-md">
        <div className="flex flex-wrap items-center gap-space-md">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-md">
            <span className="material-symbols-outlined text-[28px]">shield_person</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-sm flex-wrap">
              <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
                {service.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-lowest text-on-surface shadow-sm font-label-sm text-label-sm">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                <span className="text-primary font-semibold">
                  {service.health}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant font-code-inline text-code-inline">
                {service.version}
              </span>
            </div>
            <div className="flex items-center gap-space-xs mt-space-xxs text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[15px] text-tertiary">hub</span>
              <span>Environment:</span>
              <span className="text-on-surface font-semibold">
                {service.environment}
              </span>
              <span className="text-outline-variant">•</span>
              <span>Namespace:</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest text-on-surface font-code-inline text-code-inline shadow-sm">
                {service.namespace}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-space-xs">
          <button
            type="button"
            disabled
            title="Manifest sync is not available through the backend."
            className="flex items-center gap-space-xs px-3.5 py-2 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm shadow-sm cursor-not-allowed opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Trigger Sync unavailable</span>
          </button>
          <button
            type="button"
            disabled
            title="Application rollback is not available through the backend."
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-error font-headline-sm text-headline-sm shadow-sm cursor-not-allowed opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Rollback unavailable</span>
          </button>
          <Link
            to={`/logs?application=${encodeURIComponent(service.id)}`}
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm shadow-sm hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
            <span>View Logs</span>
          </Link>
          <Link
            to="/monitoring"
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm shadow-sm hover:bg-surface-container-high transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">monitoring</span>
            <span>Open Grafana</span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">open_in_new</span>
          </Link>
        </div>
      </div>

      {/* Interactive Tabs Bar */}
      <div className="mt-space-md mb-space-lg flex items-center gap-space-xs bg-surface-container-lowest p-1.5 rounded-xl shadow-sm overflow-x-auto border border-surface-container-high/40">
        {[
          { key: 'overview', label: 'Overview & Health' },
          { key: 'env', label: 'Environment & Config' },
          { key: 'deployments', label: 'Recent Deployments', badge: deploymentsState === 'success' ? String(deployments.length) : undefined },
          { key: 'pods', label: 'Pod Fleet', badge: 'Unavailable' },
          { key: 'metrics', label: 'Detailed Metrics' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-space-md py-space-xs rounded-lg font-headline-sm text-headline-sm transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`px-1.5 py-0.2 rounded-full font-label-sm text-label-sm ${
                  activeTab === tab.key
                    ? 'bg-on-primary text-primary font-bold'
                    : 'bg-surface-container text-on-surface'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Application fields supplied by the backend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-space-md mb-space-lg">
        {/* Service Port */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Service Port</span>
            <span className="material-symbols-outlined text-[18px] text-primary">lan</span>
          </div>
          <div>
            <div className="font-metric-lg text-metric-lg text-on-surface font-bold">{service.port}</div>
            <div className="mt-space-xxs font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
              <span>Not available from the applications API</span>
            </div>
          </div>
        </div>

        {/* Ingress Host */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Ingress Host</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">alt_route</span>
          </div>
          <div>
            <div className="font-label-md text-label-md text-primary font-semibold truncate" title={service.ingressHost}>
              {service.ingressHost}
            </div>
            <div className="mt-space-xxs font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1">
              <span>Ingress routing details are not available.</span>
            </div>
          </div>
        </div>

        {/* Replica Fleet */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Replica Fleet</span>
            <span className="material-symbols-outlined text-[18px] text-primary">grid_view</span>
          </div>
          <div>
            <div className="flex items-baseline gap-space-xs">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Replica readiness is not available from the backend.
              </span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-space-sm overflow-hidden flex">
              <div className="bg-primary h-full w-0"></div>
            </div>
          </div>
        </div>

        {/* Allocation / Quota */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Allocation / Quota</span>
            <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
          </div>
          <div>
            <div className="font-body-md text-body-md text-on-surface font-semibold">{service.cpu} / {service.memory}</div>
            <div className="mt-space-xxs font-label-sm text-label-sm text-on-surface-variant">
              Resource limits are not available from the backend.
            </div>
          </div>
        </div>

        {/* Runtime & Workers */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Runtime &amp; Workers</span>
            <span className="material-symbols-outlined text-[18px] text-tertiary">code</span>
          </div>
          <div>
            <div className="font-body-md text-body-md text-on-surface font-semibold truncate">Python 3.11</div>
            <div className="mt-space-xxs font-label-sm text-label-sm text-on-surface-variant truncate">FastAPI ASGI (Uvicorn x4)</div>
          </div>
        </div>

        {/* Last Deployed */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div className="flex items-center justify-between text-on-surface-variant mb-space-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider">Last Deployed</span>
            <span className="material-symbols-outlined text-[18px] text-primary">commit</span>
          </div>
          <div>
            <div className="flex items-center gap-1 font-body-md text-body-md text-on-surface font-semibold">
              <span>12m ago</span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container font-code-inline text-code-inline text-primary">#609d93a</span>
            </div>
            <div className="mt-space-xxs font-label-sm text-label-sm text-on-surface-variant">via GitHub Actions CI</div>
          </div>
        </div>
      </div>

      {/* Resource Telemetry Charts & Architecture Topology Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg mb-space-lg">
        {/* Left: 8 Cols Telemetry Charts */}
        <div className="xl:col-span-8 flex flex-col gap-space-lg">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-surface-container-high/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-md gap-space-sm">
              <div>
                <div className="flex items-center gap-space-xs">
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">Resource Utilization Telemetry</h2>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container font-label-sm text-label-sm">Unavailable</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">CPU and memory metrics are not exposed by the backend.</p>
              </div>
              <span className="px-space-sm py-1 rounded-lg bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                No telemetry API
              </span>
            </div>

            {/* Graphs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg pt-space-sm">
              {/* CPU Utilization Graph */}
              <div className="flex flex-col p-space-md rounded-xl bg-surface-container-low shadow-sm">
                <div className="flex items-center justify-between mb-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary"></span>
                    CPU Usage (Millicores)
                  </span>
                  <span className="font-label-sm text-label-sm text-primary font-bold">Not available</span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-sm">
                  <span className="font-metric-xl text-metric-xl text-on-surface">Not available</span>
                </div>
                <div className="w-full h-36 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#004ac6" stopOpacity="0.25"></stop>
                        <stop offset="100%" stopColor="#004ac6" stopOpacity="0.0"></stop>
                      </linearGradient>
                    </defs>
                    <text x="150" y="52" textAnchor="middle" fill="#5b6472" fontSize="10">No telemetry data</text>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-space-xs pt-space-sm mt-space-xs text-center">
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Min</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">—</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Max</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">—</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-primary font-bold">p99</span>
                    <span className="font-code-inline text-code-inline font-bold text-primary">—</span>
                  </div>
                </div>
              </div>

              {/* Memory RSS Graph */}
              <div className="flex flex-col p-space-md rounded-xl bg-surface-container-low shadow-sm">
                <div className="flex items-center justify-between mb-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-secondary"></span>
                    Memory RSS
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary font-bold">Not available</span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-sm">
                  <span className="font-metric-xl text-metric-xl text-on-surface">Not available</span>
                </div>
                <div className="w-full h-36 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="memGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4b41e1" stopOpacity="0.25"></stop>
                        <stop offset="100%" stopColor="#4b41e1" stopOpacity="0.0"></stop>
                      </linearGradient>
                    </defs>
                    <text x="150" y="52" textAnchor="middle" fill="#5b6472" fontSize="10">No telemetry data</text>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-space-xs pt-space-sm mt-space-xs text-center">
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Min</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">—</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Max</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">—</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-secondary font-bold">p99</span>
                    <span className="font-code-inline text-code-inline font-bold text-secondary">—</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pod Fleet Roster Preview */}
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-surface-container-high/40">
            <div className="flex items-center justify-between mb-space-md">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px] text-primary">dns</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Pod Fleet
                </h3>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Node and pod inventory are not available through the backend.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-body-sm text-body-sm">
                <thead className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase">
                  <tr>
                    <th className="py-2.5 px-space-md rounded-l-lg">Pod Identifier</th>
                    <th className="py-2.5 px-space-md">Node IP</th>
                    <th className="py-2.5 px-space-md">Status</th>
                    <th className="py-2.5 px-space-md">Restarts</th>
                    <th className="py-2.5 px-space-md">CPU / Mem</th>
                    <th className="py-2.5 px-space-md rounded-r-lg text-right">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-transparent">
                  <tr>
                    <td colSpan={6} className="py-space-md px-space-md text-center text-on-surface-variant">
                      Pod records are not available from the backend.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: 4 Cols Topology Widget & Deployment Snippet */}
        <div className="xl:col-span-4 flex flex-col gap-space-lg">
          {/* Connected Services Topology Widget */}
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col border border-surface-container-high/40">
            <div className="flex items-center justify-between mb-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-primary">account_tree</span>
                Service Topology
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                Unavailable
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              The backend does not provide service dependency or mesh data.
            </p>
            <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-container-low p-space-md text-center font-body-sm text-body-sm text-on-surface-variant">
              Dependency graph and network policy data are unavailable.
            </div>
          </div>

          {/* Recent Deployment History Snippet */}
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between border border-surface-container-high/40">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[20px] text-secondary">rocket_launch</span>
                  Deploy History
                </h3>
                <Link to="/deployments" className="font-label-sm text-label-sm text-primary hover:underline">
                  View All
                </Link>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                Latest deployment records returned by the backend.
              </p>

              <div className="flex flex-col gap-space-sm">
                {deploymentsState === 'loading' && <p role="status">Loading deployment history…</p>}
                {deploymentsState === 'error' && <p role="alert">Deployment history is unavailable.</p>}
                {deploymentsState === 'success' && deployments.length === 0 && (
                  <p className="text-on-surface-variant">No deployments are recorded for this application.</p>
                )}
                {deployments.map(deployment => (
                  <div key={deployment.id} className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-code-inline text-code-inline font-bold text-on-surface">{deployment.version}</span>
                        <span className="font-code-inline text-code-inline text-on-surface-variant">
                          {deployment.commit_sha ? `#${deployment.commit_sha.slice(0, 7)}` : 'Commit unavailable'}
                        </span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">{deployment.status}</span>
                    </div>
                    <time className="font-label-sm text-label-sm text-on-surface-variant shrink-0 pl-space-xs" dateTime={deployment.created_at}>
                      {new Date(deployment.created_at).toLocaleString()}
                    </time>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-space-lg pt-space-sm bg-surface-container p-space-sm rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[18px]">filter_alt</span>
                <span className="font-label-sm text-label-sm text-on-surface">Pre-filtered Query Ready</span>
              </div>
              <Link to={`/logs?application=${encodeURIComponent(service.id)}`} className="font-label-sm text-label-sm text-primary font-bold hover:underline flex items-center gap-0.5">
                Query Logs <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-surface-container-high/40">
            <div className="flex items-center justify-between mb-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Recent application logs</h3>
              <Link
                to={`/logs?application=${encodeURIComponent(service.id)}`}
                className="font-label-sm text-label-sm text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
              Persisted log records from the backend. Container stdout and stderr are not available.
            </p>
            <div className="space-y-space-xs">
              {logsState === 'loading' && <p role="status">Loading application logs…</p>}
              {logsState === 'error' && <p role="alert">Application logs are unavailable.</p>}
              {logsState === 'success' && applicationLogs.length === 0 && (
                <p className="text-on-surface-variant">No application logs are recorded.</p>
              )}
              {applicationLogs.map(log => (
                <div key={log.id} className="rounded-lg bg-surface-container-low p-space-sm">
                  <div className="flex items-center justify-between gap-space-sm">
                    <span className="font-label-sm text-label-sm font-semibold uppercase">{log.level}</span>
                    <time className="font-label-sm text-label-sm text-on-surface-variant" dateTime={log.created_at}>
                      {new Date(log.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 break-words text-on-surface">{log.message}</p>
                  {log.source && <span className="font-label-sm text-label-sm text-on-surface-variant">Source: {log.source}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Service Telemetry Navigation */}
      <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md border border-surface-container-high/40">
        <div className="flex flex-col">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Cross-Service Telemetry Navigation
          </h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Jump directly into global observability pipelines scoped to this microservice workload
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Link
            to={`/logs?application=${encodeURIComponent(service.id)}`}
            className="flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container hover:text-primary transition-all font-headline-sm text-headline-sm"
          >
            <span className="material-symbols-outlined text-primary text-[18px]">receipt_long</span>
            <span>Scoped Logs (<code>app:{service.id}</code>)</span>
          </Link>
          <Link
            to="/monitoring"
            className="flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container hover:text-primary transition-all font-headline-sm text-headline-sm"
          >
            <span className="material-symbols-outlined text-secondary text-[18px]">analytics</span>
            <span>Monitoring &amp; Alert Rules</span>
          </Link>
          <button
            type="button"
            disabled
            title="Distributed traces are not available through the backend."
            className="flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container-high text-on-surface font-headline-sm text-headline-sm cursor-not-allowed opacity-60"
          >
            <span className="material-symbols-outlined text-tertiary text-[18px]">route</span>
            <span>Distributed Traces</span>
          </button>
        </div>
      </div>
    </div>
  );
};
