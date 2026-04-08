param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$debugDir = Join-Path $root "src-tauri\target\debug"
$exePath = Join-Path $debugDir "MTCode.exe"
$runtimeDir = Join-Path $debugDir "webview2-fixed-runtime"
$portableRoot = Join-Path $root "artifacts\portable\MTCode-portable-debug"
$zipPath = Join-Path $root "artifacts\MTCode-portable-debug.zip"

if (-not $SkipBuild) {
  Push-Location $root
  try {
    npm run tauri -- build --debug
    if ($LASTEXITCODE -ne 0) { throw "tauri debug build failed with exit code $LASTEXITCODE" }
  }
  finally {
    Pop-Location
  }
}

if (-not (Test-Path $exePath)) {
  throw "MTCode.exe not found: $exePath"
}
if (-not (Test-Path $runtimeDir)) {
  throw "webview2-fixed-runtime not found: $runtimeDir"
}

New-Item -ItemType Directory -Force -Path (Split-Path $portableRoot) | Out-Null
if (Test-Path $portableRoot) {
  Remove-Item -LiteralPath $portableRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null

Copy-Item -LiteralPath $exePath -Destination $portableRoot -Force
Copy-Item -LiteralPath $runtimeDir -Destination (Join-Path $portableRoot "webview2-fixed-runtime") -Recurse -Force

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $portableRoot "*") -DestinationPath $zipPath -Force

Write-Host "Portable folder: $portableRoot"
Write-Host "Portable zip: $zipPath"


