import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVICES_LIST, MicroserviceItem } from '../data/servicesData.ts';

const EDGE_GATEWAY_BG = "https://lh3.googleusercontent.com/aida-public/AB6AXuBjNiJ7tdO2MP1LrjVLO0Fr9DRD5S-8a4wByPCrl5DzUJ-gsfeH5w4eZHHFlEfXzniljwMEHLJ-G2FLjciB55EpMcu18Zlkt878wiA9wM_Z7GxZRu7ZN_ZDoUmA3FZSAcPwP6aCUS2XX18FYGKDJYN03yVEiMk5m7kCSGQx23U_xJ3Et2O4rf42moGXCis8VfjHXG7M7Q2VmexRy10-lcpAkPb9Oi_iaUjk0m2OJRZNoAoBFARcwUUURA";

export const ApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | 'Production' | 'Staging' | 'Dev'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Healthy' | 'Degraded' | 'Initializing'>('all');
  const [viewState, setViewState] = useState<'live' | 'loading' | 'empty'>('live');
  const [page, setPage] = useState(1);
  const rowsPerPage = 6;

  // Selected service for slide-over drawer
  const [selectedService, setSelectedService] = useState<MicroserviceItem | null>(null);

  // Register Service modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPort, setRegPort] = useState('8080');
  const [regEnv, setRegEnv] = useState('Production');
  const [regImage, setRegImage] = useState('ghcr.io/cloudops/service:v1.0.0');

  // Action toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered microservices
  const filteredServices = useMemo(() => {
    return SERVICES_LIST.filter(srv => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        srv.name.toLowerCase().includes(q) ||
        srv.port.includes(q) ||
        srv.namespace.toLowerCase().includes(q) ||
        srv.version.toLowerCase().includes(q);
      const matchesEnv = envFilter === 'all' || srv.environment === envFilter;
      const matchesStatus = statusFilter === 'all' || srv.health === statusFilter;
      return matchesSearch && matchesEnv && matchesStatus;
    });
  }, [searchTerm, envFilter, statusFilter]);

  const totalPages = Math.ceil(filteredServices.length / rowsPerPage) || 1;
  const paginatedServices = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredServices.slice(start, start + rowsPerPage);
  }, [filteredServices, page]);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisterModalOpen(false);
    showToast(`Microservice "${regName || 'new-service'}" registration submitted to cluster controller`);
    setRegName('');
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl pt-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-space-md rounded-xl bg-inverse-surface text-inverse-on-surface shadow-2xl flex items-center gap-2 font-body-sm text-body-sm border border-surface-container-high animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-primary-fixed text-[20px]">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stat Ticker & Operational Context */}
      <div className="w-full mb-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-space-xxs min-w-0">
          <div className="flex items-center gap-space-sm flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
              Application Services
            </h1>
            <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
              14 Services
            </span>
            <div className="flex items-center gap-space-xs px-space-sm py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[13px] text-tertiary">info</span>
              <span>Demonstration dataset — reflects target cloud topology</span>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            Inventory of registered microservices, runtime versions, and operational health status across distributed clusters. (Demo data)
          </p>
        </div>

        {/* Live Telemetry Mini Widget */}
        <div className="flex items-center gap-space-md bg-surface-container-lowest p-space-sm rounded-xl shadow-sm self-start md:self-auto border border-surface-container-high/40">
          <div className="flex items-center gap-space-sm px-space-sm border-r border-surface-container-high">
            <div className="w-2 h-2 rounded-full bg-primary animate-ping"></div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Cluster Ingress
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                99.98% SLA
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm px-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">hub</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Active Pods
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                41 / 42 Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Counter Bento Strip (Demo data) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mb-space-lg">
        {/* Production Online */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Production Online
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">11</span>
            <span className="font-label-sm text-label-sm text-primary">+1 scaled</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full w-[88%] rounded-full"></div>
          </div>
        </div>

        {/* Degraded Nodes */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Degraded Nodes
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-error">warning</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-error">1</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-normal">worker-queue (p99 spike)</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-error h-full w-[8%] rounded-full"></div>
          </div>
        </div>

        {/* Total Workloads */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Total Workloads
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">64.2</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">vCPU allocated</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full w-[54%] rounded-full"></div>
          </div>
        </div>

        {/* Deploy Velocity */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-body-sm text-body-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                Deploy Velocity
              </span>
              <span className="px-1 py-0.2 rounded bg-surface-container font-label-sm text-[9px]">Demo data</span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-tertiary">bolt</span>
          </div>
          <div className="my-space-xs flex items-baseline gap-space-sm">
            <span className="font-metric-xl text-metric-xl text-on-surface">32</span>
            <span className="font-label-sm text-label-sm text-primary">last 24h</span>
          </div>
          <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full w-[72%] rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Operational Filter / Action Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm mb-space-md flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md border border-surface-container-high/40">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-space-sm flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-space-sm top-2 text-[18px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by name, tag, port, namespace..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm pl-9 pr-space-md py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
            />
          </div>

          {/* Environment Filter */}
          <div className="relative">
            <select
              value={envFilter}
              onChange={e => {
                setEnvFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full sm:w-auto appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-space-md pr-8 py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <option value="all">All Environments</option>
              <option value="Production">Production</option>
              <option value="Staging">Staging</option>
              <option value="Dev">Dev</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-[18px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full sm:w-auto appearance-none bg-surface-container-low text-on-surface font-body-sm text-body-sm pl-space-md pr-8 py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <option value="all">All Statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Degraded">Warning / Degraded</option>
              <option value="Initializing">Initializing</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-2 text-[18px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          {/* State Switcher Buttons (Live, Loading, Empty preview) */}
          <div className="flex items-center bg-surface-container-low p-0.5 rounded-lg self-start">
            <button
              onClick={() => setViewState('live')}
              className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer ${
                viewState === 'live'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Live
            </button>
            <button
              onClick={() => setViewState('loading')}
              className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer ${
                viewState === 'loading'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Loading
            </button>
            <button
              onClick={() => setViewState('empty')}
              className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-all cursor-pointer ${
                viewState === 'empty'
                  ? 'bg-surface-container-lowest text-on-surface shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Empty
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-space-sm">
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-space-xs px-space-md py-1.5 bg-primary-container text-on-primary-container font-headline-sm text-body-md rounded-lg shadow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Register Service</span>
          </button>
        </div>
      </div>

      {/* Simulated Loading State Skeleton */}
      {viewState === 'loading' && (
        <div className="bg-surface-container-lowest p-space-xl rounded-xl shadow-sm mb-space-md animate-pulse border border-surface-container-high/40">
          <div className="h-8 bg-surface-container-high rounded w-1/4 mb-space-md"></div>
          <div className="space-y-space-sm">
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
            <div className="h-10 bg-surface-container-low rounded"></div>
          </div>
        </div>
      )}

      {/* Simulated Empty State or Filter Empty State */}
      {(viewState === 'empty' || (viewState === 'live' && filteredServices.length === 0)) && (
        <div className="bg-surface-container-lowest p-space-2xl rounded-xl shadow-sm mb-space-md text-center flex flex-col items-center justify-center border border-surface-container-high/40">
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-space-md">
            <span className="material-symbols-outlined text-[32px]">manage_search</span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xxs">
            No microservices found
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-space-lg">
            No registered pods or containers matched your current filter parameters or cluster context.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setEnvFilter('all');
              setStatusFilter('all');
              setViewState('live');
            }}
            className="px-space-md py-space-xs bg-surface-container-high text-on-surface hover:bg-surface-container rounded-lg font-body-md text-body-md shadow-sm transition-colors cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* Live Data Table Viewport */}
      {viewState === 'live' && filteredServices.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-high/40">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                  <th className="py-space-md px-space-md font-semibold">Service &amp; Port</th>
                  <th className="py-space-md px-space-md font-semibold">Namespace / Env</th>
                  <th className="py-space-md px-space-md font-semibold">Health</th>
                  <th className="py-space-md px-space-md font-semibold">Version Tag</th>
                  <th className="py-space-md px-space-md font-semibold">Replicas</th>
                  <th className="py-space-md px-space-md font-semibold min-w-[140px]">Telemetry (CPU/RAM)</th>
                  <th className="py-space-md px-space-md font-semibold">Last Deployed</th>
                  <th className="py-space-md px-space-md font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-body-sm text-body-sm text-on-surface divide-y divide-surface-container-low">
                {paginatedServices.map(srv => {
                  const isDegraded = srv.health === 'Degraded';
                  const isInit = srv.health === 'Initializing';

                  return (
                    <tr
                      key={srv.id}
                      onClick={() => setSelectedService(srv)}
                      className={`hover:bg-surface-container-low/60 transition-colors group cursor-pointer ${
                        isDegraded ? 'bg-error-container/10' : ''
                      }`}
                    >
                      {/* Service & Port */}
                      <td className="py-space-md px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isDegraded
                                ? 'bg-error-container text-error'
                                : 'bg-surface-container-high text-primary'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {isDegraded ? 'queue' : srv.id === 'payment-gateway' ? 'credit_card' : 'verified_user'}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-headline-sm text-body-md text-on-surface truncate group-hover:text-primary transition-colors">
                              {srv.name}
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface-variant font-code-inline">
                              :{srv.port} ({srv.protocol})
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Namespace / Env */}
                      <td className="py-space-md px-space-md">
                        <div className="flex flex-col">
                          <span className="font-label-md text-label-md text-on-surface font-medium">
                            {srv.namespace}
                          </span>
                          <span
                            className={`font-label-sm text-label-sm uppercase font-bold ${
                              srv.environment === 'Production'
                                ? 'text-primary'
                                : srv.environment === 'Staging'
                                ? 'text-secondary'
                                : 'text-tertiary'
                            }`}
                          >
                            {srv.environment}
                          </span>
                        </div>
                      </td>

                      {/* Health */}
                      <td className="py-space-md px-space-md">
                        {isDegraded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                            {srv.healthDetail || 'Degraded'}
                          </span>
                        ) : isInit ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-outline animate-pulse"></span>
                            Initializing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            Healthy
                          </span>
                        )}
                      </td>

                      {/* Version Tag */}
                      <td className="py-space-md px-space-md">
                        <span className="px-space-xs py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-on-surface font-medium">
                          {srv.version}
                        </span>
                      </td>

                      {/* Replicas */}
                      <td className="py-space-md px-space-md">
                        <div
                          className={`flex items-center gap-space-xs ${
                            isDegraded ? 'text-error font-semibold' : ''
                          }`}
                        >
                          <span className="font-label-md text-label-md font-semibold">
                            {srv.replicasReady} / {srv.replicasTotal}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {srv.replicasStatus}
                          </span>
                        </div>
                      </td>

                      {/* Telemetry (CPU/RAM) */}
                      <td className="py-space-md px-space-md">
                        <div className="flex flex-col gap-1 w-full max-w-[120px]">
                          <div
                            className={`flex justify-between font-label-sm text-label-sm ${
                              isDegraded ? 'text-error font-bold' : ''
                            }`}
                          >
                            <span>{srv.cpu}</span>
                            <span>{srv.memory}</span>
                          </div>
                          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden flex">
                            {isDegraded ? (
                              <div
                                className="bg-error h-full rounded-full"
                                style={{ width: `${srv.cpuPercent}%` }}
                              ></div>
                            ) : (
                              <>
                                <div
                                  className="bg-primary h-full"
                                  style={{ width: `${srv.cpuPercent}%` }}
                                ></div>
                                <div
                                  className="bg-secondary h-full"
                                  style={{ width: `${srv.memoryPercent}%` }}
                                ></div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Last Deployed */}
                      <td className="py-space-md px-space-md">
                        <span className="font-label-sm text-label-sm text-on-surface-variant">
                          {srv.lastDeployed}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-space-md px-space-md text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedService(srv)}
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Inspect details"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              readiness_score
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/applications/${srv.id}`)
                            }
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="Open full page"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              open_in_new
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              showToast(`Live terminal stream opened for ${srv.name}`)
                            }
                            className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                            title="View Live Stream"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              terminal
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination & Meta Bar */}
          <div className="p-space-md bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-surface-container-low">
            <div className="flex items-center gap-space-md font-body-sm text-body-sm text-on-surface-variant">
              <span>
                Showing{' '}
                <strong className="text-on-surface">
                  {(page - 1) * rowsPerPage + 1}-
                  {Math.min(page * rowsPerPage, filteredServices.length)}
                </strong>{' '}
                of <strong className="text-on-surface">{filteredServices.length}</strong> registered
                microservices (Demo data)
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded bg-surface-container-low text-on-surface-variant hover:bg-surface-container disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    page === pageNum
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'hover:bg-surface-container-high text-on-surface'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded bg-surface-container-low text-on-surface hover:bg-surface-container disabled:opacity-40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deep Architecture Insight Visual (Under Table Bento Cards) */}
      <div className="mt-space-lg grid grid-cols-1 lg:grid-cols-3 gap-space-md">
        {/* Visual 1: Cluster Pod Topology Distribution Chart */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Cluster Resource Split
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                42 Pods Total (Demo data)
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              Ingress, Core business logic, and Pipeline distribution.
            </p>

            {/* Donut representation */}
            <div className="flex items-center justify-around py-space-sm">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.8"
                ></path>
                <path
                  className="text-primary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="45, 100"
                  strokeWidth="3.8"
                ></path>
                <path
                  className="text-secondary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="35, 100"
                  strokeDashoffset="-45"
                  strokeWidth="3.8"
                ></path>
                <path
                  className="text-tertiary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="20, 100"
                  strokeDashoffset="-80"
                  strokeWidth="3.8"
                ></path>
              </svg>

              <div className="flex flex-col gap-space-xs font-label-sm text-label-sm">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                  <span>Core (45%)</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span>Ingress (35%)</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
                  <span>Pipeline (20%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-space-sm bg-surface-container-low rounded-lg mt-space-sm flex items-center justify-between">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Host Zone: us-east-1a
            </span>
            <span className="font-label-sm text-label-sm text-primary font-bold">
              Autoscaling Active
            </span>
          </div>
        </div>

        {/* Visual 2: Data Center Node Map */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Cluster Edge Gateway
              </span>
              <span className="material-symbols-outlined text-primary text-[18px]">public</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
              Global ingress distribution point for high-concurrency microservice APIs.
            </p>
            <div
              className="w-full h-36 bg-surface-container rounded-lg bg-cover bg-center overflow-hidden flex items-end p-space-sm shadow-xs border border-surface-container-high/40"
              style={{ backgroundImage: `url('${EDGE_GATEWAY_BG}')` }}
            >
              <div className="bg-surface-container-lowest/90 backdrop-blur-md px-space-sm py-0.5 rounded text-on-surface font-label-sm text-label-sm shadow-sm flex items-center gap-1 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                DC-Primary: Ashburn East (IAD-2)
              </div>
            </div>
          </div>
          <div className="mt-space-sm flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>Latency: 14ms (Direct Connect)</span>
            <span className="text-primary font-medium">BGP Peered</span>
          </div>
        </div>

        {/* Visual 3: Security & Image Provenance */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container-high/40">
          <div>
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Security &amp; Image Provenance
              </span>
              <span className="material-symbols-outlined text-[18px] text-tertiary">shield</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm">
              Cosign signature verification and SBOM vulnerability scans (Demo data).
            </p>
            <div className="space-y-space-xs">
              <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface">auth-service:v2.4.1</span>
                <span className="font-label-sm text-label-sm text-primary font-bold">CVE-0 Clean</span>
              </div>
              <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface">payment-gateway:v1.9.0</span>
                <span className="font-label-sm text-label-sm text-primary font-bold">Signed (Cosign)</span>
              </div>
              <div className="p-space-xs bg-surface-container-low rounded flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-on-surface">worker-queue:v3.0.2-rc1</span>
                <span className="font-label-sm text-label-sm text-error font-bold">1 Moderate Vuln</span>
              </div>
            </div>
          </div>
          <div className="mt-space-sm">
            <button
              onClick={() => showToast('Initiating Trivy image registry rescanning...')}
              className="w-full py-1.5 bg-surface-container-high hover:bg-surface-container text-on-surface font-body-sm text-body-sm rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              Rescan Container Registry
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over Inspection Drawer */}
      {selectedService && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-container-lowest shadow-2xl z-50 flex flex-col border-l border-surface-container-high animate-in slide-in-from-right duration-200">
          <div className="p-space-lg bg-surface-container flex items-center justify-between border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  {selectedService.name}
                </h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-code-inline">
                  UUID: srv-{selectedService.id}-9428
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedService(null)}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div className="p-space-lg flex-1 overflow-y-auto space-y-space-lg font-body-sm text-body-sm">
            {/* Metadata */}
            <div className="space-y-space-xs">
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold">
                Service Metadata
              </h4>
              <div className="bg-surface-container-low p-space-sm rounded-lg grid grid-cols-2 gap-space-sm font-label-sm text-label-sm">
                <div>
                  <span className="text-on-surface-variant block">Ingress Protocol</span>
                  <span className="text-on-surface font-medium">{selectedService.protocol}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Auto-Scale Bounds</span>
                  <span className="text-on-surface font-medium">
                    Min: {selectedService.minScale} / Max: {selectedService.maxScale}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Service Mesh Port</span>
                  <span className="text-on-surface font-code-inline">{selectedService.port}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block">Graceful Termination</span>
                  <span className="text-on-surface font-medium">{selectedService.gracePeriod}</span>
                </div>
              </div>
            </div>

            {/* Endpoints */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Exposed Endpoints
              </h4>
              <div className="space-y-space-xs font-code-inline font-label-sm text-label-sm">
                {selectedService.endpoints.map((ep, i) => (
                  <div
                    key={i}
                    className="p-space-xs bg-surface-container-low rounded flex items-center justify-between"
                  >
                    <span className="text-on-surface">
                      {ep.method} {ep.path}
                    </span>
                    <span className="text-primary font-bold">{ep.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dependency Graph */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Dependency Mesh Graph
              </h4>
              <div className="p-space-md bg-surface-container-low rounded-lg flex flex-col items-center gap-space-sm">
                <div className="px-space-md py-1 bg-surface-container-lowest rounded shadow-xs font-label-sm text-label-sm text-on-surface-variant border border-surface-container">
                  {selectedService.dependencies.upstream}
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  arrow_downward
                </span>
                <div className="px-space-md py-1.5 bg-primary text-on-primary rounded shadow-sm font-label-sm text-label-sm font-semibold">
                  {selectedService.name} (Active Instance)
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                  arrow_downward
                </span>
                <div className="grid grid-cols-2 gap-space-sm w-full">
                  {selectedService.dependencies.downstream.map((down, idx) => (
                    <div
                      key={idx}
                      className="p-space-xs bg-surface-container-lowest rounded text-center font-label-sm text-label-sm text-on-surface border border-surface-container-high/40 truncate"
                    >
                      {down}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Logs preview */}
            <div>
              <h4 className="font-headline-sm text-body-md text-on-surface font-semibold mb-space-xs">
                Real-Time Standard Out
              </h4>
              <div className="bg-inverse-surface text-inverse-on-surface p-space-sm rounded font-label-sm text-label-sm overflow-x-auto space-y-1">
                {selectedService.sampleLogs.map((log, i) => (
                  <p key={i}>
                    <span className="text-primary-fixed">{log.time}</span> [{log.level}] {log.msg}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="p-space-md bg-surface-container flex items-center justify-between gap-space-sm border-t border-surface-container-high">
            <button
              onClick={() => showToast(`Exported OpenTelemetry bundle for ${selectedService.name}`)}
              className="px-space-sm py-1.5 bg-surface-container-high text-on-surface rounded font-body-sm text-body-sm hover:bg-surface-container-lowest transition-colors cursor-pointer"
            >
              Export Diagnostics
            </button>
            <button
              onClick={() => navigate(`/applications/${selectedService.id}`)}
              className="px-space-md py-1.5 bg-primary-container text-on-primary-container rounded font-body-sm text-body-sm font-medium hover:brightness-110 transition-colors cursor-pointer"
            >
              Open Dedicated View
            </button>
          </div>
        </div>
      )}

      {/* Registration Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs z-50 flex items-center justify-center p-space-md animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-space-lg shadow-2xl border border-surface-container-high">
            <div className="flex items-center justify-between mb-space-md">
              <h3 className="font-headline-md text-headline-md text-on-surface">
                Register New Microservice
              </h3>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="space-y-space-md font-body-sm text-body-sm">
              <div>
                <label className="block text-on-surface font-medium mb-1">Service Identifier</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g., checkout-worker"
                  className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg focus:outline-none focus:bg-surface-container-lowest border border-surface-container-high"
                />
              </div>
              <div className="grid grid-cols-2 gap-space-sm">
                <div>
                  <label className="block text-on-surface font-medium mb-1">Target Cluster Env</label>
                  <select
                    value={regEnv}
                    onChange={e => setRegEnv(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg focus:outline-none border border-surface-container-high"
                  >
                    <option value="Production">Production (AWS EKS)</option>
                    <option value="Staging">Staging (GCP GKE)</option>
                    <option value="Dev">Dev-Local (Kind)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-on-surface font-medium mb-1">Container Port</label>
                  <input
                    type="number"
                    required
                    value={regPort}
                    onChange={e => setRegPort(e.target.value)}
                    placeholder="8080"
                    className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg focus:outline-none border border-surface-container-high"
                  />
                </div>
              </div>
              <div>
                <label className="block text-on-surface font-medium mb-1">Docker Image Registry URL</label>
                <input
                  type="text"
                  required
                  value={regImage}
                  onChange={e => setRegImage(e.target.value)}
                  placeholder="ghcr.io/cloudops/service:v1.0.0"
                  className="w-full bg-surface-container-low text-on-surface px-space-sm py-1.5 rounded-lg focus:outline-none border border-surface-container-high"
                />
              </div>
              <div className="pt-space-sm flex justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-space-md py-1.5 bg-surface-container text-on-surface rounded-lg cursor-pointer hover:bg-surface-container-high"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-md py-1.5 bg-primary text-on-primary rounded-lg font-medium shadow-sm hover:brightness-110 cursor-pointer"
                >
                  Register Container
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
