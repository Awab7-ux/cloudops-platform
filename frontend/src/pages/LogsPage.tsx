import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { listApplications } from '../api/applications';
import { listLogs } from '../api/logs';
import type { Application, LogLevel, LogRecord } from '../api/types';

const LOG_PAGE_SIZE = 50;

function apiLevel(level: string): LogLevel | undefined {
  if (level === 'ALL') return undefined;
  return level === 'WARN' ? 'warning' : level.toLowerCase() as LogLevel;
}

function displayLevel(level: LogLevel): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' {
  if (level === 'warning') return 'WARN';
  return level.toUpperCase() as 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
}

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [applicationsError, setApplicationsError] = useState('');
  const [applicationsRefresh, setApplicationsRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>(
    () => new URLSearchParams(window.location.search).get('application') ?? 'ALL',
  );
  const [selectedDeployment] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('deployment'),
  );
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const logViewportRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const loadSequence = useRef(0);
  const autoScrollRef = useRef(autoScroll);
  const atLatestRef = useRef(true);
  const latestLogIdRef = useRef<string | null>(null);

  const requestOptions = useMemo(() => {
    const level = apiLevel(selectedLevel);
    return {
      limit: LOG_PAGE_SIZE,
      offset: 0,
      ...(level ? { level } : {}),
      ...(selectedService === 'ALL' ? {} : { application_id: selectedService }),
      ...(selectedDeployment ? { deployment_id: selectedDeployment } : {}),
    };
  }, [selectedDeployment, selectedLevel, selectedService]);
  const requestOptionsKey = JSON.stringify(requestOptions);
  const previousRequestOptionsKey = useRef(requestOptionsKey);

  useEffect(() => {
    let active = true;
    setApplicationsLoading(true);
    setApplicationsError('');
    void listApplications({ limit: 200, offset: 0 })
      .then(result => {
        if (active) setApplications(result.items);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setApplications([]);
        setApplicationsError(caught instanceof Error ? caught.message : 'Unable to load applications.');
      })
      .finally(() => {
        if (active) setApplicationsLoading(false);
      });
    return () => { active = false; };
  }, [applicationsRefresh]);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  // The backend returns newest logs first, so the latest entry is at the top of this viewport.
  useLayoutEffect(() => {
    const viewport = logViewportRef.current;
    if (!viewport) return;
    if (previousRequestOptionsKey.current !== requestOptionsKey) {
      previousRequestOptionsKey.current = requestOptionsKey;
      latestLogIdRef.current = null;
      loadSequence.current += 1;
      return;
    }
    if (loading) return;

    const latestLogId = logs[0]?.id ?? null;
    const previousLatestLogId = latestLogIdRef.current;
    if (
      previousLatestLogId !== null
      && latestLogId !== null
      && previousLatestLogId !== latestLogId
      && autoScrollRef.current
      && atLatestRef.current
    ) {
      viewport.scrollTop = 0;
    }
    latestLogIdRef.current = latestLogId;
  }, [logs, loading, requestOptionsKey]);

  const loadLogs = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await listLogs(requestOptions);
      if (sequence !== loadSequence.current) return;
      setLogs(result.items);
      setTotal(result.total);
    } catch (caught: unknown) {
      if (sequence !== loadSequence.current) return;
      setLogs([]);
      setTotal(0);
      setError(caught instanceof Error ? caught.message : 'Unable to load logs.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [requestOptions]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs, refresh]);

  useEffect(() => {
    if (!isLive) return undefined;
    const interval = setInterval(() => setRefresh(value => value + 1), 15_000);
    return () => clearInterval(interval);
  }, [isLive]);

  const loadMoreLogs = async () => {
    if (loading || loadingMoreRef.current || logs.length >= total) return;
    const sequence = loadSequence.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await listLogs({ ...requestOptions, offset: logs.length });
      if (sequence !== loadSequence.current) return;
      setLogs(current => [...current, ...result.items]);
      setTotal(result.total);
    } catch (caught: unknown) {
      if (sequence !== loadSequence.current) return;
      setError(caught instanceof Error ? caught.message : 'Unable to load more logs.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const application = applications.find(item => item.id === log.application_id);
    const query = searchQuery.trim().toLowerCase();
    return [log.message, log.source, application?.name, log.application_id, log.deployment_id]
      .some(value => value?.toLowerCase().includes(query) ?? false);
  });

  const logLevelCounts = useMemo(() => ({
    error: logs.filter(log => log.level === 'error').length,
    warning: logs.filter(log => log.level === 'warning').length,
    info: logs.filter(log => log.level === 'info').length,
    debug: logs.filter(log => log.level === 'debug').length,
  }), [logs]);
  const maxLevelCount = Math.max(
    1,
    logLevelCounts.error,
    logLevelCounts.warning,
    logLevelCounts.info,
    logLevelCounts.debug,
  );

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `cloudops-logs-${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const handleLogScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    atLatestRef.current = element.scrollTop <= 24;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 24) {
      void loadMoreLogs();
    }
  };

  const pageError = error || applicationsError;
  const pageLoading = loading || applicationsLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Structured Log Stream</h1>
            <span title={pageError || undefined} className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {pageError ? 'Unavailable' : pageLoading ? 'Loading…' : 'Live API'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Application and deployment log records returned by the CloudOps API.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume API polling */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shadow-xs ${
              isLive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
            ></span>
            {isLive ? 'Auto Refresh On' : 'Auto Refresh Paused'}
          </button>

          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export JSON
          </button>
        </div>
      </div>

      {/* Distribution of returned log records */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Log levels in the loaded page
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-rose-600 font-medium">
              <span className="w-2 h-2 bg-rose-500 rounded-xs"></span> Errors
            </span>
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="w-2 h-2 bg-amber-400 rounded-xs"></span> Warn
            </span>
            <span className="flex items-center gap-1 text-indigo-600 font-medium">
              <span className="w-2 h-2 bg-indigo-500 rounded-xs"></span> Info/Debug
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {([
            ['ERROR', logLevelCounts.error, 'bg-rose-500'],
            ['WARN', logLevelCounts.warning, 'bg-amber-400'],
            ['INFO', logLevelCounts.info, 'bg-indigo-500'],
            ['DEBUG', logLevelCounts.debug, 'bg-slate-500'],
          ] as const).map(([level, count, color]) => (
            <div key={level} className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{level}</span>
                <span>{count}</span>
              </div>
              <div className="h-2 rounded bg-slate-100 overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${(count / maxLevelCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-slate-400">Counts cover the records currently loaded from the backend, not the full log history.</p>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder='Search logs by message, application, or source (e.g. "timeout", "payments")...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
            />
          </div>

          {/* Service Selector */}
          <div className="w-full md:w-auto">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              aria-label="Filter logs by application"
              className="w-full md:w-48 px-3 py-2 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Applications</option>
              {applications.map((application) => (
                <option key={application.id} value={application.id}>
                  {application.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Severity level chips and toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium mr-1">Severity:</span>
            {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map((level) => (
              <button
                key={level}
                onClick={() => setSelectedLevel(level)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                  selectedLevel === level
                    ? level === 'ERROR'
                      ? 'bg-rose-600 text-white'
                      : level === 'WARN'
                      ? 'bg-amber-500 text-white'
                      : level === 'INFO'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wrapLines}
                onChange={(e) => setWrapLines(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Soft Wrap</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => {
                  autoScrollRef.current = e.target.checked;
                  setAutoScroll(e.target.checked);
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Auto Tail</span>
            </label>
            <span className="font-mono text-slate-400">
              Showing {filteredLogs.length} of {total} events
            </span>
          </div>
        </div>
      </div>

      {/* Terminal / Log Viewer Stream */}
      <div className="bg-slate-950 text-slate-200 rounded-xl border border-slate-800 shadow-md overflow-hidden font-mono text-xs">
        {/* Terminal Header */}
        <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="ml-2 font-semibold text-slate-300">Backend log records</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">{pageError ? 'Unavailable' : pageLoading ? 'Loading…' : 'Live API'}</span>
          </div>
        </div>

        {/* Log Entries */}
        <div ref={logViewportRef} className="max-h-[600px] overflow-y-auto divide-y divide-slate-900/60 p-2" onScroll={handleLogScroll}>
          {loading && (
            <div role="status" className="py-12 text-center text-slate-400">Loading logs…</div>
          )}
          {pageError && (
            <div role="alert" className="py-12 text-center text-rose-300">
              <p>{pageError}</p>
              <button
                type="button"
                onClick={() => {
                  if (error) setRefresh(value => value + 1);
                  if (applicationsError) setApplicationsRefresh(value => value + 1);
                }}
                className="mt-3 underline"
              >Retry</button>
            </div>
          )}
          {!loading && !error && filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              {total === 0 ? 'No log entries are available.' : 'No log entries match filter criteria.'}
            </div>
          ) : !loading && !error ? (
            filteredLogs.map(log => {
              const level = displayLevel(log.level);
              const application = applications.find(item => item.id === log.application_id);
              const service = log.source ?? application?.name ?? log.application_id;
              const isExpanded = expandedLogId === log.id;
              return (
                <div
                  key={log.id}
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    isExpanded ? 'bg-slate-900' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0 select-none text-[11px]">{new Date(log.created_at).toLocaleString()}</span>

                    {/* Level Badge */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                        level === 'ERROR'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : level === 'WARN'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : level === 'INFO'
                          ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {level}
                    </span>

                    {/* Service */}
                    <span className="text-indigo-400 font-semibold shrink-0 select-none">
                      [{service}]
                    </span>

                    {/* Message */}
                    <span
                      className={`flex-1 text-slate-300 ${
                        wrapLines ? 'break-words' : 'truncate'
                      } ${level === 'ERROR' ? 'text-rose-200' : ''}`}
                    >
                      {log.message}
                    </span>

                    {/* Expand icon */}
                    <span className="material-symbols-outlined text-slate-500 text-[16px] shrink-0">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 pl-4 space-y-2 text-[11px] text-slate-400">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-slate-500">Application ID:</span>{' '}
                          <span className="text-indigo-300 font-mono select-all">{log.application_id}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Deployment ID:</span>{' '}
                          <span className="text-indigo-300 font-mono select-all">{log.deployment_id ?? '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Source:</span>{' '}
                          <span className="text-indigo-300 font-mono select-all">{log.source ?? '-'}</span>
                        </div>
                      </div>
                      <p>Trace IDs, attributes, stack traces, and container output are not provided by the logs API.</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : null}
          {loadingMore && <div role="status" className="py-3 text-center text-slate-400">Loading more logs…</div>}
        </div>
      </div>
    </div>
  );
};
