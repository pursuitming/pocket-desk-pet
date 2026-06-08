$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"

if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}

Set-Location $projectRoot
npm.cmd run tauri -- build
exit $LASTEXITCODE
