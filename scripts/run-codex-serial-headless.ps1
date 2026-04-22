[CmdletBinding()]
param(
  [string]$ProjectRoot = "D:\CodeDevelopment\xueyinMiniapp",
  [string]$PromptDir = "D:\CodeDevelopment\xueyinMiniapp\docs\serial-prompts",
  [string]$OutputRoot = "D:\CodeDevelopment\xueyinMiniapp\.codex-headless",
  [int]$MinPasses = 2,
  [int]$MaxPasses = 2,
  [int]$PassTimeoutMinutes = 12,
  [int]$LogServerPort = 18766,
  [string]$Model = "",
  [switch]$UseSearch,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Message)
  Write-Host ""
  Write-Host "==== $Message ====" -ForegroundColor Cyan
}

function Assert-PathExists {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label not found: $Path"
  }
}

function Assert-ValidPassConfig {
  param(
    [int]$MinimumPasses,
    [int]$MaximumPasses,
    [int]$TimeoutMinutes
  )

  if ($MinimumPasses -lt 1) {
    throw "MinPasses must be greater than or equal to 1."
  }

  if ($MaximumPasses -lt 1) {
    throw "MaxPasses must be greater than or equal to 1."
  }

  if ($MinimumPasses -gt $MaximumPasses) {
    throw "MinPasses cannot be greater than MaxPasses."
  }

  if ($TimeoutMinutes -lt 1) {
    throw "PassTimeoutMinutes must be greater than or equal to 1."
  }
}

function Resolve-CodexCommand {
  $candidates = @(
    (Get-Command codex.cmd -ErrorAction SilentlyContinue),
    (Get-Command codex.ps1 -ErrorAction SilentlyContinue),
    (Get-Command codex -ErrorAction SilentlyContinue)
  ) | Where-Object { $_ } | Select-Object -Unique

  foreach ($candidate in $candidates) {
    if ($candidate.Path -and (Test-Path -LiteralPath $candidate.Path)) {
      return $candidate.Path
    }
  }

  throw "Unable to find a runnable Codex CLI command. Install Codex CLI or add codex.cmd/codex.ps1 to PATH."
}

function Get-CodexBaseCommand {
  $codexCommand = Resolve-CodexCommand
  $codexHelp = & $codexCommand --help 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to run codex --help. Make sure Codex CLI is installed and available in PATH."
  }

  $supportsYolo = $codexHelp -match '(^|\s)--yolo(\s|$)'
  if ($supportsYolo) {
    return @($codexCommand, "--yolo", "exec")
  }

  return @($codexCommand, "exec", "--dangerously-bypass-approvals-and-sandbox")
}

function Get-PromptFiles {
  param([string]$Directory)

  Get-ChildItem -LiteralPath $Directory -File |
    Where-Object { $_.Name -match '^\d{2}-.*\.md$' } |
    Sort-Object Name
}

function Initialize-OutputDirs {
  param([string]$Root)

  foreach ($dir in @($Root, (Join-Path $Root "runs"), (Join-Path $Root "summaries"), (Join-Path $Root "tmp"), (Join-Path $Root "telemetry"))) {
    if (-not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir | Out-Null
    }
  }
}

function Update-RunnerState {
  param(
    [string]$StatePath,
    [hashtable]$State
  )

  $json = $State | ConvertTo-Json -Depth 6
  Set-Content -LiteralPath $StatePath -Value $json -Encoding UTF8
}

function Convert-ToSingleQuotedLiteral {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function New-EncodedCommand {
  param([string]$ScriptText)
  return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($ScriptText))
}

function Publish-LogEvent {
  param(
    [string]$LogServerUrl,
    [hashtable]$Event,
    [string]$FallbackLogPath
  )

  $payload = $Event | ConvertTo-Json -Depth 8 -Compress
  Add-Content -LiteralPath $FallbackLogPath -Value $payload -Encoding UTF8

  try {
    Invoke-RestMethod -Method Post -Uri $LogServerUrl -ContentType "application/json; charset=utf-8" -Body $payload | Out-Null
  } catch {
    # Keep local fallback logging even if the local log server is unavailable.
  }
}

function Stop-OrphanedRunnerProcesses {
  param([string]$ProjectRootPath)

  $currentPid = $PID
  $processes = Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $currentPid -and
    $_.CommandLine -and (
      $_.CommandLine -match 'run-codex-serial-headless\.ps1' -or
      $_.CommandLine -match [regex]::Escape("$ProjectRootPath\.codex-headless") -or
      $_.CommandLine -match [regex]::Escape("$ProjectRootPath\\.codex-headless") -or
      $_.CommandLine -match '--output-last-message'
    )
  }

  foreach ($process in $processes) {
    try {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    } catch {
      # Ignore cleanup failures and let the next run proceed.
    }
  }
}

function Get-LatestSummaryText {
  param([string]$SummaryDir)

  if (-not (Test-Path -LiteralPath $SummaryDir)) {
    return ""
  }

  $latest = Get-ChildItem -LiteralPath $SummaryDir -File |
    Where-Object { $_.Extension -eq ".md" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $latest) {
    return ""
  }

  return Get-Content -LiteralPath $latest.FullName -Raw -Encoding UTF8
}

function Get-PassFeedbackText {
  param([string]$PromptRunDir)

  if (-not (Test-Path -LiteralPath $PromptRunDir)) {
    return ""
  }

  $passes = Get-ChildItem -LiteralPath $PromptRunDir -Directory |
    Where-Object { $_.Name -match '^pass-\d+$' } |
    Sort-Object Name

  if (-not $passes) {
    return ""
  }

  $buffer = New-Object System.Collections.Generic.List[string]
  foreach ($pass in $passes) {
    $resultPath = Join-Path $pass.FullName "result.md"
    if (Test-Path -LiteralPath $resultPath) {
      $buffer.Add("## $($pass.Name)")
      $buffer.Add((Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8))
    }
  }

  return ($buffer -join "`r`n`r`n")
}

function Get-StatusFromResult {
  param([string]$ResultText)

  $match = [regex]::Match($ResultText, 'FINAL_STATUS:\s*(COMPLETE|PARTIAL|BLOCKED)', 'IgnoreCase')
  if ($match.Success) {
    return $match.Groups[1].Value.ToUpperInvariant()
  }

  return "PARTIAL"
}

function Get-QualityScoreFromResult {
  param([string]$ResultText)

  $match = [regex]::Match($ResultText, 'QUALITY_SCORE:\s*([1-5])', 'IgnoreCase')
  if ($match.Success) {
    return [int]$match.Groups[1].Value
  }

  return 0
}

function Write-RunPromptFile {
  param(
    [string]$PromptPath,
    [string]$PromptRunDir,
    [int]$PassIndex,
    [string]$PreviousPromptSummary,
    [string]$CurrentPromptFeedback
  )

  $basePrompt = Get-Content -LiteralPath $PromptPath -Raw -Encoding UTF8
  $promptName = [System.IO.Path]::GetFileNameWithoutExtension($PromptPath)
  $runPromptPath = Join-Path $PromptRunDir ("pass-{0}\input.md" -f $PassIndex)
  $passDir = Split-Path -Parent $runPromptPath

  if (-not (Test-Path -LiteralPath $passDir)) {
    New-Item -ItemType Directory -Path $passDir | Out-Null
  }

  $previousSummaryBlock = if ([string]::IsNullOrWhiteSpace($PreviousPromptSummary)) {
    "None"
  } else {
    $PreviousPromptSummary.Trim()
  }

  $feedbackBlock = if ([string]::IsNullOrWhiteSpace($CurrentPromptFeedback)) {
    "None"
  } else {
    $CurrentPromptFeedback.Trim()
  }

  $content = @"
# Codex Headless Run Context

Current step: $promptName
Current pass: $PassIndex
Project root: $ProjectRoot

## Execution Rules

- You are running in headless mode.
- Work directly in the repository instead of only giving advice.
- Focus on finishing the current prompt requirement.
- At the end of this pass, provide a clear completion status and quality score.
- If earlier passes already completed part of the work, continue from there instead of starting over.

## Previous Prompt Summary

$previousSummaryBlock

## Current Prompt Previous Pass Outputs

$feedbackBlock

## Current Prompt Body

$basePrompt

## Required Footer

Append the following machine-readable footer at the end of your final response:

FINAL_STATUS: COMPLETE | PARTIAL | BLOCKED
QUALITY_SCORE: 1-5
NEXT_ACTIONS:
- ...
CHANGED_FILES:
- ...
"@

  Set-Content -LiteralPath $runPromptPath -Value $content -Encoding UTF8
  return $runPromptPath
}

function Invoke-CodexPass {
  param(
    [string[]]$CodexBaseCommand,
    [string]$InputPath,
    [string]$ProjectRootPath,
    [string]$PassDir,
    [int]$TimeoutMinutes,
    [string]$RunnerStatePath,
    [string]$PromptName,
    [int]$PassIndex
  )

  $resultPath = Join-Path $PassDir "result.md"
  $jsonLogPath = Join-Path $PassDir "events.jsonl"
  $stdoutPath = Join-Path $PassDir "stdout.log"
  $stderrPath = Join-Path $PassDir "stderr.log"
  $heartbeatPath = Join-Path $PassDir "heartbeat.json"
  $telemetryFallbackPath = Join-Path (Join-Path $OutputRoot "telemetry") "runner-events.ndjson"
  $logServerUrl = "http://127.0.0.1:$LogServerPort/event"

  $arguments = New-Object System.Collections.Generic.List[string]
  foreach ($arg in $CodexBaseCommand) {
    [void]$arguments.Add($arg)
  }

  if (-not [string]::IsNullOrWhiteSpace($Model)) {
    [void]$arguments.Add("--model")
    [void]$arguments.Add($Model)
  }

  [void]$arguments.Add("--config")
  [void]$arguments.Add("discoverables=false")

  if ($UseSearch.IsPresent) {
    [void]$arguments.Add("--search")
  }

  [void]$arguments.Add("--cd")
  [void]$arguments.Add($ProjectRootPath)
  [void]$arguments.Add("--json")
  [void]$arguments.Add("--output-last-message")
  [void]$arguments.Add($resultPath)
  [void]$arguments.Add("-")

  $inputText = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8

  if ($DryRun.IsPresent) {
    Set-Content -LiteralPath $stdoutPath -Value ("DRY RUN:`r`n" + ($arguments -join " ")) -Encoding UTF8
    Set-Content -LiteralPath $resultPath -Value @"
DRY RUN

FINAL_STATUS: PARTIAL
QUALITY_SCORE: 1
NEXT_ACTIONS:
- Run the script without -DryRun to invoke Codex.
CHANGED_FILES:
- None
"@ -Encoding UTF8
    return
  }

  $codexArgLiteral = ($arguments | ForEach-Object { Convert-ToSingleQuotedLiteral -Value $_ }) -join ", "
  $inputPathLiteral = Convert-ToSingleQuotedLiteral -Value $InputPath
  $childScript = @"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$promptText = Get-Content -LiteralPath $inputPathLiteral -Raw -Encoding UTF8
`$cmd = @($codexArgLiteral)
`$promptText | & `$cmd[0] @(`$cmd[1..(`$cmd.Count - 1)])
"@
  $encodedCommand = New-EncodedCommand -ScriptText $childScript

  $process = Start-Process `
    -FilePath "C:\Program Files\PowerShell\7\pwsh.exe" `
    -ArgumentList @("-NoProfile", "-EncodedCommand", $encodedCommand) `
    -WorkingDirectory $ProjectRootPath `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Publish-LogEvent -LogServerUrl $logServerUrl -FallbackLogPath $telemetryFallbackPath -Event @{
    type = "pass_started"
    prompt = $PromptName
    pass = $PassIndex
    pid = $process.Id
    started_at = (Get-Date).ToString("o")
    stdout = $stdoutPath
    stderr = $stderrPath
    result = $resultPath
  }

  $startedAt = Get-Date
  while (-not $process.HasExited) {
    $heartbeat = @{
      type = "heartbeat"
      prompt = $PromptName
      pass = $PassIndex
      pid = $process.Id
      started_at = $startedAt.ToString("o")
      checked_at = (Get-Date).ToString("o")
      timeout_minutes = $TimeoutMinutes
      status = "running"
    }
    Update-RunnerState -StatePath $heartbeatPath -State $heartbeat
    Update-RunnerState -StatePath $RunnerStatePath -State $heartbeat
    Publish-LogEvent -LogServerUrl $logServerUrl -FallbackLogPath $telemetryFallbackPath -Event $heartbeat

    if (((Get-Date) - $startedAt).TotalMinutes -ge $TimeoutMinutes) {
      try {
        Stop-Process -Id $process.Id -Force -ErrorAction Stop
      } catch {
      }
      Publish-LogEvent -LogServerUrl $logServerUrl -FallbackLogPath $telemetryFallbackPath -Event @{
        type = "pass_timeout"
        prompt = $PromptName
        pass = $PassIndex
        pid = $process.Id
        checked_at = (Get-Date).ToString("o")
        timeout_minutes = $TimeoutMinutes
        stderr = $stderrPath
      }
      throw "Codex execution timed out after $TimeoutMinutes minutes. Check $stderrPath"
    }

    Start-Sleep -Seconds 5
  }

  if (Test-Path -LiteralPath $stdoutPath) {
    Copy-Item -LiteralPath $stdoutPath -Destination $jsonLogPath -Force
  }

  $finalHeartbeat = @{
    type = "pass_finished"
    prompt = $PromptName
    pass = $PassIndex
    pid = $process.Id
    started_at = $startedAt.ToString("o")
    checked_at = (Get-Date).ToString("o")
    timeout_minutes = $TimeoutMinutes
    status = if ($process.ExitCode -eq 0) { "completed" } else { "failed" }
    exit_code = $process.ExitCode
  }
  Update-RunnerState -StatePath $heartbeatPath -State $finalHeartbeat
  Update-RunnerState -StatePath $RunnerStatePath -State $finalHeartbeat
  Publish-LogEvent -LogServerUrl $logServerUrl -FallbackLogPath $telemetryFallbackPath -Event $finalHeartbeat

  if ($process.ExitCode -ne 0) {
    throw "Codex execution failed with exit code $($process.ExitCode). Check $stderrPath"
  }

  if (-not (Test-Path -LiteralPath $resultPath)) {
    throw "Codex did not produce result.md. Check $stdoutPath and $stderrPath"
  }

  $stderrContent = if (Test-Path -LiteralPath $stderrPath) {
    Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8
  } else {
    ""
  }

  if (
    $stderrContent -match 'stream disconnected - retrying sampling request' -or
    $stderrContent -match 'startup remote plugin sync failed' -or
    $stderrContent -match 'failed to warm featured plugin ids cache' -or
    $stderrContent -match 'failed to load discoverable tool suggestions'
  ) {
    Publish-LogEvent -LogServerUrl $logServerUrl -FallbackLogPath $telemetryFallbackPath -Event @{
      type = "pass_network_warning"
      prompt = $PromptName
      pass = $PassIndex
      pid = $process.Id
      checked_at = (Get-Date).ToString("o")
      stderr = $stderrPath
    }
  }
}

function Write-PromptSummary {
  param(
    [string]$PromptName,
    [string]$PromptRunDir,
    [string]$SummaryDir
  )

  $latestPass = Get-ChildItem -LiteralPath $PromptRunDir -Directory |
    Where-Object { $_.Name -match '^pass-\d+$' } |
    Sort-Object Name -Descending |
    Select-Object -First 1

  if (-not $latestPass) {
    throw "No pass directories found in $PromptRunDir"
  }

  $resultPath = Join-Path $latestPass.FullName "result.md"
  $resultText = Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8
  $summaryPath = Join-Path $SummaryDir ("{0}.summary.md" -f $PromptName)

  $summary = @"
# $PromptName Summary

Source pass: $($latestPass.Name)

$resultText
"@

  Set-Content -LiteralPath $summaryPath -Value $summary -Encoding UTF8
  return $summaryPath
}

Assert-PathExists -Path $ProjectRoot -Label "项目根目录"
Assert-PathExists -Path $PromptDir -Label "提示词目录"
Assert-ValidPassConfig -MinimumPasses $MinPasses -MaximumPasses $MaxPasses -TimeoutMinutes $PassTimeoutMinutes
Initialize-OutputDirs -Root $OutputRoot
Stop-OrphanedRunnerProcesses -ProjectRootPath $ProjectRoot

$runsDir = Join-Path $OutputRoot "runs"
$summariesDir = Join-Path $OutputRoot "summaries"
$runnerStatePath = Join-Path $OutputRoot "runner-state.json"
$telemetryFallbackPath = Join-Path (Join-Path $OutputRoot "telemetry") "runner-events.ndjson"
$codexBaseCommand = if ($DryRun.IsPresent) {
  @("codex", "exec", "--dangerously-bypass-approvals-and-sandbox")
} else {
  Get-CodexBaseCommand
}
$promptFiles = Get-PromptFiles -Directory $PromptDir

if (-not $promptFiles -or $promptFiles.Count -eq 0) {
  throw "No serial prompt files were found in $PromptDir."
}

Write-Section "Codex Serial Headless Runner"
Write-Host "Project root: $ProjectRoot"
Write-Host "Prompt dir: $PromptDir"
Write-Host "Output root: $OutputRoot"
Write-Host "Min passes: $MinPasses"
Write-Host "Max passes: $MaxPasses"
Write-Host "Pass timeout minutes: $PassTimeoutMinutes"
Write-Host "Log server port: $LogServerPort"
Write-Host "Codex command: $($codexBaseCommand -join ' ')"
Write-Host "DryRun: $($DryRun.IsPresent)"

Publish-LogEvent -LogServerUrl ("http://127.0.0.1:$LogServerPort/event") -FallbackLogPath $telemetryFallbackPath -Event @{
  type = "runner_started"
  started_at = (Get-Date).ToString("o")
  project_root = $ProjectRoot
  prompt_dir = $PromptDir
  min_passes = $MinPasses
  max_passes = $MaxPasses
  pass_timeout_minutes = $PassTimeoutMinutes
  dry_run = [bool]$DryRun.IsPresent
}

$globalSummaryText = ""

foreach ($promptFile in $promptFiles) {
  $promptName = [System.IO.Path]::GetFileNameWithoutExtension($promptFile.Name)
  $promptRunDir = Join-Path $runsDir $promptName

  if (-not (Test-Path -LiteralPath $promptRunDir)) {
    New-Item -ItemType Directory -Path $promptRunDir | Out-Null
  }

  Write-Section "Running $promptName"

  $currentPromptFeedback = ""
  $finalStatus = "PARTIAL"
  $finalScore = 0

  for ($pass = 1; $pass -le $MaxPasses; $pass++) {
    $inputPath = Write-RunPromptFile `
      -PromptPath $promptFile.FullName `
      -PromptRunDir $promptRunDir `
      -PassIndex $pass `
      -PreviousPromptSummary $globalSummaryText `
      -CurrentPromptFeedback $currentPromptFeedback

    $passDir = Split-Path -Parent $inputPath
    Write-Host "Running $promptName / pass-$pass"

    try {
      Invoke-CodexPass `
        -CodexBaseCommand $codexBaseCommand `
        -InputPath $inputPath `
        -ProjectRootPath $ProjectRoot `
        -PassDir $passDir `
        -TimeoutMinutes $PassTimeoutMinutes `
        -RunnerStatePath $runnerStatePath `
        -PromptName $promptName `
        -PassIndex $pass
    } catch {
      $errorMessage = $_.Exception.Message
      Publish-LogEvent -LogServerUrl ("http://127.0.0.1:$LogServerPort/event") -FallbackLogPath $telemetryFallbackPath -Event @{
        type = "pass_failed"
        prompt = $promptName
        pass = $pass
        checked_at = (Get-Date).ToString("o")
        message = $errorMessage
      }

      if ($pass -lt $MaxPasses) {
        Write-Host "pass-$pass failed: $errorMessage"
        Write-Host "Retrying with the next pass."
        continue
      }

      throw
    }

    $resultPath = Join-Path $passDir "result.md"
    $resultText = Get-Content -LiteralPath $resultPath -Raw -Encoding UTF8
    $finalStatus = Get-StatusFromResult -ResultText $resultText
    $finalScore = Get-QualityScoreFromResult -ResultText $resultText
    $currentPromptFeedback = Get-PassFeedbackText -PromptRunDir $promptRunDir

    Write-Host "pass-$pass status: $finalStatus | quality: $finalScore"

    if ($pass -ge $MinPasses -and $finalStatus -eq "COMPLETE" -and $finalScore -ge 4) {
      Write-Host "Early stop condition reached. Moving to the next prompt."
      break
    }
  }

  $summaryPath = Write-PromptSummary `
    -PromptName $promptName `
    -PromptRunDir $promptRunDir `
    -SummaryDir $summariesDir

  $globalSummaryText = Get-Content -LiteralPath $summaryPath -Raw -Encoding UTF8
  Write-Host "Summary written: $summaryPath"
}

Write-Section "All serial prompts completed"
Write-Host "See output root: $OutputRoot"
Publish-LogEvent -LogServerUrl ("http://127.0.0.1:$LogServerPort/event") -FallbackLogPath $telemetryFallbackPath -Event @{
  type = "runner_finished"
  finished_at = (Get-Date).ToString("o")
  output_root = $OutputRoot
}
