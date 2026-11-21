# Local Terraform resources

Terraform manages the Docker network and persistent SQLite volume used by
Docker Compose. Compose manages the backend and frontend containers. Kubernetes
manifests remain the source of truth for application workloads.

The existing Kind cluster stays under the repository's Kind script and CLI.
The available community Kind providers treat most cluster configuration changes
as replacements, which would delete and recreate the cluster. That is too risky
for this existing cluster and its host-path data, so Terraform does not manage
Kind lifecycle here.

## Prerequisites

- Terraform 1.17.x
- Docker Desktop with its Docker Engine running
- The CloudOps Compose network and data volume, or a reviewed plan to create
  them on a fresh machine

The configuration uses local Terraform state in this directory. State,
provider cache, and machine-specific `terraform.tfvars` are ignored by Git.
Do not delete or replace the state file after importing existing resources.

## Configure and initialize

From the repository root, copy the example variables file and edit only the
Docker host if needed:

```powershell
Copy-Item terraform/terraform.tfvars.example terraform/terraform.tfvars
Set-Location terraform
terraform init
terraform fmt -check
terraform validate
```

On Linux, set `docker_host` to `unix:///var/run/docker.sock`. The provider is
pinned to `kreuzwerker/docker` 4.6.x; it manages only the local network and
volume, with no cloud provider, account, or paid service.

## Adopt the existing Compose resources

The current Docker resources predate Terraform. Import them into the new local
state before planning, so Terraform adopts them instead of proposing duplicate
resources:

```powershell
terraform import docker_volume.sqlite cloudops-platform_cloudops-data
$networkId = docker network inspect --format '{{.Id}}' cloudops-platform_default
terraform import docker_network.compose $networkId
terraform plan
```

Review the plan. It should report no changes after a clean import. Stop if it
proposes a replacement, deletion, or unexpected update. Both resources use
`prevent_destroy`; this configuration cannot destroy the database volume or
network.

For a fresh local machine with no such resources, inspect the create-only plan
before running `terraform apply`. The two imported resources are named to match
the Compose external-resource settings. If you change either name, update both
the Terraform variable and the corresponding Compose environment variable.

After Terraform has created or adopted the resources, start the app from the
repository root:

```powershell
docker compose up -d --build
docker compose ps
```

The SQLite volume is mounted at `/data` and survives container recreation.
Never use `terraform destroy` or remove the Docker volume to reset application
data. Back up the database file before maintenance that could affect the Docker
Desktop data store.
