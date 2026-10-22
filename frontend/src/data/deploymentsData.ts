/**
 * Deployment history and Canary progressive delivery sample data.
 * All demo metrics labeled with Demo data.
 */

export interface DeploymentRecord {
  id: string;
  app: string;
  branch: string;
  commitSha: string;
  commitType: string;
  commitMsg: string;
  environment: string;
  status: 'In Progress (75%)' | 'Success' | 'Rolled Back' | 'Failed (Scan)';
  statusType: 'in-progress' | 'success' | 'rolled-back' | 'failed';
  initiator: string;
  initiatorInitial: string;
  duration: string;
  age: string;
  isCanary?: boolean;
}

export const DEPLOYMENTS_LIST: DeploymentRecord[] = [
  {
    id: "dep-9842f1",
    app: "api-router",
    branch: "main",
    commitSha: "#609d93a",
    commitType: "feat(proxy)",
    commitMsg: "optimize upstream connection pool buffers",
    environment: "Production-East",
    status: "In Progress (75%)",
    statusType: "in-progress",
    initiator: "alice.dev",
    initiatorInitial: "A",
    duration: "04m 12s (elapsed)",
    age: "Started 4m ago",
    isCanary: true,
  },
  {
    id: "dep-9831c2",
    app: "payment-service",
    branch: "release/v1.9.4",
    commitSha: "#7e4b102",
    commitType: "fix(stripe)",
    commitMsg: "handle webhook timeout idempotency token key",
    environment: "Production-East",
    status: "Success",
    statusType: "success",
    initiator: "GitHub Actions",
    initiatorInitial: "CI",
    duration: "03m 12s",
    age: "18m ago",
  },
  {
    id: "dep-8711a4",
    app: "auth-service",
    branch: "main",
    commitSha: "#a901f4c",
    commitType: "chore(oauth)",
    commitMsg: "bump jwt claims cache ttl to 3600",
    environment: "Production-West",
    status: "Rolled Back",
    statusType: "rolled-back",
    initiator: "bob.ops",
    initiatorInitial: "B",
    duration: "01m 04s (aborted)",
    age: "1h 12m ago",
  },
  {
    id: "dep-6520c9",
    app: "notification-worker",
    branch: "main",
    commitSha: "#12bb804",
    commitType: "feat(sns)",
    commitMsg: "add dead letter queue backoff metrics",
    environment: "Production-East",
    status: "Success",
    statusType: "success",
    initiator: "GitLab CI/CD",
    initiatorInitial: "CI",
    duration: "02m 45s",
    age: "2h 40m ago",
  },
  {
    id: "dep-5419b1",
    app: "analytics-engine",
    branch: "feat/clickhouse",
    commitSha: "#88c031d",
    commitType: "refactor",
    commitMsg: "migrate aggregated views pipeline",
    environment: "Staging Europe",
    status: "Success",
    statusType: "success",
    initiator: "carol.sre",
    initiatorInitial: "C",
    duration: "04m 02s",
    age: "4h 05m ago",
  },
  {
    id: "dep-4309e7",
    app: "billing-portal",
    branch: "patch/sec-deps",
    commitSha: "#5510de3",
    commitType: "security",
    commitMsg: "upgrade openssl and libcrypto bindings",
    environment: "Staging Europe",
    status: "Failed (Scan)",
    statusType: "failed",
    initiator: "GitHub Actions",
    initiatorInitial: "CI",
    duration: "00m 52s",
    age: "5h 22m ago",
  },
  {
    id: "dep-3201f8",
    app: "search-indexer",
    branch: "main",
    commitSha: "#09f7a81",
    commitType: "perf(elastic)",
    commitMsg: "tune bulk indexing flush interval to 500ms",
    environment: "Production-East",
    status: "Success",
    statusType: "success",
    initiator: "alice.dev",
    initiatorInitial: "A",
    duration: "03m 48s",
    age: "6h 15m ago",
  },
];

export const CANARY_STEPS = [
  {
    step: "01",
    title: "Pre-flight Verification",
    duration: "14s",
    description: "Commit validations, schema checks, and drift detection verified.",
    badge: "Git tag matched",
    status: "complete",
  },
  {
    step: "02",
    title: "Cosign Image Provenance",
    duration: "45s",
    description: "SBOM validation passed with 0 critical vulnerabilities recorded.",
    badge: "CVE-0 High/Crit",
    status: "complete",
  },
  {
    step: "03",
    title: "Pod Deployment & Probes",
    duration: "1m 20s",
    description: "Liveness & readiness probe gates passed across 8 replicas.",
    badge: "8 of 8 Ready",
    status: "complete",
  },
  {
    step: "04",
    title: "Canary Traffic Shift",
    duration: "Active",
    description: "75% weight routed. Prometheus SLA assertions actively monitored.",
    badge: "12/12 passed",
    status: "active",
    latency: "18.2ms",
    errorRate: "0.002%",
  },
  {
    step: "05",
    title: "Final Fleet Cutover",
    duration: "Queued",
    description: "100% traffic shift, decommission legacy replicasets v2.0.4.",
    badge: "Pending Step 4",
    status: "pending",
  },
];

export const BASELINE_VS_CANARY_METRICS = [
  {
    metric: "HTTP Request p95",
    baseline: "14.6 ms",
    canary: "12.1 ms",
    variance: "-17.1% (Faster)",
    isBetter: true,
  },
  {
    metric: "HTTP Request p99",
    baseline: "21.4 ms",
    canary: "18.2 ms",
    variance: "-14.9% (Within SLA)",
    isBetter: true,
  },
  {
    metric: "5xx Error Rate",
    baseline: "0.005%",
    canary: "0.002%",
    variance: "Normal Range",
    isBetter: true,
  },
  {
    metric: "Memory Footprint (Avg)",
    baseline: "342 MiB / pod",
    canary: "310 MiB / pod",
    variance: "-9.3% usage",
    isBetter: true,
  },
  {
    metric: "CPU Throttle Thresh",
    baseline: "0.04% throttled",
    canary: "0.01% throttled",
    variance: "Optimal",
    isBetter: true,
  },
];

export const EXECUTION_EVENTS = [
  {
    type: "TrafficWeightIncremented",
    timestamp: "00:04:10",
    detail: "Route weight modified to 75% canary / 25% stable via VirtualService.",
  },
  {
    type: "ReadinessProbePassed",
    timestamp: "00:03:45",
    detail: "Pod api-router-canary-6bf9d8-9qk2l passed probe on :8080/healthz.",
  },
  {
    type: "Started",
    timestamp: "00:03:32",
    detail: "Started container `api-router` in pod api-router-canary-6bf9d8-9qk2l.",
  },
  {
    type: "Created",
    timestamp: "00:03:30",
    detail: "Created container `api-router` on node ip-10-0-12-84.ec2.internal.",
  },
  {
    type: "Pulled",
    timestamp: "00:03:22",
    detail: "Successfully pulled image `ecr.aws/v2/api-router:v2.1.0` in 2.81s.",
  },
  {
    type: "PodScheduled",
    timestamp: "00:03:19",
    detail: "Assigned default/api-router-canary-6bf9d8-9qk2l to node-us-east-1a-c5-4xl.",
  },
  {
    type: "TrafficWeightIncremented",
    timestamp: "00:02:00",
    detail: "Route weight stepped up to 25% after initial canary health gate.",
  },
];
