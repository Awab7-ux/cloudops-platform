/**
 * Overview page sample data.
 * All demo metrics are explicitly tagged as Demo data.
 */

export interface MetricCardData {
  title: string;
  subtitle: string;
  badge: string;
  value: string;
  trend: string;
  trendPositive: boolean;
  breakdown: string;
  progressValue: number;
  progressColor?: string;
}

export const OVERVIEW_METRICS = {
  applications: {
    title: "Applications",
    subtitle: "14 active microservices",
    badge: "Demo data",
    value: "14 Active",
    trend: "+2 wk",
    trendPositive: true,
    healthyCount: 12,
    degradedCount: 2,
    healthyPercent: 85.7,
    degradedPercent: 14.3,
  },
  deployments: {
    title: "Deployments",
    subtitle: "Rolling & Canary releases",
    badge: "Demo data",
    value: "38 Today",
    trend: "97.4% Pass",
    trendPositive: true,
    avgLeadTime: "3m 42s",
    passPercent: 97.4,
  },
  cpuUtilization: {
    title: "CPU Utilization",
    subtitle: "8 Compute Nodes pool",
    badge: "Demo data",
    value: "42.8%",
    trend: "Limit < 75%",
    trendPositive: true,
    breakdown: "34.2 / 80 Cores",
    percent: 42.8,
  },
  memoryAllocation: {
    title: "Memory Allocation",
    subtitle: "RAM active commitment",
    badge: "Demo data",
    value: "64.2%",
    trend: "Stable",
    trendPositive: true,
    breakdown: "20.5 GB / 32 GB (11.5 GB Free)",
    percent: 64.2,
  },
};

export const CLUSTER_TELEMETRY = {
  cpuAverage: "42.8%",
  cpuPeak: "58.1%",
  memAverage: "64.2%",
  memPeak: "71.0%",
  timeLabels: [
    "10:00 AM",
    "10:15 AM",
    "10:30 AM (Peak API Load)",
    "10:45 AM",
    "11:00 AM",
  ],
};

export const NODE_CLUSTER_CAPACITY = [
  {
    id: "1a",
    name: "node-us-east-1a",
    instanceType: "c6i.2xlarge • 8 vCPU",
    cpu: 38.4,
    ram: 59.0,
    status: "Online",
    zone: "us-east-1a",
  },
  {
    id: "1b",
    name: "node-us-east-1b",
    instanceType: "c6i.2xlarge • 8 vCPU",
    cpu: 52.1,
    ram: 72.4,
    status: "Online",
    zone: "us-east-1b",
  },
  {
    id: "1c",
    name: "node-us-east-1c",
    instanceType: "c6i.2xlarge • 8 vCPU",
    cpu: 36.9,
    ram: 61.2,
    status: "Online",
    zone: "us-east-1c",
  },
];

export interface ActivityEvent {
  id: string;
  type: "Deployment" | "Alert" | "Config" | "Probe" | "Simulation";
  summary: string;
  detail: string;
  environment: string;
  actor: string;
  status: "Success" | "Resolved" | "Applied" | "Passed" | "Handled";
  timestamp: string;
}

export const INITIAL_ACTIVITY_FEED: ActivityEvent[] = [
  {
    id: "act-1",
    type: "Deployment",
    summary: "auth-service v2.4.1 deployed",
    detail: "Commit: 7f3a9e2 • 4 pods updated",
    environment: "prod-us-east-1",
    actor: "Argocd / Pipeline #8412",
    status: "Success",
    timestamp: "12m ago",
  },
  {
    id: "act-2",
    type: "Alert",
    summary: "redis-cache memory spike to 81%",
    detail: "Auto-scaled +2 replicas; memory stabilized",
    environment: "prod-us-east-1",
    actor: "HPA-Controller",
    status: "Resolved",
    timestamp: "34m ago",
  },
  {
    id: "act-3",
    type: "Config",
    summary: "Rate-limiting policy updated",
    detail: "Ingress rate ceiling elevated to 10k rps",
    environment: "global-ingress",
    actor: "GitOps Bot (PR #391)",
    status: "Applied",
    timestamp: "1h ago",
  },
  {
    id: "act-4",
    type: "Probe",
    summary: "Periodic synthetic health check passed",
    detail: "Endpoints /health and /version queried",
    environment: "cluster-mesh",
    actor: "FastAPI-Daemon",
    status: "Passed",
    timestamp: "2m ago",
  },
];
