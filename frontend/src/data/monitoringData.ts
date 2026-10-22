/**
 * Monitoring and Service Health sample data.
 * All demo metrics labeled with Demo data.
 */

export interface ServiceMatrixItem {
  id: string;
  name: string;
  cluster: string;
  status: 'Healthy' | 'High Load' | 'Initializing';
  responseTime: string;
  uptime30d: string;
  pods: string;
  cpu: string;
  memory: string;
  metricNote?: string;
}

export interface ServiceStatusItem {
  service: string;
  namespace: string;
  apdex: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  status: 'Optimal' | 'Warning' | 'Critical';
}

export const monitoringSummaryMetrics = [
  {
    id: 'uptime',
    label: 'Aggregate Fleet Uptime',
    value: '99.98%',
    period: 'Rolling 30-Day Window',
    trend: '+0.04%',
    icon: 'verified',
  },
  {
    id: 'p95-latency',
    label: 'p95 Service Latency',
    value: '28.4 ms',
    period: 'Across all 14 ingress services',
    trend: '-3.1 ms',
    icon: 'speed',
  },
  {
    id: 'error-rate',
    label: 'Global Error Rate',
    value: '0.018%',
    period: 'SLO Target: < 0.05%',
    trend: '-0.005%',
    icon: 'error_outline',
  },
  {
    id: 'daily-reqs',
    label: 'Daily Ingress Volume',
    value: '184.2M',
    period: 'Peak: 3.8k queries/sec',
    trend: '+12.4%',
    icon: 'trending_up',
  },
];

export const serviceStatuses: ServiceStatusItem[] = [
  {
    service: 'auth-service',
    namespace: 'auth',
    apdex: 0.99,
    p50: 12,
    p95: 22,
    p99: 45,
    errorRate: 0.01,
    status: 'Optimal',
  },
  {
    service: 'payment-gateway',
    namespace: 'checkout',
    apdex: 0.98,
    p50: 18,
    p95: 34,
    p99: 68,
    errorRate: 0.02,
    status: 'Optimal',
  },
  {
    service: 'api-router',
    namespace: 'core',
    apdex: 0.99,
    p50: 8,
    p95: 16,
    p99: 31,
    errorRate: 0.01,
    status: 'Optimal',
  },
  {
    service: 'worker-queue',
    namespace: 'core',
    apdex: 0.88,
    p50: 45,
    p95: 110,
    p99: 240,
    errorRate: 0.12,
    status: 'Warning',
  },
  {
    service: 'telemetry-collector',
    namespace: 'analytics',
    apdex: 0.97,
    p50: 14,
    p95: 28,
    p99: 55,
    errorRate: 0.01,
    status: 'Optimal',
  },
  {
    service: 'notification-service',
    namespace: 'core',
    apdex: 0.94,
    p50: 25,
    p95: 52,
    p99: 98,
    errorRate: 0.04,
    status: 'Optimal',
  },
  {
    service: 'catalog-service',
    namespace: 'core',
    apdex: 0.98,
    p50: 15,
    p95: 30,
    p99: 58,
    errorRate: 0.02,
    status: 'Optimal',
  },
];

export const latencyTimelineData = [
  { time: '10:00', p50: 12, p95: 28, p99: 48 },
  { time: '10:10', p50: 14, p95: 32, p99: 55 },
  { time: '10:20', p50: 13, p95: 29, p99: 50 },
  { time: '10:30', p50: 18, p95: 45, p99: 88 },
  { time: '10:40', p50: 15, p95: 34, p99: 62 },
  { time: '10:50', p50: 13, p95: 28, p99: 49 },
  { time: '11:00', p50: 12, p95: 26, p99: 46 },
];

export const httpStatusCodeDistribution = {
  '2xx': 98.4,
  '3xx': 1.2,
  '4xx': 0.38,
  '5xx': 0.02,
};

export const probeConfigurations = [
  { name: 'us-east-ashburn', location: 'Ashburn, VA', target: 'api.cloudops.internal', frequency: '30s' },
  { name: 'eu-west-frankfurt', location: 'Frankfurt, DE', target: 'api.cloudops.internal', frequency: '30s' },
  { name: 'ap-northeast-tokyo', location: 'Tokyo, JP', target: 'api.cloudops.internal', frequency: '30s' },
  { name: 'eu-west-dublin', location: 'Dublin, IE', target: 'api.cloudops.internal', frequency: '30s' },
  { name: 'ap-southeast-singapore', location: 'Singapore, SG', target: 'api.cloudops.internal', frequency: '30s' },
];

export const SERVICE_STATUS_MATRIX: ServiceMatrixItem[] = [
  {
    id: "auth-service",
    name: "auth-service",
    cluster: "k8s/cluster-east-1",
    status: "Healthy",
    responseTime: "18ms",
    uptime30d: "99.99%",
    pods: "8/8 Running",
    cpu: "18%",
    memory: "420MB",
  },
  {
    id: "payment-gateway",
    name: "payment-gateway",
    cluster: "pci-dss-zone-01",
    status: "Healthy",
    responseTime: "24ms",
    uptime30d: "100.0%",
    pods: "12/12 Running",
    cpu: "28%",
    memory: "880MB",
  },
  {
    id: "worker-queue",
    name: "worker-queue",
    cluster: "celery-redis-pool",
    status: "High Load",
    responseTime: "142ms",
    uptime30d: "97.4%",
    pods: "Backlog: 4,812 msgs",
    cpu: "91%",
    memory: "1.8GB",
  },
  {
    id: "api-router",
    name: "api-router",
    cluster: "kong-envoy-ingress",
    status: "Healthy",
    responseTime: "12ms",
    uptime30d: "99.99%",
    pods: "Throughput: 2.4k req/s",
    cpu: "14%",
    memory: "310MB",
  },
];

export const APDEX_STATS = {
  score: 0.98,
  targetMs: 50,
  satisfiedPercent: 97.8,
  toleratingPercent: 2.1,
  frustratedPercent: 0.1,
};

export const HTTP_STATUS_DISTRIBUTION = {
  total24h: "4.2M Queries / 24h",
  status2xx: { percent: 99.88, count: 4195120 },
  status4xx: { percent: 0.10, count: 4204 },
  status5xx: { percent: 0.02, count: 841 },
};

export const HEALTH_PROBE_CONFIG = {
  livenessInterval: "10s",
  socketTimeout: "2,500ms",
  failureThreshold: "3 attempts",
  autoHealing: true,
};
