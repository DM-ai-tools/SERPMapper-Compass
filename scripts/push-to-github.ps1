# Push this project to https://github.com/DM-ai-tools/SERPMapper-Compass
# Requires: Git for Windows — https://git-scm.com/download/win
# From repo root:  powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
# If push is rejected (remote has different history):  .\scripts\push-to-github.ps1 -ForceRemote

param(
  [switch]$ForceRemote
)

$ErrorActionPreference = "Stop"
$Remote = "https://github.com/DM-ai-tools/SERPMapper-Compass.git"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root
Write-Host "Root: $Root"

$gitExe = $null
if (Get-Command git -ErrorAction SilentlyContinue) {
  $gitExe = "git"
} else {
  foreach ($p in @("C:\Program Files\Git\cmd\git.exe", "C:\Program Files\Git\bin\git.exe")) {
    if (Test-Path $p) { $gitExe = $p; break }
  }
}
if (-not $gitExe) {
  Write-Error "git not found. Install Git for Windows, restart the terminal, then run this script again."
  exit 1
}

function G { & $gitExe @args }

if (-not (Test-Path ".git")) { G init }
G add -A
$status = G status --porcelain
if ($status) {
  G commit -m "SERPMapper Compass: full project"
} else {
  Write-Host "Nothing to commit."
}

G branch -M main 2>$null

$remotes = @(G remote) -join "`n"
if ($remotes -notmatch "origin") {
  G remote add origin $Remote
} else {
  G remote set-url origin $Remote
}

if ($ForceRemote) {
  Write-Warning "Force-pushing main (replaces remote main history)."
  G push -u origin main --force
} else {
  G push -u origin main
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Push failed. If the repo already has commits (e.g. only LICENSE), run:"
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1 -ForceRemote"
  }
}

Write-Host "Remote: $Remote"
