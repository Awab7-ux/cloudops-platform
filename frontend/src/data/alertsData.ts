/**
 * Alerts, Incidents, and Reliability sample data.
 * All demo metrics labeled with Demo data.
 */

export interface IncidentItem {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'Firing' | 'Investigating' | 'Mitigated' | 'Resolved';
  timeAgo: string;
  service: string;
  summary: string;
  triggerValue: string;
  threshold: string;
  duration: string;
  responders: string[];
  impact: string;
  timeline: Array<{ time: string; event: string }>;
}

export const activeIncidents: IncidentItem[] = [
  {
    id: 'INC-4091',
    title: 'Worker Queue Redis Connection Pool Exhaustion',
    severity: 'CRITICAL',
    status: 'Firing',
    timeAgo: '24m ago',
    service: 'worker-queue',
    summary: 'Redis client socket timeouts exceeded threshold (> 50/sec). Alert rule RedisMaxConnsFired tripped.',
    triggerValue: '5,000 / 5,000 conns (100% full)',
    threshold: 'Limit: 4,000 connections (80%)',
    duration: '24m ongoing',
    responders: ['carol.sre', 'devon.ops'],
    impact: '1,240 jobs/min delayed',
    timeline: [
      { time: '10:14:02 AM', event: 'Alert rule RedisMaxConnsFired triggered' },
      { time: '10:16:15 AM', event: 'P99 round-trip latency jumped from 12ms to 2,410ms' },
      { time: '10:18:40 AM', event: 'Auto-remediation playbook pb-1 dispatched' },
      { time: '10:22:10 AM', event: 'Redis cluster replica scale initiated' },
    ],
  },
  {
    id: 'INC-4088',
    title: 'Ingress 5xx Error Rate Exceeded 0.05% Threshold',
    severity: 'HIGH',
    status: 'Investigating',
    timeAgo: '42m ago',
    service: 'api-router',
    summary: '5xx responses surged to 0.14% after step 4 (75% canary shift). Auto-rollback triggered.',
    triggerValue: '0.14% 5xx errors',
    threshold: 'SLO Limit: 0.05%',
    duration: '18m elapsed',
    responders: ['alice.dev', 'marcus.lead'],
    impact: '0.14% transient client errors',
    timeline: [
      { time: '09:58:10 AM', event: 'Canary traffic shifted to 75%' },
      { time: '10:00:22 AM', event: 'Argo AnalysisTemplate tripped threshold' },
      { time: '10:02:15 AM', event: 'VirtualService traffic reverted to v2.0.9' },
    ],
  },
];

export const ACTIVE_INCIDENTS = activeIncidents;

export interface NotificationChannel {
  name: string;
  type: string;
  target: string;
  lastPing: string;
  status: string;
}

export const notificationChannels: NotificationChannel[] = [
  {
    name: 'PagerDuty Primary On-Call',
    type: 'PagerDuty',
    target: 'service/k8s-core-escalation',
    lastPing: '2m ago',
    status: 'Operational',
  },
  {
    name: '#sre-war-room',
    type: 'Slack Bot',
    target: 'webhook/T001/B991/xyz',
    lastPing: '1m ago',
    status: 'Operational',
  },
  {
    name: 'Opsgenie Tier-2 Incident Ops',
    type: 'Opsgenie',
    target: 'team/platform-infrastructure',
    lastPing: '5m ago',
    status: 'Operational',
  },
  {
    name: 'SecOps Audit Webhook',
    type: 'Webhook',
    target: 'https://sec-api.internal/v1/alert',
    lastPing: '30s ago',
    status: 'Operational',
  },
];

export const DISPATCH_CHANNELS = notificationChannels;

export interface PlaybookItem {
  id: string;
  name: string;
  description: string;
  trigger: string;
  targetNamespace: string;
  successRate: string;
  executionCount: number;
  status: string;
}

export const autoRemediationPlaybooks: PlaybookItem[] = [
  {
    id: 'pb-01',
    name: 'HPA Auto-Scale Burst',
    description: 'Increases replica target by 50% when worker queue depth exceeds 3,000 tasks.',
    trigger: 'RedisQueueBacklogHigh',
    targetNamespace: 'core',
    successRate: '98.4%',
    executionCount: 142,
    status: 'Active',
  },
  {
    id: 'pb-02',
    name: 'Redis Sentinel Failover Drill',
    description: 'Forces failover to warm read-replica when primary node fails 3 consecutive health checks.',
    trigger: 'RedisMasterUnreachable',
    targetNamespace: 'cache',
    successRate: '100%',
    executionCount: 18,
    status: 'Active',
  },
  {
    id: 'pb-03',
    name: 'Pod Memory Leak Recycle',
    description: 'Drains and gracefully cycles pods approaching 92% memory cgroup threshold.',
    trigger: 'ContainerOOMNearing',
    targetNamespace: 'core',
    successRate: '99.1%',
    executionCount: 89,
    status: 'Active',
  },
];

export const REMEDIATION_PLAYBOOKS = autoRemediationPlaybooks;

export interface ResolvedIncident {
  id: string;
  title: string;
  severity: string;
  duration: string;
  resolvedAt: string;
  resolution: string;
}

export const resolvedIncidents: ResolvedIncident[] = [
  {
    id: 'INC-4085',
    title: 'PostgreSQL Primary Replication Lag > 120s',
    severity: 'HIGH',
    duration: '14m 22s',
    resolvedAt: 'Today at 08:30 AM',
    resolution: 'Scaled replica IOPS on EBS gp3 volume and cleared vacuum backlog.',
  },
  {
    id: 'INC-4081',
    title: 'Stripe Webhook Dead Letter Queue Saturation',
    severity: 'MEDIUM',
    duration: '22m 05s',
    resolvedAt: 'Yesterday at 16:15 PM',
    resolution: 'Rotated webhook signature secrets and drained retry buffer.',
  },
  {
    id: 'INC-4074',
    title: 'OAuth Authentication Gateway Global TLS Handshake Failures',
    severity: 'CRITICAL',
    duration: '31m 48s',
    resolvedAt: '3 days ago',
    resolution: 'Updated intermediate TLS certificate chain secret in cert-manager.',
  },
];

export const RESOLVED_INCIDENTS = resolvedIncidents;
