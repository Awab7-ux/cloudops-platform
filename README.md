# CloudOps Platform

CloudOps Platform is a small, container-ready REST API built with Python and
FastAPI. This phase establishes a tested service foundation and adds a GitHub
Actions workflow for automated tests. It does not include cloud provisioning,
Kubernetes, or Terraform.

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

Run the tests with:

```powershell
python -m pytest -q
```

### Known limitations

- SQLite is single-writer and there are no schema migrations.
- No authentication.
- The frontend still uses clearly labeled demo data except for `GET /health`
  and `GET /version`.

## Requirements

- Python 3.10 or newer
- pip
- Docker Desktop is optional and is only needed to build or run the container

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
requests targeting `main`. It uses Ubuntu and Python 3.12, creates a project-local
`.venv`, installs `requirements-dev.txt` (which includes `requirements.txt`),
and runs the same command used locally:

```bash
python -m pytest -q
```

The workflow grants only `contents: read` and requires no secrets or paid
services. Dependency installation and test failures fail the job. To see a
GitHub Actions result, push a commit or open a pull request and check the
repository's **Actions** tab; a passing local test run is not a GitHub Actions
run.

## Docker

Build the image from the project directory:

```bash
docker build -t cloudops-platform:local .
```

Run it locally (custom version via an environment variable):

```bash
docker run -d --name cloudops-test -p 8000:8000 -e APP_VERSION=1.0.0-local cloudops-platform:local
```

Test the endpoints:

```bash
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/version
```

Stop and remove the container:

```bash
docker rm -f cloudops-test
```

The container starts Uvicorn on port `8000` by default. The Dockerfile reads
`PORT` for the listening port; if you change it, publish the same container
port with `-p`.

### Verified locally

Tested on Windows 11 with Docker Desktop:

- The image builds successfully from `python:3.12-slim`.
- `GET /`, `GET /health` and `GET /version` return the expected JSON.
- `APP_VERSION` is read from the environment; without it, `/version` returns the default `0.1.0`.
- The container runs as a non-root user (`uid=10001`, `appuser`).
- The frontend uses clearly labeled demo data everywhere except the live probes of the backend API (`GET /`, `GET /health`, `GET /version`).

## Run with Docker

Prerequisites:

- Docker Desktop is installed and running.
- Ports `3000` and `8000` are available on localhost.

Commands:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose down
```

To delete the SQLite database volume entirely:

```powershell
docker compose down -v
```

URLs:

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

Data location:

- SQLite database is stored in the named Docker volume `cloudops-data`.
- The backend uses `DATABASE_URL=sqlite:////data/cloudops.db` inside the container.

Change the API URL for a frontend rebuild:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8000"; docker compose build frontend
```

Limitations:

- Pages remain labeled as demo data except for the live API probes.
- The frontend is not wired to `/applications` and `/deployments` yet.
- SQLite is single-writer and has no migrations; tables are created at startup.
- Ports are bound to localhost only and there is no TLS.
- The API URL is fixed at build time.
- No Content-Security-Policy has been added yet.
- Docker build is not run in CI yet.
