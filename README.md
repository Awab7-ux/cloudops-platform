# CloudOps Platform

CloudOps Platform is a small, container-ready REST API built with Python and
FastAPI. This phase establishes a tested service foundation and adds a GitHub
Actions workflow for automated tests. It does not include cloud provisioning,
Kubernetes, or Terraform.

## Backend architecture

The service is intentionally stateless and has no database or external service
dependencies. Its request flow is organized into these layers:

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

- No database.
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

All successful responses are JSON with HTTP `200 OK`.

| Method | Endpoint | Example response |
| --- | --- | --- |
| `GET` | `/` | `{"name":"CloudOps Platform","message":"CloudOps Platform API is running."}` |
| `GET` | `/health` | `{"status":"ok"}` |
| `GET` | `/version` | `{"name":"CloudOps Platform","version":"0.1.0"}` |

An unrecognized path returns FastAPI's JSON `404 Not Found` response.

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
