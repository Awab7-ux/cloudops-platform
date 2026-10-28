# Local kind SQLite storage

The backend's single replica writes `sqlite:////data/cloudops.db` to the
`backend-data` PVC. That claim statically binds to the cluster-scoped
`cloudops-platform-sqlite` PV, which points at
`/var/local/cloudops-platform/sqlite` on the kind node. The
`kind-cloudops-platform.yaml.template` maps a dedicated Windows host directory
to that node path. This explicit mapping is necessary: a directory inside the
kind node container alone is not durable across cluster deletion.

## Prepare the host directory and kind configuration

From the repository root, select an absolute Windows directory. The default
below is ignored by Git; if you choose another directory inside the repository,
add an appropriate ignore rule before storing database files there.

```powershell
$env:CLOUDOPS_KIND_DATA_DIR = Join-Path (Get-Location) '.local\kind\sqlite'
New-Item -ItemType Directory -Force -Path $env:CLOUDOPS_KIND_DATA_DIR
.\k8s\New-KindConfig.ps1 -DataPath $env:CLOUDOPS_KIND_DATA_DIR
```

The script requires the directory to exist and refuses to overwrite an existing
generated config. It does not create, start, or modify a cluster. The generated
config is `.local\kind\cloudops-platform.yaml`; the existing `.local/` ignore
rule keeps it out of Git.

When approved, create the project cluster with:

```powershell
kind create cluster --config .local\kind\cloudops-platform.yaml
```

The config intentionally defines one control-plane node named
`cloudops-platform-control-plane`. The PV's node affinity keeps the hostPath
claim on that node, where the path is mounted.

## Ownership and permission verification

The backend image runs as UID/GID `10001`. Its image-owned `/data` directory is
writable by that user, but a mounted Windows host directory replaces that
directory. `fsGroup: 10001` is not a guarantee that a Windows-backed kind
mount becomes writable. Do not use privileged containers or broad permissions
to bypass this check.

After the backend is running, verify the effective identity and mount
writability without changing database contents:

```powershell
kubectl exec -n cloudops-platform deployment/backend -- sh -c 'id; test "$(id -u)" = 10001 && test "$(id -g)" = 10001 && test -w /data'
```

A nonzero exit means the mounted directory is not writable by the application.
Stop and resolve the Docker Desktop/Windows bind-mount permission issue before
relying on the database; do not delete or recreate the claim or backing data to
troubleshoot it.

## Persistence and limitations

- Pod replacements and application rollouts preserve data while the PVC and
  host directory remain intact. The backend stays at one replica with a
  `Recreate` strategy to avoid concurrent SQLite writers.
- The PV reclaim policy is `Retain`: releasing the PVC does not request normal
  reclamation of its backing data. This is not a backup and does not protect
  against manual deletion, disk failure, or data corruption.
- Deleting the kind cluster deletes its PV/PVC Kubernetes objects. The mapped
  Windows host directory can survive; recreating the cluster with the same
  `extraMounts` path allows new static PV/PVC objects to refer to those files.
- Windows or Docker Desktop restarts do not intentionally remove host files,
  but this local setup provides no backup or durability guarantee against host
  disk loss.
- The 1 GiB PV capacity is Kubernetes metadata, not a hard disk quota for
  `hostPath`; host disk usage can exceed it.
- This single-node hostPath arrangement is for local learning only. It is not
  shared, failover-capable storage and is not a production multi-node design.

## Build, load and deploy

Start Docker Desktop and stop the Docker Compose stack first (`docker compose down`,
without `-v`): both setups use host ports 8000 and 3000. Then, from the repository root:

```powershell
docker build -t cloudops-platform-backend:local .
docker build -t cloudops-platform-frontend:local --build-arg VITE_API_BASE_URL=http://localhost:8000 ./frontend
kind load docker-image cloudops-platform-backend:local cloudops-platform-frontend:local --name cloudops-platform
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/pv.yaml -f k8s/pvc.yaml -f k8s/configmap.yaml -f k8s/backend.yaml -f k8s/frontend.yaml
kubectl -n cloudops-platform rollout status deployment/backend --timeout=180s
kubectl -n cloudops-platform rollout status deployment/frontend --timeout=180s
```

Apply the namespace first. `kubectl apply -f k8s/` processes files alphabetically,
so `backend.yaml` would be applied before the namespace exists and fail.

The frontend image compiles `VITE_API_BASE_URL` into the browser bundle, and browser
JavaScript cannot resolve Kubernetes Service DNS. Forward both Services to the host:

```powershell
kubectl port-forward -n cloudops-platform svc/backend 8000:8000
kubectl port-forward -n cloudops-platform svc/frontend 3000:3000
```

Open http://localhost:3000. The backend allows this origin through `CORS_ORIGINS` in
`k8s/configmap.yaml`.

## Verified locally

Checked on Windows 11 with Docker Desktop and kind v0.33.0 (Kubernetes v1.37.0):

- `kubectl apply --dry-run=server` accepted every manifest.
- The PV is `Bound` to `cloudops-platform/backend-data`, both pods become `Ready`, and
  the backend `/health` and `/ready` probes return 200.
- UID/GID `10001` can create and delete files in the mounted host directory.
- `cloudops.db` is created in the host directory.
- Data survived deleting the backend Pod and also deleting and recreating the whole
  kind cluster with the same host directory.
- The frontend served through the port-forward lists records from the backend.

Not covered: Windows or Docker Desktop restarts, concurrent writers, backups.

## Clean up

```powershell
kind delete cluster --name cloudops-platform
```

This removes the cluster and its Kubernetes objects. The host directory
`.local\kind\sqlite` and its database are kept.