output "compose_network_name" {
  description = "Docker network used by the CloudOps Compose services."
  value       = docker_network.compose.name
}

output "sqlite_volume_name" {
  description = "Persistent Docker volume mounted at /data by the backend."
  value       = docker_volume.sqlite.name
}

output "sqlite_volume_mountpoint" {
  description = "Docker Engine's mountpoint for the SQLite volume."
  value       = docker_volume.sqlite.mountpoint
}
