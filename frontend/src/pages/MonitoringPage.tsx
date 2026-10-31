import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getMetrics } from '../api/metrics';
import type { MetricSample, MetricsSnapshot } from '../api/metrics';
import { useApi } from '../context/ApiContext';

type LoadState = 'loading' | 'success' | 'error';

function sumMetric(
  samples: MetricSample[],
  name: string,
  predicate: (sample: MetricSample) => boolean = () => true,
): number {
  return samples
    .filter(sample => sample.name === name && predicate(sample) && Number.isFinite(sample.value))
    .reduce((total, sample) => total + sample.value, 0);
}

function metricValue(samples: MetricSample[], name: string): number | undefined {
  return samples.find(sample => sample.name === name && Object.keys(sample.labels).length === 0)?.value;
}

function valueLabel(value: number | undefined, state: LoadState): string {
  if (state === 'loading') return 'Loading…';
  if (state === 'error' || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  return new Intl.NumberFormat().format(value);
}

export const MonitoringPage: React.FC = () => {
  const { health, version, isProbing, refreshProbes, baseUrl } = useApi();
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [metricsState, setMetricsState] = useState<LoadState>('loading');
  const [metricsError, setMetricsError] = useState('');
  const [refresh, setRefresh] = useState(0);

  const loadMetrics = useCallback(async () => {
    setMetricsState('loading');
    setMetricsError('');
    try {
      setSnapshot(await getMetrics());
      setMetricsState('success');
    } catch (error: unknown) {
      setSnapshot(null);
      setMetricsError(error instanceof Error ? error.message : 'Unable to load backend metrics.');
      setMetricsState('error');
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics, refresh]);

  const samples = snapshot?.samples ?? [];
  const applicationsTotal = metricValue(samples, 'cloudops_applications_total');
  const deploymentsTotal = metricValue(samples, 'cloudops_deployments_total');
  const logsTotal = metricValue(samples, 'cloudops_logs_total');
  const activeAlerts = samples.filter(sample => sample.name === 'cloudops_active_alerts' && sample.value > 0);
  const activeAlertCount = activeAlerts.reduce((total, sample) => total + sample.value, 0);
  const requestCount = sumMetric(samples, 'cloudops_http_requests_total');
  const serverErrorCount = sumMetric(
    samples,
    'cloudops_http_requests_total',
    sample => (sample.labels.status_code ?? '').startsWith('5'),
  );
  const latencyCount = sumMetric(samples, 'cloudops_http_request_duration_seconds_count');
  const latencySum = sumMetric(samples, 'cloudops_http_request_duration_seconds_sum');
  const averageLatencyMs = latencyCount > 0 ? (latencySum / latencyCount) * 1000 : undefined;
  const applicationStatuses = useMemo(
    () => samples.filter(sample => sample.name === 'cloudops_applications_by_status'),
    [samples],
  );

  const summaryCards = [
    { label: 'Applications', value: valueLabel(applicationsTotal, metricsState), icon: 'apps' },
    { label: 'Deployments', value: valueLabel(deploymentsTotal, metricsState), icon: 'rocket_launch' },
    { label: 'Persisted logs', value: valueLabel(logsTotal, metricsState), icon: 'receipt_long' },
    { label: 'Current alerts', value: valueLabel(activeAlerts.length ? activeAlertCount : metricsState === 'success' ? 0 : undefined, metricsState), icon: 'warning' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">System Monitoring &amp; Telemetry</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {metricsState === 'success' ? 'Live API metrics' : metricsState === 'loading' ? 'Loading…' : 'Unavailable'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Metrics come from the backend Prometheus endpoint. Node and pod metrics are not exposed to the frontend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefresh(value => value + 1)}
            disabled={metricsState === 'loading'}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${metricsState === 'loading' ? 'animate-spin' : ''}`}>sync</span>
            Refresh Metrics
          </button>
          <button
            type="button"
            onClick={() => void refreshProbes()}
            disabled={isProbing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
          >
            Refresh Probes
          </button>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Backend probe</div>
          <div className="text-sm font-medium mt-0.5">
            API status: <span className="capitalize">{health.status}</span>
            {health.rttMs !== undefined && <span className="ml-2 text-xs text-slate-400 font-mono">({health.rttMs} ms)</span>}
            {version.data?.version && <span className="ml-2 text-xs text-slate-400 font-mono">v{version.data.version}</span>}
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">Target: {baseUrl}</span>
      </div>

      {metricsState === 'error' && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{metricsError}</p>
          <button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-2 underline">Retry metrics</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{card.label}</span>
              <span className="material-symbols-outlined text-indigo-600">{card.icon}</span>
            </div>
            <div className="mt-3 text-2xl font-bold text-slate-900 tracking-tight">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Backend request metrics</h2>
          <p className="text-xs text-slate-500 mt-1">Counters are cumulative since the API process started.</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-500">Requests recorded</dt><dd className="mt-1 font-semibold text-slate-900">{valueLabel(requestCount, metricsState)}</dd></div>
            <div><dt className="text-slate-500">HTTP 5xx responses</dt><dd className="mt-1 font-semibold text-slate-900">{valueLabel(serverErrorCount, metricsState)}</dd></div>
            <div><dt className="text-slate-500">Average response time</dt><dd className="mt-1 font-semibold text-slate-900">{averageLatencyMs === undefined || metricsState !== 'success' ? 'Unavailable' : `${averageLatencyMs.toFixed(1)} ms`}</dd></div>
            <div><dt className="text-slate-500">Errors in the last 24h</dt><dd className="mt-1 font-semibold text-slate-900">{valueLabel(metricValue(samples, 'cloudops_log_errors_last_24h'), metricsState)}</dd></div>
          </dl>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Application status counts</h2>
          <p className="text-xs text-slate-500 mt-1">Current database records grouped by application status.</p>
          <div className="mt-4 space-y-2">
            {metricsState === 'success' && applicationStatuses.length === 0 && (
              <p className="text-sm text-slate-500">No application status metrics were returned.</p>
            )}
            {applicationStatuses.map(sample => (
              <div key={sample.labels.status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="capitalize text-slate-600">{sample.labels.status}</span>
                <span className="font-semibold text-slate-900">{sample.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Current backend-derived alerts</h2>
          <p className="text-xs text-slate-500 mt-1">These counts use the same rules as the alerts API.</p>
          <div className="mt-4 space-y-2">
            {metricsState === 'success' && activeAlerts.length === 0 && <p className="text-sm text-slate-500">No current backend-derived alerts.</p>}
            {activeAlerts.map(sample => (
              <div key={sample.labels.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-mono text-slate-700">{sample.labels.type}</span>
                <span className="font-semibold text-slate-900">{sample.value}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h2 className="text-base font-semibold text-slate-900">Cluster target visibility</h2>
          <p className="mt-2 text-sm text-slate-600">
            Prometheus scrape target health, kube-state-metrics, pod status, and Grafana datasource state are not exposed through the browser API.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            View the in-cluster Prometheus and Grafana services after port-forwarding them from Kubernetes.
          </p>
          <time className="mt-4 block text-xs text-slate-400">Last backend scrape: {snapshot?.scrapedAt ? new Date(snapshot.scrapedAt).toLocaleString() : 'Unavailable'}</time>
        </section>
      </div>
    </div>
  );
};