param(
  [string]$Domain = "xueyin.net.cn",
  [string]$AdminName = "血饮 Boss",
  [string]$AdminEmail = "",
  [string]$AdminPassword = "",
  [string]$WebUiSecret = "",
  [string]$HermesApiServerKey = "",
  [string]$BackendEnvPath = "..\\.env",
  [string]$OutputPath = ".env.openwebui-hermes-docker"
)

$ErrorActionPreference = "Stop"

function New-HexSecret([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return ([System.BitConverter]::ToString($buffer)).Replace("-", "").ToLowerInvariant()
}

function Read-EnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) {
    return ""
  }

  $pattern = "^$([regex]::Escape($Key))=(.*)$"
  $match = Select-String -Path $Path -Pattern $pattern | Select-Object -Last 1
  if (-not $match) {
    return ""
  }

  $value = $match.Matches[0].Groups[1].Value.Trim()
  return $value.Trim('"')
}

$resolvedBackendEnvPath = Resolve-Path $BackendEnvPath
$llmApiKey = Read-EnvValue $resolvedBackendEnvPath "OPENAI_API_KEY"
$llmBaseUrl = Read-EnvValue $resolvedBackendEnvPath "OPENAI_BASE_URL"
$llmModel = Read-EnvValue $resolvedBackendEnvPath "OPENAI_MODEL"

if ([string]::IsNullOrWhiteSpace($llmApiKey)) {
  throw "OPENAI_API_KEY not found in $resolvedBackendEnvPath"
}

if ([string]::IsNullOrWhiteSpace($llmBaseUrl)) {
  $llmBaseUrl = "https://api.openai.com/v1"
}

if ([string]::IsNullOrWhiteSpace($llmModel)) {
  $llmModel = "gpt-4.1-mini"
}

if ([string]::IsNullOrWhiteSpace($AdminEmail)) {
  $AdminEmail = "admin@$Domain"
}

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
  $AdminPassword = New-HexSecret 12
}

if ([string]::IsNullOrWhiteSpace($WebUiSecret)) {
  $WebUiSecret = New-HexSecret 32
}

if ([string]::IsNullOrWhiteSpace($HermesApiServerKey)) {
  $HermesApiServerKey = New-HexSecret 24
}

$content = @(
  "WEBUI_URL=https://$Domain/boss"
  "CORS_ALLOW_ORIGIN=https://$Domain"
  "WEBUI_SESSION_COOKIE_SECURE=true"
  "WEBUI_AUTH_COOKIE_SECURE=true"
  "WEBUI_SESSION_COOKIE_SAME_SITE=lax"
  "WEBUI_AUTH_COOKIE_SAME_SITE=lax"
  "ENABLE_SIGNUP=false"
  "ENABLE_LOGIN_FORM=true"
  "WEBUI_ADMIN_NAME=$AdminName"
  "WEBUI_ADMIN_EMAIL=$AdminEmail"
  "WEBUI_ADMIN_PASSWORD=$AdminPassword"
  "WEBUI_SECRET_KEY=$WebUiSecret"
  "HERMES_API_SERVER_KEY=$HermesApiServerKey"
  "HERMES_LLM_BASE_URL=$llmBaseUrl"
  "HERMES_LLM_API_KEY=$llmApiKey"
  "HERMES_LLM_MODEL=$llmModel"
  "GLOBAL_LOG_LEVEL=INFO"
)

Set-Content -Path $OutputPath -Value $content -Encoding ASCII

Write-Host "Generated $OutputPath"
Write-Host "Admin email: $AdminEmail"
Write-Host "Admin password: $AdminPassword"
