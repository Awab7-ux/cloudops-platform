/**
 * Presentation model for the Applications inventory and detail drawer.
 * Infrastructure fields absent from the backend API are displayed as
 * unavailable values by the page.
 */
export interface ApplicationDisplayItem {
  id: string;
  name: string;
  port: string;
  protocol: string;
  namespace: string;
  environment: 'Production' | 'Staging' | 'Dev';
  health: 'Healthy' | 'Degraded' | 'Down' | 'Unknown' | 'Initializing';
  healthDetail?: string;
  version: string;
  replicasReady: number;
  replicasTotal: number;
  replicasStatus: string;
  cpu: string;
  cpuPercent: number;
  memory: string;
  memoryPercent: number;
  lastDeployed: string;
  description: string;
  ingressHost: string;
  runtime: string;
  minScale: number;
  maxScale: number;
  gracePeriod: string;
  endpoints: Array<{ method: string; path: string; status: string }>;
  dependencies: {
    upstream: string;
    downstream: string[];
  };
  sampleLogs: Array<{ time: string; level: string; msg: string }>;
}
