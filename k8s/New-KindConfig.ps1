[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DataPath
)

if (-not [System.IO.Path]::IsPathRooted($DataPath)) {
    throw 'DataPath must be an absolute Windows path.'
}

$resolvedDataPath = [System.IO.Path]::GetFullPath($DataPath)
if (-not (Test-Path -LiteralPath $resolvedDataPath -PathType Container)) {
    throw "DataPath must be an existing directory. Create it explicitly before generating kind config: $resolvedDataPath"
}

$templatePath = Join-Path $PSScriptRoot 'kind-cloudops-platform.yaml.template'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repositoryRoot '.local\kind'
$outputPath = Join-Path $outputDirectory 'cloudops-platform.yaml'

if (Test-Path -LiteralPath $outputPath) {
    throw "Refusing to overwrite existing kind config: $outputPath"
}

# Forward slashes and YAML single-quote escaping keep Windows paths valid in YAML.
$yamlDataPath = $resolvedDataPath.Replace('\', '/').Replace("'", "''")
$template = [System.IO.File]::ReadAllText($templatePath)
$rendered = $template.Replace('__CLOUDOPS_KIND_DATA_DIR__', $yamlDataPath)

if ($rendered -eq $template) {
    throw "The kind config template does not contain the expected host path token: $templatePath"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
[System.IO.File]::WriteAllText(
    $outputPath,
    $rendered,
    [System.Text.UTF8Encoding]::new($false)
)
Write-Output "Generated kind config: $outputPath"
