variable "docker_host" {
  description = "Docker Engine API endpoint. Use npipe on Windows and unix:///var/run/docker.sock on Linux."
  type        = string
  default     = "npipe:////./pipe/docker_engine"
}

variable "network_name" {
  description = "Compose network consumed by the CloudOps services. Keep this aligned with CLOUDOPS_NETWORK_NAME in Compose."
  type        = string
  default     = "cloudops-platform_default"
}

variable "data_volume_name" {
  description = "Persistent SQLite volume consumed by the backend. Keep this aligned with CLOUDOPS_DATA_VOLUME_NAME in Compose."
  type        = string
  default     = "cloudops-platform_cloudops-data"
}
