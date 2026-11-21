resource "docker_network" "compose" {
  name   = var.network_name
  driver = "bridge"

  # Compose owns its labels, while Terraform owns the network lifecycle.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels]
  }
}

resource "docker_volume" "sqlite" {
  name   = var.data_volume_name
  driver = "local"

  # Prevent accidental loss of the application's persistent database volume.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [labels]
  }
}
