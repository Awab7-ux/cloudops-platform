import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../context/ApiContext.tsx';
import { SERVICES_LIST } from '../data/servicesData.ts';

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { health, version } = useApi();
  const [activeTab, setActiveTab] = useState<'overview' | 'env' | 'deployments' | 'pods' | 'metrics'>('overview');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('1h');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Find target service or fallback to auth-service
  const service = SERVICES_LIST.find(s => s.id === id) || SERVICES_LIST[0];
  const isConnected = health.status === 'success';

  return (
    <div className="flex flex-col w-full pb-space-2xl pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Demo Notification Banner */}
      <div className="mb-space-lg flex items-center justify-between px-space-lg py-space-sm rounded-xl bg-surface-container-high text-on-surface shadow-sm border border-surface-container-high/60">
        <div className="flex items-center gap-space-sm min-w-0">
          <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
            info
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            <strong className="font-headline-sm text-headline-sm text-on-surface">
              Simulated Telemetry Mode:
            </strong>{' '}
            Telemetry &amp; resource utilization displayed below are simulated demo values (Demo data).
            Live backend API status reflects connected FastAPI runtime.
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
              ? `FastAPI v${version.data?.version || '1.2.0'} Sync`
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
                  {service.health} (Operational)
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant font-code-inline text-code-inline">
                {service.version}
              </span>
            </div>
            <div className="flex items-center gap-space-xs mt-space-xxs text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[15px] text-tertiary">hub</span>
              <span>Environment:</span>
              <span className="text-on-surface font-semibold">{service.environment}-East</span>
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
            onClick={() => showToast(`Sync initiated: Re-validating ${service.name} cluster ingress manifests [Demo data]`)}
            className="flex items-center gap-space-xs px-3.5 py-2 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-on-primary-fixed-variant shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">sync</span>
            <span>Trigger Sync [Demo]</span>
          </button>
          <button
            type="button"
            onClick={() => showToast(`Rollback simulated: Target candidate set to v2.4.0 for ${service.name} [Demo data]`)}
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-error font-headline-sm text-headline-sm shadow-sm hover:bg-error-container hover:text-on-error-container transition-all active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            <span>Rollback [Demo]</span>
          </button>
          <Link
            to="/logs"
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm shadow-sm hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">terminal</span>
            <span>View Logs</span>
          </Link>
          <button
            type="button"
            onClick={() => showToast('Opening Grafana dashboard metrics')}
            className="flex items-center gap-space-xs px-3 py-2 rounded-xl bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm shadow-sm hover:bg-surface-container-high transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">monitoring</span>
            <span>Open Grafana</span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">open_in_new</span>
          </button>
        </div>
      </div>

      {/* Interactive Tabs Bar */}
      <div className="mt-space-md mb-space-lg flex items-center gap-space-xs bg-surface-container-lowest p-1.5 rounded-xl shadow-sm overflow-x-auto border border-surface-container-high/40">
        {[
          { key: 'overview', label: 'Overview & Health' },
          { key: 'env', label: 'Environment & Config' },
          { key: 'deployments', label: 'Recent Deployments', badge: '3' },
          { key: 'pods', label: 'Pod Fleet', badge: '3/3' },
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

      {/* Metadata & Configuration Bento Grid (All tagged Demo data) */}
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
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-code-inline text-code-inline">gRPC</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-code-inline text-code-inline">HTTP/2</span>
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              <span>TLS v1.3 • Edge Ingress</span>
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
              <span className="font-metric-lg text-metric-lg text-on-surface font-bold">
                {service.replicasReady} / {service.replicasTotal}
              </span>
              <span className="font-label-sm text-label-sm text-primary font-semibold">100% Ready</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 mt-space-sm overflow-hidden flex">
              <div className="bg-primary h-full w-full"></div>
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
              Limit: <span className="font-code-inline text-code-inline text-on-surface">500m / 1GiB</span>
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
                  <span className="px-1.5 py-0.5 rounded bg-surface-container font-label-sm text-label-sm">Demo data</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Real-time CPU and Memory RSS profiling across active container cgroups</p>
              </div>
              <div className="flex items-center gap-space-xs bg-surface-container p-1 rounded-lg">
                {(['1h', '6h', '24h'] as const).map(tr => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    className={`px-2.5 py-1 rounded-md font-label-sm text-label-sm transition-colors cursor-pointer ${
                      timeRange === tr
                        ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>
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
                  <span className="font-label-sm text-label-sm text-primary font-bold">142m avg</span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-sm">
                  <span className="font-metric-xl text-metric-xl text-on-surface">28.4%</span>
                  <span className="font-label-sm text-label-sm text-primary flex items-center">
                    <span className="material-symbols-outlined text-[14px]">arrow_downward</span> -1.8% vs last hr
                  </span>
                </div>
                <div className="w-full h-36 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="cpuGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#004ac6" stopOpacity="0.25"></stop>
                        <stop offset="100%" stopColor="#004ac6" stopOpacity="0.0"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M0,70 Q25,60 50,68 T100,55 T150,45 T200,62 T250,48 T300,50 L300,100 L0,100 Z" fill="url(#cpuGradient)"></path>
                    <path d="M0,70 Q25,60 50,68 T100,55 T150,45 T200,62 T250,48 T300,50" fill="none" stroke="#004ac6" strokeLinecap="round" strokeWidth="2.5"></path>
                    <line stroke="#ba1a1a" strokeDasharray="4" strokeOpacity="0.4" strokeWidth="1.5" x1="0" x2="300" y1="20" y2="20"></line>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-space-xs pt-space-sm mt-space-xs text-center">
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Min</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">118m</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Max</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">310m</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-primary font-bold">p99</span>
                    <span className="font-code-inline text-code-inline font-bold text-primary">245m</span>
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
                  <span className="font-label-sm text-label-sm text-secondary font-bold">512 MiB</span>
                </div>
                <div className="flex items-baseline gap-space-sm mb-space-sm">
                  <span className="font-metric-xl text-metric-xl text-on-surface">50.0%</span>
                  <span className="font-label-sm text-label-sm text-secondary flex items-center">
                    <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +3.1% (cache warmup)
                  </span>
                </div>
                <div className="w-full h-36 relative">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 100">
                    <defs>
                      <linearGradient id="memGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4b41e1" stopOpacity="0.25"></stop>
                        <stop offset="100%" stopColor="#4b41e1" stopOpacity="0.0"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M0,60 Q30,58 70,54 T140,52 T210,48 T260,50 T300,46 L300,100 L0,100 Z" fill="url(#memGradient)"></path>
                    <path d="M0,60 Q30,58 70,54 T140,52 T210,48 T260,50 T300,46" fill="none" stroke="#4b41e1" strokeLinecap="round" strokeWidth="2.5"></path>
                  </svg>
                </div>
                <div className="grid grid-cols-3 gap-space-xs pt-space-sm mt-space-xs text-center">
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Min</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">488 MiB</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-on-surface-variant">Max</span>
                    <span className="font-code-inline text-code-inline font-semibold text-on-surface">542 MiB</span>
                  </div>
                  <div className="flex flex-col bg-surface-container-lowest p-space-xs rounded-lg shadow-sm">
                    <span className="font-label-sm text-label-sm text-secondary font-bold">p99</span>
                    <span className="font-code-inline text-code-inline font-bold text-secondary">538 MiB</span>
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
                  Active Pod Fleet (core-prod-auth)
                </h3>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Node Pool: <code className="font-code-inline text-code-inline text-on-surface">c6i.xlarge-nodes</code>
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
                  {[
                    { id: "auth-service-79b8dc98b4-92jxf", ip: "10.244.3.82", cpuMem: "48m / 168MiB" },
                    { id: "auth-service-79b8dc98b4-xk45v", ip: "10.244.4.119", cpuMem: "51m / 174MiB" },
                    { id: "auth-service-79b8dc98b4-lm20a", ip: "10.244.1.44", cpuMem: "43m / 170MiB" },
                  ].map(pod => (
                    <tr key={pod.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-space-sm px-space-md font-code-inline text-code-inline text-primary font-semibold flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
                        {pod.id}
                      </td>
                      <td className="py-space-sm px-space-md font-code-inline text-code-inline text-on-surface-variant">
                        {pod.ip}
                      </td>
                      <td className="py-space-sm px-space-md">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-primary font-label-sm text-label-sm font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary"></span> Running
                        </span>
                      </td>
                      <td className="py-space-sm px-space-md font-code-inline text-code-inline text-on-surface">0</td>
                      <td className="py-space-sm px-space-md font-code-inline text-code-inline text-on-surface">
                        {pod.cpuMem}
                      </td>
                      <td className="py-space-sm px-space-md font-label-sm text-label-sm text-on-surface-variant text-right">
                        3d 4h
                      </td>
                    </tr>
                  ))}
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
                Mesh: Istio
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              Upstream callers and downstream transactional dependencies (Demo data)
            </p>

            {/* Visual Flow Diagram */}
            <div className="flex flex-col items-center gap-space-sm bg-surface-container-low p-space-md rounded-xl">
              <div className="w-full flex items-center justify-center">
                <div className="w-48 p-space-sm rounded-lg bg-surface-container-lowest shadow-sm text-center border border-surface-container-high/40">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block">
                    Upstream Gateway
                  </span>
                  <span className="font-code-inline text-code-inline font-bold text-on-surface">
                    api-router (Kong)
                  </span>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span> 1.2k req/s • 4.1ms
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center text-primary">
                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
              </div>

              <div className="w-full flex items-center justify-center">
                <div className="w-56 p-space-md rounded-xl bg-primary text-on-primary shadow-md text-center transform scale-105">
                  <span className="font-label-sm text-label-sm text-inverse-primary uppercase block tracking-wider font-semibold">
                    Target Application
                  </span>
                  <span className="font-headline-sm text-headline-sm font-bold block">
                    {service.name}
                  </span>
                  <span className="font-label-sm text-label-sm text-inverse-primary block mt-0.5">
                    JWT Issuer &amp; RBAC Token Engine
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center text-primary">
                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
              </div>

              <div className="grid grid-cols-2 gap-space-xs w-full">
                <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm text-center border border-surface-container-high/40">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block">
                    Cache Store
                  </span>
                  <span className="font-code-inline text-code-inline font-bold text-on-surface">
                    redis-cache
                  </span>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span> 0.4ms lat
                  </div>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm text-center border border-surface-container-high/40">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block">
                    Database
                  </span>
                  <span className="font-code-inline text-code-inline font-bold text-on-surface">
                    postgres-cluster
                  </span>
                  <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary"></span> Primary (rw)
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-space-md pt-space-xs flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
              <span>
                Mutual TLS: <strong className="text-on-surface">Strict (SPIFFE)</strong>
              </span>
              <span className="text-primary flex items-center gap-1 font-semibold">
                <span className="material-symbols-outlined text-[14px]">lock</span> Encrypted
              </span>
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
                Last 3 release events executed in core-prod (Demo data)
              </p>

              <div className="flex flex-col gap-space-sm">
                <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <span className="material-symbols-outlined text-primary text-[20px] shrink-0">check_circle</span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-code-inline text-code-inline font-bold text-on-surface">v2.4.1</span>
                        <span className="font-code-inline text-code-inline text-on-surface-variant">#609d93a</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        feat(jwt): add RS256 token rotation
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-space-xs font-label-sm text-label-sm">
                    <span className="text-on-surface font-semibold">12m ago</span>
                    <span className="text-on-surface-variant">1m 42s</span>
                  </div>
                </div>

                <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <span className="material-symbols-outlined text-primary text-[20px] shrink-0">check_circle</span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-code-inline text-code-inline font-bold text-on-surface">v2.4.0</span>
                        <span className="font-code-inline text-code-inline text-on-surface-variant">#e418a09</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        perf: migrate to FastAPI 0.110
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-space-xs font-label-sm text-label-sm">
                    <span className="text-on-surface font-semibold">3d ago</span>
                    <span className="text-on-surface-variant">2m 04s</span>
                  </div>
                </div>

                <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <span className="material-symbols-outlined text-error text-[20px] shrink-0">cancel</span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-code-inline text-code-inline font-bold text-on-surface">v2.3.9-rc</span>
                        <span className="font-code-inline text-code-inline text-on-surface-variant">#98d0ef1</span>
                      </div>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        fix(rbac): policy schema regression
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-space-xs font-label-sm text-label-sm">
                    <span className="text-error font-semibold">Failed</span>
                    <span className="text-on-surface-variant">48s</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-space-lg pt-space-sm bg-surface-container p-space-sm rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[18px]">filter_alt</span>
                <span className="font-label-sm text-label-sm text-on-surface">Pre-filtered Query Ready</span>
              </div>
              <Link to="/logs" className="font-label-sm text-label-sm text-primary font-bold hover:underline flex items-center gap-0.5">
                Query Logs <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
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
            to="/logs"
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
            onClick={() => showToast(`Tracing spans queried for ${service.id}`)}
            className="flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container hover:text-primary transition-all font-headline-sm text-headline-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-tertiary text-[18px]">route</span>
            <span>Distributed Traces</span>
          </button>
        </div>
      </div>
    </div>
  );
};
