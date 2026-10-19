# CloudOps Platform

CloudOps Platform is a small, container-ready REST API built with Python and
FastAPI. This first phase establishes a tested service foundation for later
infrastructure and observability work. It does not include cloud provisioning,
Kubernetes, Terraform, or CI/CD.

## Architecture

The service is intentionally stateless and has no database or external service
dependencies:

```text
HTTP client
    │
    ▼
Uvicorn (ASGI server)
    │
    ▼
FastAPI application
    ├── GET /
    ├── GET /health
    └── GET /version
```

`APP_NAME` and `APP_VERSION` are read from the process environment when the
application is created. The container runs as a non-root user. Runtime
dependencies are listed in `requirements.txt`; test and development dependencies
are isolated in `requirements-dev.txt`.

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

Run the API locally:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The server listens on `http://127.0.0.1:8000`. Set optional configuration in
PowerShell before starting it:

```powershell
$env:APP_NAME = "CloudOps Platform"
$env:APP_VERSION = "1.0.0"
```

Configuration variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `CloudOps Platform` | Service name returned by `/` and `/version` |
| `APP_VERSION` | `0.1.0` | Version returned by `/version` |
| `PORT` | `8000` | Port used by the Docker container command |

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

Install the development dependencies as shown above, then run:

```powershell
python -m pytest -q
```

The tests check the response bodies, JSON content type, success status codes,
environment-based configuration, and the not-found status for an unknown route.

## Docker

Build the image from the project directory:

```powershell
docker build -t cloudops-platform .
```

Run it locally:

```powershell
docker run --rm -p 8000:8000 -e APP_VERSION=1.0.0 cloudops-platform
```

The image installs runtime dependencies only and starts Uvicorn on port `8000`
by default. Override the container port with `PORT` if needed, and publish that
same container port with Docker's `-p` option.

Docker commands are provided as setup guidance; whether the image builds or runs
depends on the local Docker installation and has not been asserted here.
