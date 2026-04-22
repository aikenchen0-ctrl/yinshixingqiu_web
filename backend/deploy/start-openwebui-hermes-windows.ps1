param(
  [string]$EnvPath = ".env.openwebui-hermes-docker",
  [string]$VenvPath = ".openwebui-venv",
  [string]$DataDir = ".openwebui-data",
  [string]$LogPath = ".openwebui.log",
  [string]$ErrorLogPath = ".openwebui.err.log",
  [string]$PidPath = ".openwebui.pid",
  [string]$ListenHost = "127.0.0.1",
  [int]$Port = 8081,
  [switch]$Restart
)

$ErrorActionPreference = "Stop"

function Resolve-ScriptPath([string]$Path) {
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }

  return Join-Path $PSScriptRoot $Path
}

function Read-EnvFile([string]$Path) {
  $map = @{}
  foreach ($line in Get-Content $Path) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    if ($line.TrimStart().StartsWith("#")) {
      continue
    }

    $pair = $line.Split("=", 2)
    if ($pair.Count -ne 2) {
      continue
    }

    $map[$pair[0].Trim()] = $pair[1].Trim()
  }

  return $map
}

function Get-EnvValue([hashtable]$Map, [string]$Key, [string]$Default = "") {
  if ($Map.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($Map[$Key])) {
    return $Map[$Key]
  }

  return $Default
}

function Get-RunningProcess([string]$Path) {
  if (-not (Test-Path $Path)) {
    return $null
  }

  $rawPid = (Get-Content $Path -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($rawPid -notmatch '^\d+$') {
    return $null
  }

  return Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
}

$resolvedEnvPath = Resolve-ScriptPath $EnvPath
$resolvedVenvPath = Resolve-ScriptPath $VenvPath
$resolvedDataDir = Resolve-ScriptPath $DataDir
$resolvedLogPath = Resolve-ScriptPath $LogPath
$resolvedErrorLogPath = Resolve-ScriptPath $ErrorLogPath
$resolvedPidPath = Resolve-ScriptPath $PidPath
$resolvedAppPath = Join-Path $PSScriptRoot "openwebui_windows_app.py"
$probeHost = $ListenHost
if ($probeHost -eq "0.0.0.0" -or $probeHost -eq "::" -or $probeHost -eq "[::]") {
  $probeHost = "127.0.0.1"
}

if (-not (Test-Path $resolvedEnvPath)) {
  throw "Missing env file: $resolvedEnvPath"
}

if (-not (Test-Path $resolvedAppPath)) {
  throw "Missing app wrapper: $resolvedAppPath"
}

$existingProcess = Get-RunningProcess $resolvedPidPath
if ($existingProcess) {
  if (-not $Restart) {
    Write-Host "Open WebUI already running with PID $($existingProcess.Id)"
    exit 0
  }

  Stop-Process -Id $existingProcess.Id -Force
  Start-Sleep -Seconds 2
}

New-Item -ItemType Directory -Force $resolvedDataDir | Out-Null

$venvPython = Join-Path $resolvedVenvPath "Scripts\\python.exe"
if (-not (Test-Path $venvPython)) {
  python -m venv $resolvedVenvPath
}

$venvOpenWebUI = Join-Path $resolvedVenvPath "Scripts\\open-webui.exe"
if (-not (Test-Path $venvOpenWebUI)) {
  & $venvPython -m pip install --upgrade pip | Out-Null
  & $venvPython -m pip install --upgrade open-webui
}

if (-not (Test-Path $venvOpenWebUI)) {
  throw "Missing Open WebUI launcher: $venvOpenWebUI"
}

$venvBuildDir = Join-Path $resolvedVenvPath "Lib\\build"
$packagedFrontendDir = Join-Path $resolvedVenvPath "Lib\\site-packages\\open_webui\\frontend"
if (
  (-not (Test-Path (Join-Path $venvBuildDir "index.html"))) -and
  (Test-Path (Join-Path $packagedFrontendDir "index.html"))
) {
  New-Item -ItemType Directory -Force $venvBuildDir | Out-Null
  Copy-Item (Join-Path $packagedFrontendDir "*") $venvBuildDir -Recurse -Force
}

$envMap = Read-EnvFile $resolvedEnvPath

$env:HOST = $ListenHost
$env:PORT = "$Port"
$env:DATA_DIR = $resolvedDataDir
$env:WEBUI_URL = $envMap["WEBUI_URL"]
$env:CORS_ALLOW_ORIGIN = $envMap["CORS_ALLOW_ORIGIN"]
$env:WEBUI_SESSION_COOKIE_SECURE = $envMap["WEBUI_SESSION_COOKIE_SECURE"]
$env:WEBUI_AUTH_COOKIE_SECURE = $envMap["WEBUI_AUTH_COOKIE_SECURE"]
$env:WEBUI_SESSION_COOKIE_SAME_SITE = $envMap["WEBUI_SESSION_COOKIE_SAME_SITE"]
$env:WEBUI_AUTH_COOKIE_SAME_SITE = $envMap["WEBUI_AUTH_COOKIE_SAME_SITE"]
$env:ENABLE_SIGNUP = $envMap["ENABLE_SIGNUP"]
$env:ENABLE_LOGIN_FORM = $envMap["ENABLE_LOGIN_FORM"]
$env:WEBUI_ADMIN_NAME = $envMap["WEBUI_ADMIN_NAME"]
$env:WEBUI_ADMIN_EMAIL = $envMap["WEBUI_ADMIN_EMAIL"]
$env:WEBUI_ADMIN_PASSWORD = $envMap["WEBUI_ADMIN_PASSWORD"]
$env:WEBUI_SECRET_KEY = $envMap["WEBUI_SECRET_KEY"]
$env:GLOBAL_LOG_LEVEL = $envMap["GLOBAL_LOG_LEVEL"]
$env:OPENAI_API_BASE_URL = "http://127.0.0.1:8642/v1"
$env:OPENAI_API_KEY = $envMap["HERMES_API_SERVER_KEY"]
$env:RAG_EMBEDDING_ENGINE = Get-EnvValue $envMap "RAG_EMBEDDING_ENGINE" "openai"
$env:RAG_EMBEDDING_MODEL = Get-EnvValue $envMap "RAG_EMBEDDING_MODEL" "BAAI/bge-m3"
$env:RAG_OPENAI_API_BASE_URL = Get-EnvValue $envMap "RAG_OPENAI_API_BASE_URL" $envMap["HERMES_LLM_BASE_URL"]
$env:RAG_OPENAI_API_KEY = Get-EnvValue $envMap "RAG_OPENAI_API_KEY" $envMap["HERMES_LLM_API_KEY"]
$env:RAG_EMBEDDING_BATCH_SIZE = Get-EnvValue $envMap "RAG_EMBEDDING_BATCH_SIZE" "8"
$env:RAG_EMBEDDING_CONCURRENT_REQUESTS = Get-EnvValue $envMap "RAG_EMBEDDING_CONCURRENT_REQUESTS" "2"
$env:RAG_EMBEDDING_MODEL_AUTO_UPDATE = "false"
$env:ENABLE_OLLAMA_API = "false"
$env:ENABLE_PIP_INSTALL_FRONTMATTER_REQUIREMENTS = Get-EnvValue $envMap "ENABLE_PIP_INSTALL_FRONTMATTER_REQUIREMENTS" "false"
$env:SAFE_MODE = Get-EnvValue $envMap "SAFE_MODE" "true"
$env:OFFLINE_MODE = Get-EnvValue $envMap "OFFLINE_MODE" "true"
$env:ENABLE_VERSION_UPDATE_CHECK = Get-EnvValue $envMap "ENABLE_VERSION_UPDATE_CHECK" "false"
$env:HF_HUB_DISABLE_TELEMETRY = "1"
$env:USER_AGENT = Get-EnvValue $envMap "USER_AGENT" "xueyin-boss-openwebui"

if (Test-Path $resolvedLogPath) {
  Remove-Item $resolvedLogPath -Force
}

if (Test-Path $resolvedErrorLogPath) {
  Remove-Item $resolvedErrorLogPath -Force
}

$process = Start-Process `
  -FilePath $venvPython `
  -ArgumentList @(
    "-m",
    "uvicorn",
    "openwebui_windows_app:application",
    "--host",
    $ListenHost,
    "--port",
    "$Port",
    "--lifespan",
    "off"
  ) `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput $resolvedLogPath `
  -RedirectStandardError $resolvedErrorLogPath `
  -PassThru

Set-Content -Path $resolvedPidPath -Value "$($process.Id)" -Encoding ASCII

for ($index = 0; $index -lt 30; $index++) {
  Start-Sleep -Seconds 2

  if ($process.HasExited) {
    throw "Open WebUI exited early. Check $resolvedLogPath and $resolvedErrorLogPath"
  }

  try {
    Invoke-WebRequest -Uri "http://$probeHost`:$Port/" -Method Head -TimeoutSec 2 | Out-Null
    Write-Host "Open WebUI listening at http://$ListenHost`:$Port"
    Write-Host "PID: $($process.Id)"
    exit 0
  } catch {
    continue
  }
}

Write-Host "Open WebUI started with PID $($process.Id), still warming up."
