[CmdletBinding()]
param(
    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$Namespace = 'cloudops-platform'
)

$ErrorActionPreference = 'Stop'
$secretName = 'grafana-admin'

$existingSecret = kubectl get secret $secretName -n $Namespace --ignore-not-found -o name
if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect the Grafana admin secret in namespace $Namespace."
}
if ($existingSecret) {
    Write-Output "Secret $secretName already exists in $Namespace; leaving it unchanged."
    return
}

# Generate a one-time local credential; it is sent directly to the cluster Secret API.
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$randomBytes = New-Object byte[] 32
$randomGenerator.GetBytes($randomBytes)
$randomGenerator.Dispose()
$adminPassword = [Convert]::ToBase64String($randomBytes)
$secretYaml = kubectl create secret generic $secretName `
    -n $Namespace `
    --from-literal="admin-password=$adminPassword" `
    --dry-run=client `
    -o yaml
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to generate the Grafana Kubernetes Secret manifest.'
}

$secretYaml | kubectl apply -f -
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to create the Grafana admin Secret in Kubernetes.'
}

Write-Output "Created random Grafana admin Secret $secretName in namespace $Namespace."
