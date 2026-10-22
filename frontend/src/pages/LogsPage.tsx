import React, { useState, useEffect } from 'react';
import { logStreamEvents, logHistogramData, logFilterOptions, LogEvent } from '../data/logsData';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEvent[]>(logStreamEvents);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [wrapLines, setWrapLines] = useState<boolean>(true);

  // Simulated live log tail generator
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const sampleMessages = [
        {
          level: 'INFO' as const,
          service: 'auth-service',
          message: 'OAuth2 token refreshed successfully for client session',
          attributes: { statusCode: 200, durationMs: 14 },
        },
        {
          level: 'DEBUG' as const,
          service: 'api-gateway',
          message: 'Forwarding request to internal cluster upstream proxy',
          attributes: { clientIp: '198.51.100.44', protocol: 'HTTP/2' },
        },
        {
          level: 'INFO' as const,
          service: 'payment-gateway',
          message: 'Stripe webhook received event charge.succeeded',
          attributes: { webhookId: 'evt_sim_9918', durationMs: 88 },
        },
      ];

      const chosen = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
      const now = new Date();
      const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;

      const newLog: LogEvent = {
        id: `log-live-${Date.now()}`,
        timestamp: timeStr,
        level: chosen.level,
        service: chosen.service,
        message: chosen.message,
        traceId: `tr-${Math.random().toString(36).substring(2, 10)}`,
        spanId: `sp-${Math.random().toString(36).substring(2, 6)}`,
        attributes: chosen.attributes,
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    }, 4000);

    return () => clearInterval(interval);
  }, [isLive]);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLevel === 'ALL' || log.level === selectedLevel;
    const matchesService = selectedService === 'ALL' || log.service === selectedService;
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.traceId && log.traceId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLevel && matchesService && matchesSearch;
  });

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `cloudops-logs-${Date.now()}.json`);
    dlAnchorElem.click();
  };

  const maxHistogram = Math.max(...logHistogramData.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Structured Log Stream</h1>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Demo data
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centralized FluentBit &amp; OpenTelemetry event pipeline across production Kubernetes namespaces.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause / Resume Live tail */}
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
            {isLive ? 'Live Streaming' : 'Stream Paused'}
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

      {/* Log Frequency Rate Histogram */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Event Ingestion Rate (Lines/sec)
            </span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">Demo data</span>
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

        {/* Stacked Bars */}
        <div className="flex items-end gap-2 h-20 pt-2 border-b border-slate-100">
          {logHistogramData.map((d) => {
            const heightPercent = (d.total / maxHistogram) * 100;
            const errorHeight = (d.errors / d.total) * 100;
            const warnHeight = (d.warnings / d.total) * 100;
            const infoHeight = 100 - errorHeight - warnHeight;

            return (
              <div key={d.time} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                <div
                  className="w-full rounded-t flex flex-col overflow-hidden transition-all duration-200 hover:opacity-80"
                  style={{ height: `${heightPercent}%` }}
                >
                  <div style={{ height: `${errorHeight}%` }} className="bg-rose-500 w-full" />
                  <div style={{ height: `${warnHeight}%` }} className="bg-amber-400 w-full" />
                  <div style={{ height: `${infoHeight}%` }} className="bg-indigo-500 w-full" />
                </div>

                {/* Tooltip on hover */}
                <div className="absolute -top-9 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                  {d.time}: {d.total} logs ({d.errors} err)
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1.5">
          {logHistogramData.map((d) => (
            <span key={d.time}>{d.time}</span>
          ))}
        </div>
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
              placeholder='Search logs by message, service, traceId (e.g. "timeout", "payment-service")...'
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
              aria-label="Filter logs by microservice"
              className="w-full md:w-48 px-3 py-2 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Microservices</option>
              {logFilterOptions.services.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
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
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Auto Tail</span>
            </label>
            <span className="font-mono text-slate-400">
              Showing {filteredLogs.length} events
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
            <span className="ml-2 font-semibold text-slate-300">stdout &bull; k8s-pod-collector</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">Demo data</span>
        </div>

        {/* Log Entries */}
        <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-900/60 p-2">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              No log entries match filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => {
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
                    <span className="text-slate-500 shrink-0 select-none text-[11px]">{log.timestamp}</span>

                    {/* Level Badge */}
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${
                        log.level === 'ERROR'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : log.level === 'WARN'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : log.level === 'INFO'
                          ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {log.level}
                    </span>

                    {/* Service */}
                    <span className="text-indigo-400 font-semibold shrink-0 select-none">
                      [{log.service}]
                    </span>

                    {/* Message */}
                    <span
                      className={`flex-1 text-slate-300 ${
                        wrapLines ? 'break-words' : 'truncate'
                      } ${log.level === 'ERROR' ? 'text-rose-200' : ''}`}
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
                        {log.traceId && (
                          <div>
                            <span className="text-slate-500">Trace ID:</span>{' '}
                            <span className="text-indigo-300 font-mono select-all">{log.traceId}</span>
                          </div>
                        )}
                        {log.spanId && (
                          <div>
                            <span className="text-slate-500">Span ID:</span>{' '}
                            <span className="text-indigo-300 font-mono select-all">{log.spanId}</span>
                          </div>
                        )}
                      </div>

                      {log.attributes && (
                        <div>
                          <span className="text-slate-500 block mb-1">Context Attributes:</span>
                          <pre className="bg-slate-950 p-2 rounded border border-slate-800/80 text-[10px] text-emerald-400 overflow-x-auto">
                            {JSON.stringify(log.attributes, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.stackTrace && (
                        <div>
                          <span className="text-rose-400 font-semibold block mb-1">Stack Trace:</span>
                          <pre className="bg-rose-950/40 p-2 rounded border border-rose-900/50 text-[10px] text-rose-300 overflow-x-auto whitespace-pre-wrap">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
