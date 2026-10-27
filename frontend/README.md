# CloudOps Platform - Cloud Infrastructure & Operations Dashboard

A production-grade, highly responsive cloud infrastructure and operations management console built with React, TypeScript, Tailwind CSS, and Vite.

Designed for Site Reliability Engineers (SREs), DevOps architects, and platform teams monitoring distributed microservices, Kubernetes clusters, canary rollouts, multi-AZ cloud topologies, and incident remediation.

---

## Features

- **Executive Cluster Overview**: High-level Golden Signal metrics (cluster health, daily requests, p95 latency, error budget burn), cluster throughput graphs, node pool capacities, and real-time operational event stream.
- **Applications**: Real application records managed through the backend API. Remaining dashboard pages continue to use explicitly labeled demo data.
- **Canary Deployments & Rollout Pipeline**: Progressive traffic stepping (10% → 25% → 50% → 100%), real-time baseline vs. canary latency and error telemetry comparison, replica pod fleet grid, and emergency rollback simulation.
- **Cluster Infrastructure & Multi-AZ**: Physical node fleet inventory (compute, memory, storage optimized), multi-AZ zone balance (us-east-1a/b/c), persistent volume claims (PVCs), and Terraform HCL blueprint inspector.
- **System Monitoring & Apdex**: Apdex score breakdown across microservices, percentile latency curves (p50 / p95 / p99), HTTP status distribution (2xx / 3xx / 4xx / 5xx), and global synthetic edge probes.
- **Incidents & Auto-Remediation**: Active alert escalation with timeline progression, one-click incident acknowledgement and resolution, automated remediation playbooks (HPA scale burst, Redis failover, pod recycle), and notification channel health pings.
- **Structured Log Stream**: High-frequency streaming logs with search syntax, severity filters, stacked ingestion rate histogram, and expandable OpenTelemetry trace/span inspect panels.
- **Live Backend API Integration**: Applications CRUD plus the existing `GET /health` and `GET /version` probes use `VITE_API_BASE_URL`.
- **Demo Data Transparency**: Pages other than Applications continue to identify simulated metrics and fixtures as `Demo data`.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Routing**: React Router v7 (`react-router-dom`)
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Icons & Typography**: Material Symbols Outlined, Inter, and JetBrains Mono fonts
- **Build Tool**: Vite 8+

---

## Getting Started

### Prerequisites

- Node.js 22.13 or later (or Node.js 24 or later)
- npm 10.x or later

### Installation

1. Clone or extract the repository to your local environment.
2. Install dependencies from `frontend/`:

```bash
npm ci
```

### Environment Configuration

The application reads the backend base URL from `VITE_API_BASE_URL`; the Applications API client does not use a hard-coded fallback. In PowerShell, set the variable before starting the development server:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8000"
```

The existing backend probe connects to:
- `GET /health` - Returns `{ status: "ok" | "healthy", timestamp?: string }`
- `GET /version` - Returns `{ version: string, build?: string, commit?: string }`

The Applications page reads and updates records using `GET`, `POST`, `PATCH`, and `DELETE /applications`. Other pages continue to show demo data. If the backend is not running or the URL is not configured, the Applications page reports the API error and offers retry where appropriate.

### Development Server

Start the local development server from `frontend/`:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.
The Vite script uses port `3000`, which is included in the backend's default CORS origins. If you use another port or origin, configure backend `CORS_ORIGINS` to allow that exact origin; the backend must allow the browser's preflight request.

### Production Build

Compile and bundle the production assets:

```bash
npm run build
```

The compiled output will be generated in the `dist/` directory, ready to be hosted on any static hosting platform (Nginx, AWS S3/CloudFront, Cloudflare Pages, etc.).

### Preview Production Build

To preview the built production bundle locally:

```bash
npm run preview
```

### Unit Tests

Run the Applications API and UI tests:

```bash
npm run test
```

Run the existing telemetry test suite:

```bash
npx tsx --test src/utils/telemetry.test.ts
```

---

## Project Structure

```
├── public/                     # Static assets and design references
├── src/
│   ├── api/                    # Live Applications API client
│   │   ├── applications.ts     # Applications CRUD API calls
│   │   ├── applications.test.ts # API client contract tests
│   │   ├── client.ts           # Shared timeout and typed error handling
│   │   └── types.ts            # Backend request and response types
│   ├── components/             # Reusable UI components
│   │   └── layout/             # Master layout, Sidebar, Header, GlobalSearchModal
│   ├── context/
│   │   └── ApiContext.tsx      # Real API provider for /health, /version, & config
│   ├── data/                   # Isolated sample data fixtures (labeled Demo data)
│   │   ├── alertsData.ts       # Incidents, playbooks, dispatch channels
│   │   ├── applicationsData.ts # Service registry, endpoints, pod replicas
│   │   ├── deploymentsData.ts  # Canary rollouts, traffic steps, audit logs
│   │   ├── infrastructureData.ts # Nodes, multi-AZ breakdown, PVCs, Terraform spec
│   │   ├── logsData.ts         # Log stream events, rate histogram, syntax filters
│   │   ├── monitoringData.ts   # Apdex scores, percentiles, HTTP status distribution
│   │   └── overviewData.ts     # Executive KPIs, throughput, activity stream
│   ├── pages/                  # Route views
│   │   ├── OverviewPage.tsx
│   │   ├── ApplicationsPage.tsx
│   │   ├── ApplicationsPage.test.tsx # Applications UI behavior tests
│   │   ├── ApplicationDetailPage.tsx
│   │   ├── DeploymentsPage.tsx
│   │   ├── DeploymentDetailPage.tsx
│   │   ├── InfrastructurePage.tsx
│   │   ├── MonitoringPage.tsx
│   │   ├── AlertsPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/
│   │   └── apiService.ts       # Live probe executor for /health and /version
│   ├── utils/
│   │   ├── apiHealth.ts        # API URL resolver and response validation
│   │   ├── telemetry.ts        # Pure calculation utilities (Apdex, latencies, etc.)
│   │   └── telemetry.test.ts   # Automated test suite
│   ├── App.tsx                 # Route router and application entry
│   ├── index.css               # Design tokens, typography styles, Tailwind setup
│   └── main.tsx                # React DOM root mounting
├── index.html                  # HTML entry point with Inter & JetBrains Mono fonts
├── package.json                # Dependencies and project scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration with Tailwind CSS plugin
└── vitest.config.ts            # jsdom-backed React test configuration
```

---

## License

Apache-2.0
