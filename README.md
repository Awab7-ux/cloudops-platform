# CloudOps Platform

CloudOps Platform is a local-first operations console built with FastAPI,
SQLite, React, and TypeScript. Applications, deployments, summaries, logs, and
alerts are backed by the API. Docker Compose runs the local app, Kind runs the
Kubernetes version, and Terraform owns the Compose network and persistent
database volume. No paid cloud provider is required.

## Backend architecture

The service uses SQLite for application, deployment, and log data and has no
external service dependencies. Its request flow is organized into these layers:

```text
Middleware
    CORS (outermost)
        ↓
    Request-ID / access logging / error boundary
        ↓
Routers (app/api/routes)
        ↓
Services (app/services)
        ↓
Schemas (app/schemas)

Core (app/core): configuration, logging, and errors
```

`APP_NAME` and `APP_VERSION` are read from the process environment when the
application is created. The container runs as a non-root user. Runtime
dependencies are listed in `requirements.txt`; test and development dependencies
are isolated in `requirements-dev.txt`.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `CloudOps Platform` | Service name returned by `/` and `/version` |
| `APP_VERSION` | `0.1.0` | Version returned by `/version` |
| `PORT` | `8000` | Port used by the Docker container command |
| `DATABASE_URL` | `sqlite:///./cloudops.db` | SQLAlchemy database URL; Compose and Kind use `sqlite:////data/cloudops.db` |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `INFO` | Python logging level |

If `CORS_ORIGINS` contains `*`, it is rejected, a warning is logged, and the
default origins are used. An invalid `LOG_LEVEL` falls back to `INFO`.
Cross-origin requests allow `GET`, `POST`, `PATCH`, and `DELETE` with the
`Content-Type` request header; credentials are disabled.

### Run locally

From PowerShell, start the backend with:

```powershell
python -m uvicorn app.main:app --port 8000
```

To enable debug logs:

```powershell
$env:LOG_LEVEL="DEBUG"; python -m uvicorn app.main:app --port 8000
```

### Observability

Every response carries `X-Request-ID`, including 500 responses. A client-supplied
value is accepted only when it is at most 64 characters and contains only
`[A-Za-z0-9._-]`; otherwise, a new ID is generated. Unexpected errors return
`{"detail": "Internal Server Error"}` without leaking details.

`GET /metrics` exposes real Prometheus counters and histograms for HTTP request
counts, 5xx responses, and latency. It also refreshes application, deployment,
and log gauges from the same database summary used by `/summary`. The scrape
route excludes its own requests and uses route templates instead of raw URLs as
labels.

The Kubernetes monitoring manifests configure Prometheus to scrape the API and
namespace-scoped `kube-state-metrics`, and provision Grafana dashboards for API
rates, errors, latency, application/deployment totals, pod readiness, restarts,
and PVC status. Those dashboards become available after the monitoring pods are
Ready. This local setup does not install a node exporter, so host CPU and memory
usage are not reported as metrics.

### Known limitations

- SQLite is single-writer and tables are created at startup; there are no schema migrations or automated backups.
- The API has no authentication or authorization.
- The Monitoring page reads backend `/metrics`; cluster target status and Infrastructure inventory are unavailable in the browser because the backend exposes no Kubernetes API.
- The configured kube-state-metrics v2.20.0 release documents Kubernetes v1.36 support, while the existing Kind node image is v1.37.0. This compatibility gap is a risk, not a proven cause of the current API outage.
- A local Kind cluster is for development and is not a highly available production Kubernetes environment.

## Frontend

Applications CRUD and details, application-scoped deployments and lifecycle
transitions, the overview summary, logs, alerts, and backend metrics use real API
routes. Alert acknowledgement, resolution, playbooks, notification channels,
incident history, Kubernetes inventory, and cluster resource time series are
not exposed by the backend and appear as unavailable. The API client reads its
base URL only from `VITE_API_BASE_URL`.

Run the frontend from `frontend/` in PowerShell:

```powershell
npm ci
$env:VITE_API_BASE_URL="http://localhost:8000"
npm run dev
```

The development server uses port `3000`, which is allowed by the backend's
default CORS origins. If you change the frontend port or origin, configure the
backend's `CORS_ORIGINS` to include that exact origin. The Docker frontend image
uses the `VITE_API_BASE_URL` build argument.

Run frontend checks from `frontend/`:

```powershell
python -m pytest -q
```

## Requirements

- Python 3.10 or newer
- Node.js 22 or newer
- pip
- Docker Desktop
- Kind, kubectl, and Terraform 1.17.x for local Kubernetes and infrastructure work

## Setup on Windows 11

From PowerShell, in the project directory:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
```

If PowerShell blocks virtual-environment activation, use Command Prompt instead:

```bat
py -3 -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
```

No secrets are required for this phase.

## API

Successful responses are JSON; the status code depends on the endpoint.

| Method | Endpoint | Example response |
| --- | --- | --- |
| `GET` | `/` | `{"name":"CloudOps Platform","message":"CloudOps Platform API is running."}` |
| `GET` | `/health` | `{"status":"ok"}` |
| `GET` | `/version` | `{"name":"CloudOps Platform","version":"0.1.0"}` |

### Summary and alerts API

The dashboard summary is computed from live application, deployment, and log aggregates without creating new tables. `GET /summary` returns total counts, zero-filled status and environment buckets, deployment counts created in the trailing 24 hours, and error-log counts in the same window. Window bounds are UTC, inclusive at both the 24-hour lower bound and `generated_at`. The response includes the five newest failed deployments in descending creation order.

The derived alert feed is generated from current application state rather than persistent alert rows. `GET /alerts` returns:

- `deployment_failed` (high): the latest deployment for an application is failed; a newer deployment clears the alert.
- `deployment_stuck` (medium): a deployment has remained running for at least 60 minutes.
- `error_log_spike` (medium): an application has at least five error logs in the trailing 60 minutes.

The alert time windows are UTC, inclusive at both the lower bound and `generated_at`. The fixed messages are “Deployment failed.”, “Deployment is stuck.”, and “Error log spike detected.” The merged feed is ordered by severity (high before medium), then `since` descending, then ID ascending. It supports optional `limit` (default `50`, maximum `200`), `offset` (default `0`), `severity`, `type`, and `application_id` filters. Alert and summary logs do not include log message content.

An unrecognized path returns FastAPI's JSON `404 Not Found` response.

### Logs API

Logs are append-only. Create a log with `POST /applications/{application_id}/logs`
(`201 Created`); the server sets `created_at` from its clock, and clients cannot
set it. A log may include an optional `deployment_id` belonging to that
application and an optional `source` label.

Retrieve logs with these endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/applications/{application_id}/logs` | List logs for one application |
| `GET` | `/deployments/{deployment_id}/logs` | List logs for one deployment |
| `GET` | `/logs` | List logs across applications |

List endpoints accept `level`, `deployment_id`, `since`, and `until`; the global
list also accepts `application_id`. `since` and `until` are ISO 8601 timestamps
with a timezone and both bounds are inclusive. Results are ordered by
`created_at` descending and then `id` ascending. Pagination uses `limit` (default
`50`, maximum `200`) and `offset` (default `0`), and returns `items`, `total`,
`limit`, and `offset`. Logs cannot be updated or individually deleted; deleting
their application or deployment removes its associated logs.

Examples in PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/version
```

## Tests

Install the development dependencies as shown above, then use the `Run the
tests` command in the backend architecture section. The tests check the
response bodies, JSON content type, success status codes, environment-based
configuration, and the not-found status for an unknown route.

## GitHub Actions CI

The workflow at `.github/workflows/ci.yml` runs on pushes to `main` and on pull
requests targeting `main`. It runs the backend and frontend suites, checks the
frontend lint and production build, builds both Docker images, validates
Kubernetes manifests with kubeconform, and runs Terraform format, validation,
and a non-applying plan. It does not deploy or apply infrastructure.

The workflow grants only `contents: read` and requires no secrets or paid
services. To see a GitHub Actions result, push a commit or open a pull request
and check the repository's **Actions** tab; local validation is not a GitHub
Actions run.

## Docker Compose

Docker Compose runs the backend and production frontend. Both services bind to
localhost only. The backend uses a non-root Python 3.12 image, read-only root
filesystem, health check, and a persistent SQLite volume. The frontend uses an
unprivileged Nginx image on internal port `8080` and exposes `/healthz`.

Terraform owns the external Compose network and database volume. On a new
machine, initialize Terraform and review its plan first; the import and local
state instructions are in [terraform/README.md](./terraform/README.md). Then
start the services from the repository root:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

URLs:

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API documentation: http://localhost:8000/docs
- Prometheus `/metrics`: http://localhost:8000/metrics

The database is stored in the Terraform-managed Docker volume
`cloudops-platform_cloudops-data` and mounted at `/data/cloudops.db`. A normal
`docker compose down` leaves the external volume and network intact. Do not use
`docker compose down -v` to reset data.

## Kubernetes with Kind

The current local cluster is named `cloudops-platform`; do not create another
cluster if it already exists. The backend, frontend, namespace, static PV/PVC,
and host-path setup are documented in [k8s/README.md](./k8s/README.md). The
backend runs one replica because SQLite is single-writer. Its PV has a `Retain`
reclaim policy and the backing host directory is ignored by Git.

The monitoring workloads are separate Kubernetes resources. Create a local
Grafana admin Secret without committing a credential, then apply them:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\k8s\monitoring\New-GrafanaAdminSecret.ps1
kubectl apply -k k8s/monitoring
kubectl rollout status deployment/kube-state-metrics -n cloudops-platform --timeout=180s
kubectl rollout status deployment/prometheus -n cloudops-platform --timeout=180s
kubectl rollout status deployment/grafana -n cloudops-platform --timeout=180s
```

Forward the Services in separate terminals:

```powershell
kubectl port-forward -n cloudops-platform svc/prometheus 9090:9090
kubectl port-forward -n cloudops-platform svc/grafana 3001:3000
```

Prometheus is at http://localhost:9090 and Grafana is at http://localhost:3001.
Grafana's local login form is disabled and its anonymous role is Viewer. The
Services remain `ClusterIP`; the port forwards bind to localhost.

## Terraform

Terraform manages the Compose Docker network and SQLite volume. It does not
manage Kubernetes application manifests or Kind lifecycle. The existing
community Kind providers replace clusters when most cluster settings change,
which is too risky for this data-bearing local cluster. See
[terraform/README.md](./terraform/README.md) for provider pins, import commands,
local state, and plan review steps. Terraform state and machine-specific
variables are ignored by Git.

## Observability and operating limits

The Prometheus endpoint reports actual HTTP request counts, 5xx responses,
latency histograms, and application/deployment/log aggregates derived from the
database. Kube-state-metrics is configured to report actual pod, deployment,
and PVC state for the `cloudops-platform` namespace. Grafana dashboards are
provisioned to use those real series.
Prometheus retains 24 hours in an ephemeral volume; Grafana's data directory is
also ephemeral, while its datasource and dashboard are provisioned from Git.

This local stack does not include node-exporter, host CPU/memory series, or an
Alertmanager notification pipeline. Prometheus alert rules are visible in the
Prometheus UI. The API has no authentication, SQLite has no migrations or
automated backups, and the Kind host-path setup is not highly available. This
project is not production-ready.
