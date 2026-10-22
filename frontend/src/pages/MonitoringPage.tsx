import React, { useState } from 'react';
import {
  monitoringSummaryMetrics,
  serviceStatuses,
  latencyTimelineData,
  httpStatusCodeDistribution,
  probeConfigurations,
} from '../data/monitoringData';
import { useApi } from '../context/ApiContext';

export const MonitoringPage: React.FC = () => {
  const { health, version, isChecking, refreshProbes } = useApi();
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h');
  const [filterNamespace, setFilterNamespace] = useState<string>('all');
  const [searchService, setSearchService] = useState<string>('');

  const filteredServices = serviceStatuses.filter((s) => {
    const matchesNs = filterNamespace === 'all' || s.namespace === filterNamespace;
    const matchesSearch = s.service.toLowerCase().includes(searchService.toLowerCase());
    return matchesNs && matchesSearch;
  });

  // Calculate SVG points for p99 latency curve
  const svgWidth = 700;
  const svgHeight = 160;
  const maxLatency = Math.max(...latencyTimelineData.map((d) => d.p99), 100);
  
  const p99Points = latencyTimelineData
    .map((d, i) => {
      const x = (i / (latencyTimelineData.length - 1)) * svgWidth;
      const y = svgHeight - (d.p99 / maxLatency) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  const p50Points = latencyTimelineData
    .map((d, i) => {
      const x = (i / (latencyTimelineData.length - 1)) * svgWidth;
      const y = svgHeight - (d.p50 / maxLatency) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">System Monitoring &amp; Telemetry</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Demo data
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Golden signals (latency, traffic, errors, saturation), Apdex scores, and synthetic probe health across all microservices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range picker */}
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-xs">
            {(['1h', '6h', '24h', '7d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={refreshProbes}
            disabled={isChecking}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span className={`material-symbols-outlined text-[18px] ${isChecking ? 'animate-spin' : ''}`}>
              sync
            </span>
            Refresh Probes
          </button>
        </div>
      </div>

      {/* Real Live API Probe Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              health.status === 'success'
                ? 'bg-emerald-400 ring-4 ring-emerald-400/20'
                : health.status === 'error'
                ? 'bg-red-400 ring-4 ring-red-400/20'
                : 'bg-amber-400 ring-4 ring-amber-400/20 animate-pulse'
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Real Backend Probe</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 font-mono">
                GET /health &bull; GET /version
              </span>
            </div>
            <div className="text-sm font-medium mt-0.5">
              API Status: <span className="capitalize font-semibold">{health.status}</span>
              {health.responseTimeMs !== undefined && (
                <span className="text-xs text-slate-400 font-mono ml-2">({health.responseTimeMs} ms RTT)</span>
              )}
              {version.data && (
                <span className="text-xs text-slate-400 font-mono ml-2">| v{version.data.version}</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono flex items-center gap-4">
          <span>Target: {health.url}</span>
          <span className="text-[11px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
            Real Live HTTP Probe
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {monitoringSummaryMetrics.map((metric) => (
          <div key={metric.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{metric.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">Demo data</span>
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{metric.value}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <span className="material-symbols-outlined text-[20px]">{metric.icon}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">{metric.period}</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                {metric.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Latency Percentile Chart & Status Code Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Percentiles (p50 / p95 / p99) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Cluster Latency Distribution (ms)</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">p50 median vs p99 tail latency across HTTP/gRPC ingress</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                <span className="w-2.5 h-0.5 bg-indigo-600 rounded-full"></span>
                p99 Tail
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="w-2.5 h-0.5 bg-slate-400 rounded-full"></span>
                p50 Median
              </span>
            </div>
          </div>

          {/* SVG Timeline Chart */}
          <div className="relative pt-2">
            <svg
              className="w-full h-44 overflow-visible"
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid guide lines */}
              <line x1="0" y1={svgHeight * 0.25} x2={svgWidth} y2={svgHeight * 0.25} stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1={svgHeight * 0.5} x2={svgWidth} y2={svgHeight * 0.5} stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1={svgHeight * 0.75} x2={svgWidth} y2={svgHeight * 0.75} stroke="#f1f5f9" strokeDasharray="3 3" />

              {/* p99 Line */}
              <polyline
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={p99Points}
              />

              {/* p50 Line */}
              <polyline
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="4 2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={p50Points}
              />
            </svg>

            {/* Time labels */}
            <div className="flex justify-between text-[11px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-100">
              {latencyTimelineData.map((d) => (
                <span key={d.time}>{d.time}</span>
              ))}
            </div>
          </div>
        </div>

        {/* HTTP Status Code Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">HTTP Status Distribution</h2>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Response code breakdown (last 24h)</p>
              </div>
            </div>

            {/* Progress Bar Stack */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex mb-6">
              <div style={{ width: `${httpStatusCodeDistribution['2xx']}%` }} className="bg-emerald-500 h-full" title="2xx Success" />
              <div style={{ width: `${httpStatusCodeDistribution['3xx']}%` }} className="bg-blue-400 h-full" title="3xx Redirect" />
              <div style={{ width: `${httpStatusCodeDistribution['4xx']}%` }} className="bg-amber-400 h-full" title="4xx Client Error" />
              <div style={{ width: `${httpStatusCodeDistribution['5xx']}%` }} className="bg-rose-500 h-full" title="5xx Server Error" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  2xx Successful
                </span>
                <span className="font-mono font-bold text-emerald-700">{httpStatusCodeDistribution['2xx']}%</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 border border-blue-100">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
                  3xx Redirects
                </span>
                <span className="font-mono font-bold text-blue-700">{httpStatusCodeDistribution['3xx']}%</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  4xx Client Errors
                </span>
                <span className="font-mono font-bold text-amber-700">{httpStatusCodeDistribution['4xx']}%</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/50 border border-rose-100">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  5xx Server Errors
                </span>
                <span className="font-mono font-bold text-rose-700">{httpStatusCodeDistribution['5xx']}%</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>SLO Target: &gt;99.9% 2xx/3xx</span>
            <span className="text-emerald-600 font-semibold">99.94% Compliant</span>
          </div>
        </div>
      </div>

      {/* Service Golden Signals Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Microservice Telemetry &amp; Apdex Health</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Application Performance Index (&gt;0.90 is satisfying user experience)</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search service..."
              value={searchService}
              onChange={(e) => setSearchService(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <select
              value={filterNamespace}
              onChange={(e) => setFilterNamespace(e.target.value)}
              aria-label="Monitoring Namespace Filter"
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Namespaces</option>
              <option value="core">core</option>
              <option value="checkout">checkout</option>
              <option value="auth">auth</option>
              <option value="analytics">analytics</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Microservice</th>
                <th className="px-4 py-3">Namespace</th>
                <th className="px-4 py-3">Apdex Score</th>
                <th className="px-4 py-3">p50 Latency</th>
                <th className="px-4 py-3">p95 Latency</th>
                <th className="px-4 py-3">p99 Latency</th>
                <th className="px-4 py-3">Error Rate</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredServices.map((svc) => (
                <tr key={svc.service} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-semibold text-slate-900">{svc.service}</td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                      {svc.namespace}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            svc.apdex >= 0.95
                              ? 'bg-emerald-500'
                              : svc.apdex >= 0.9
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${svc.apdex * 100}%` }}
                        ></div>
                      </div>
                      <span className="font-mono font-medium text-slate-900">{svc.apdex.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">{svc.p50} ms</td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">{svc.p95} ms</td>
                  <td className="px-4 py-3.5 font-mono font-medium text-slate-900">{svc.p99} ms</td>
                  <td className="px-4 py-3.5 font-mono">
                    <span className={svc.errorRate > 0.05 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                      {svc.errorRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                        svc.status === 'Optimal'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          svc.status === 'Optimal' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      ></span>
                      {svc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Synthetic Probes Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Synthetic Edge Ingress Probes</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Demo data</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Global edge pingers checking TLS handshakes and DNS latency every 30 seconds</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {probeConfigurations.map((probe) => (
            <div key={probe.name} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800">{probe.location}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mb-2">{probe.name}</div>
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-400">Target</span>
                <span className="font-mono text-slate-700 font-medium">{probe.target}</span>
              </div>
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-slate-400">Freq</span>
                <span className="font-mono text-slate-600">{probe.frequency}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
