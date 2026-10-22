/**
 * Real-time operational logs sample data.
 * All demo metrics labeled as Demo data.
 */

export interface LogEvent {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'FATAL';
  service: string;
  message: string;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
  stackTrace?: string;
}

export type LogEntry = LogEvent;

export const logStreamEvents: LogEvent[] = [
  {
    id: 'log-01',
    timestamp: '10:42:01.892',
    level: 'INFO',
    service: 'auth-service',
    message: 'JWT Token validated successfully for subject: devops_eng_01 (claims: 4, rtt: 1.2ms)',
    traceId: 'trc_9948ba28c04',
    spanId: 'spn_001',
    attributes: {
      client_ip: '10.244.1.84',
      issuer: 'https://auth.cloudops.internal',
      roles: ['admin', 'infra_eng'],
      durationMs: 1.2,
    },
  },
  {
    id: 'log-02',
    timestamp: '10:42:02.104',
    level: 'WARN',
    service: 'worker-queue',
    message: 'High queue backlog: 4,812 pending tasks (threshold: 3,000). Auto-scale group triggered.',
    traceId: 'trc_que_440188b',
    spanId: 'spn_002',
    attributes: {
      queue: 'celery-default',
      currentDepth: 4812,
      consumptionRate: '110 jobs/s',
    },
  },
  {
    id: 'log-03',
    timestamp: '10:42:02.451',
    level: 'ERROR',
    service: 'api-router',
    message: 'upstream connect error or disconnect/reset before headers. reset reason: connection failure (errno: 111)',
    traceId: 'trc_err_09118c7e',
    spanId: 'spn_003',
    attributes: {
      route: '/v1/billing/subscriptions',
      status: 503,
      upstream: 'billing-svc.prod.svc.cluster.local:8080',
    },
    stackTrace: `upstream connect error or disconnect/reset before headers. reset reason: connection failure
  at envoy::upstream::LogicalHost::connectFailure()
  at envoy::http::AsyncClientImpl::StreamImpl::resetStream()
  Caused by: ConnectionRefusedError: [Errno 111] Connection refused by pod billing-svc-pod-22a`,
  },
  {
    id: 'log-04',
    timestamp: '10:42:03.002',
    level: 'INFO',
    service: 'payment-gateway',
    message: 'Stripe webhook idempotency check passed for charge_9841. Triggering fulfillment dispatch.',
    traceId: 'trc_pay_7721',
    spanId: 'spn_004',
    attributes: {
      eventType: 'charge.succeeded',
      amount: 12900,
      currency: 'usd',
    },
  },
  {
    id: 'log-05',
    timestamp: '10:42:03.418',
    level: 'DEBUG',
    service: 'api-router',
    message: 'Evaluating Envoy rate-limit bucket for client subnet 198.51.100.0/24: 142/5000 consumed',
    traceId: 'trc_rl_1029',
    spanId: 'spn_005',
    attributes: {
      bucket: 'ingress_standard_tier',
      remaining: 4858,
    },
  },
  {
    id: 'log-06',
    timestamp: '10:42:03.901',
    level: 'INFO',
    service: 'telemetry-collector',
    message: 'Exported 18,400 OTel spans and 420 metrics to Prometheus long-term storage in 48ms',
    traceId: 'trc_otel_881',
    spanId: 'spn_006',
    attributes: {
      spansCount: 18400,
      metricsCount: 420,
      exportDurationMs: 48,
    },
  },
  {
    id: 'log-07',
    timestamp: '10:42:04.220',
    level: 'WARN',
    service: 'worker-queue',
    message: 'Worker thread pod/celery-worker-08 reported Redis socket timeout after 2500ms',
    traceId: 'trc_que_440188b',
    spanId: 'spn_007',
    attributes: {
      timeoutMs: 2500,
      redisHost: 'redis-cluster.cache.svc.cluster.local:6379',
    },
  },
];

export const INITIAL_LOGS = logStreamEvents;

export const logHistogramData = [
  { time: '10:35', total: 1840, errors: 4, warnings: 28 },
  { time: '10:36', total: 2100, errors: 6, warnings: 32 },
  { time: '10:37', total: 2450, errors: 12, warnings: 45 },
  { time: '10:38', total: 3200, errors: 48, warnings: 92 },
  { time: '10:39', total: 2900, errors: 34, warnings: 84 },
  { time: '10:40', total: 2300, errors: 18, warnings: 52 },
  { time: '10:41', total: 1980, errors: 8, warnings: 36 },
  { time: '10:42', total: 2150, errors: 5, warnings: 30 },
];

export const logFilterOptions = {
  services: [
    'api-router',
    'auth-service',
    'payment-gateway',
    'worker-queue',
    'telemetry-collector',
    'notification-service',
    'catalog-service',
  ],
  levels: ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'],
  environments: ['production', 'staging', 'canary'],
};
