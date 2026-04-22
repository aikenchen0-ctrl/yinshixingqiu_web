[CmdletBinding()]
param(
  [string]$ProjectRoot = "D:\CodeDevelopment\xueyinMiniapp",
  [int]$LogServerPort = 18766,
  [int]$MinPasses = 2,
  [int]$MaxPasses = 2,
  [int]$PassTimeoutMinutes = 30,
  [switch]$UseSearch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$outputRoot = Join-Path $ProjectRoot ".codex-headless"
$telemetryDir = Join-Path $outputRoot "telemetry"
New-Item -ItemType Directory -Path $telemetryDir -Force | Out-Null

$logServerOut = Join-Path $telemetryDir "log-server.out.log"
$logServerErr = Join-Path $telemetryDir "log-server.err.log"
$runnerOut = Join-Path $telemetryDir "runner.out.log"
$runnerErr = Join-Path $telemetryDir "runner.err.log"

$existing = Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and (
    $_.CommandLine -match 'codex-headless-log-server\.js' -or
    $_.CommandLine -match 'run-codex-serial-headless\.ps1' -or
    $_.CommandLine -match 'start-codex-serial-headless\.ps1'
  )
}
foreach ($proc in $existing) {
  if ($proc.ProcessId -ne $PID) {
    try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop } catch {}
  }
}

$env:CODEX_HEADLESS_LOG_PORT = [string]$LogServerPort
$env:CODEX_HEADLESS_PROJECT_ROOT = $ProjectRoot

$logServer = Start-Process `
  -FilePath "D:\CodeTools\nodejs\node.exe" `
  -ArgumentList @(".\scripts\codex-headless-log-server.js") `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput $logServerOut `
  -RedirectStandardError $logServerErr `
  -PassThru

Start-Sleep -Seconds 2

$health = $null
for ($i = 0; $i -lt 10; $i++) {
  try {
    $health = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:$LogServerPort/health"
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (-not $health) {
  throw "Log server failed to start on port $LogServerPort. Check $logServerErr"
}

$runnerArgs = @(
  "-NoProfile",
  "-File", ".\scripts\run-codex-serial-headless.ps1",
  "-LogServerPort", "$LogServerPort",
  "-MinPasses", "$MinPasses",
  "-MaxPasses", "$MaxPasses",
  "-PassTimeoutMinutes", "$PassTimeoutMinutes"
)
if ($UseSearch.IsPresent) {
  $runnerArgs += "-UseSearch"
}

$runner = Start-Process `
  -FilePath "C:\Program Files\PowerShell\7\pwsh.exe" `
  -ArgumentList $runnerArgs `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput $runnerOut `
  -RedirectStandardError $runnerErr `
  -PassThru

[pscustomobject]@{
  LogServerPid = $logServer.Id
  RunnerPid = $runner.Id
  LogServerUrl = "http://127.0.0.1:$LogServerPort/health"
  LatestEventUrl = "http://127.0.0.1:$LogServerPort/latest"
  LogServerOut = $logServerOut
  LogServerErr = $logServerErr
  RunnerOut = $runnerOut
  RunnerErr = $runnerErr
  RunnerState = (Join-Path $outputRoot "runner-state.json")
} | Format-List
