[CmdletBinding()]
param(
  [string]$ProjectRoot = "D:\CodeDevelopment\xueyinMiniapp",
  [string]$PromptDirectory = "D:\CodeDevelopment\xueyinMiniapp\ai-finish-plan",
  [string]$OutputRoot = "D:\CodeDevelopment\xueyinMiniapp\.codex-ai-finish-plan-runs",
  [int]$ExecutionCountPerPrompt = 2,
  [int]$TimeoutMinutesPerExecution = 5,
  [int]$MaxResumeAttemptsPerExecution = 12,
  [string]$Model = "",
  [switch]$UseSearch
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

function Assert-ValidExecutionConfig {
  param(
    [int]$ExecutionCount,
    [int]$TimeoutMinutes,
    [int]$MaximumResumeAttempts
  )

  if ($ExecutionCount -ne 2) {
    throw "ExecutionCountPerPrompt must be exactly 2."
  }

  if ($TimeoutMinutes -lt 1) {
    throw "TimeoutMinutesPerExecution must be greater than or equal to 1."
  }

  if ($MaximumResumeAttempts -lt 1) {
    throw "MaxResumeAttemptsPerExecution must be greater than or equal to 1."
  }
}

function Resolve-CodexCommandPath {
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

  throw "Unable to find Codex CLI. Install codex.cmd/codex.ps1 or add codex to PATH."
}

function Get-FullAutonomousExecutionCommand {
  $codexCommandPath = Resolve-CodexCommandPath
  $codexHelp = & $codexCommandPath --help 2>&1 | Out-String
  $codexExecHelp = & $codexCommandPath exec --help 2>&1 | Out-String

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to run codex --help."
  }

  $supportsYoloFlag = ($codexHelp -match '(^|\s)--yolo(\s|$)') -or ($codexExecHelp -match '(^|\s)--yolo(\s|$)')
  if ($supportsYoloFlag) {
    return @($codexCommandPath, "--yolo", "exec")
  }

  $supportsFullAutoFlag = ($codexHelp -match '(^|\s)--full-auto(\s|$)') -or ($codexExecHelp -match '(^|\s)--full-auto(\s|$)')
  if ($supportsFullAutoFlag) {
    return @($codexCommandPath, "exec", "--full-auto")
  }

  return @($codexCommandPath, "exec", "--dangerously-bypass-approvals-and-sandbox")
}

function Get-PromptFiles {
  param([string]$Directory)

  return @(Get-ChildItem -LiteralPath $Directory -File -Filter "*.md" | Sort-Object Name)
}

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Convert-ToSingleQuotedLiteral {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function New-EncodedCommand {
  param([string]$ScriptText)
  return [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($ScriptText))
}

function Write-ProgressSnapshot {
  param(
    [string]$TelemetryDirectory,
    [hashtable]$Snapshot
  )

  Ensure-Directory -Path $TelemetryDirectory
  $jsonPath = Join-Path $TelemetryDirectory "progress.json"
  $logPath = Join-Path $TelemetryDirectory "progress.log"
  $Snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

  $logLine = "[{0}] prompt {1}/{2} | execution {3}/{4} | attempt {5} | status={6} | elapsed={7}s | promptFile={8}" -f `
    (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), `
    $Snapshot.prompt_index, `
    $Snapshot.prompt_total, `
    $Snapshot.execution_index, `
    $Snapshot.execution_total, `
    $Snapshot.attempt_index, `
    $Snapshot.status, `
    $Snapshot.elapsed_seconds, `
    $Snapshot.prompt_name

  Add-Content -LiteralPath $logPath -Value $logLine -Encoding UTF8
}

function Get-ThreadIdFromJsonLog {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $lines = Get-Content -LiteralPath $Path -Encoding UTF8
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    try {
      $event = $line | ConvertFrom-Json -ErrorAction Stop
      if ($event.type -eq "thread.started" -and $event.thread_id) {
        return [string]$event.thread_id
      }
    } catch {
      # Ignore non-JSON lines.
    }
  }

  return $null
}

function New-CodexArgumentList {
  param(
    [string[]]$BaseCommand,
    [string]$ProjectRootPath,
    [string]$ResultPath,
    [string]$SelectedModel,
    [bool]$SearchEnabled,
    [string]$Mode,
    [string]$ResumeThreadId
  )

  $arguments = New-Object System.Collections.Generic.List[string]
  foreach ($argument in $BaseCommand) {
    [void]$arguments.Add($argument)
  }

  if ($Mode -eq "resume") {
    [void]$arguments.Add("resume")
    [void]$arguments.Add($ResumeThreadId)
  }

  if (-not [string]::IsNullOrWhiteSpace($SelectedModel)) {
    [void]$arguments.Add("--model")
    [void]$arguments.Add($SelectedModel)
  }

  [void]$arguments.Add("--config")
  [void]$arguments.Add("discoverables=false")

  if ($SearchEnabled) {
    [void]$arguments.Add("--search")
  }

  [void]$arguments.Add("--cd")
  [void]$arguments.Add($ProjectRootPath)
  [void]$arguments.Add("--json")
  [void]$arguments.Add("--output-last-message")
  [void]$arguments.Add($ResultPath)
  [void]$arguments.Add("-")

  return $arguments
}

function Invoke-PromptExecution {
  param(
    [string[]]$BaseCommand,
    [string]$PromptPath,
    [string]$PromptName,
    [int]$PromptIndex,
    [int]$PromptTotal,
    [string]$ProjectRootPath,
    [string]$ExecutionDirectory,
    [string]$TelemetryDirectory,
    [int]$ExecutionIndex,
    [int]$ExecutionTotal,
    [int]$TimeoutMinutes,
    [int]$MaximumResumeAttempts,
    [string]$SelectedModel,
    [bool]$SearchEnabled
  )

  $resultPath = Join-Path $ExecutionDirectory "result.md"
  $metadataPath = Join-Path $ExecutionDirectory "metadata.json"
  $attempts = New-Object System.Collections.Generic.List[object]
  $resumeInstruction = "Continue from the interrupted session. Preserve prior context, continue the same task, and move toward completion without restarting from scratch."
  $resumeThreadId = $null
  $mode = "initial"

  for ($attemptIndex = 1; $attemptIndex -le $MaximumResumeAttempts; $attemptIndex++) {
    $stdoutPath = Join-Path $ExecutionDirectory ("stdout-attempt-{0:D2}.log" -f $attemptIndex)
    $stderrPath = Join-Path $ExecutionDirectory ("stderr-attempt-{0:D2}.log" -f $attemptIndex)
    $startedAt = Get-Date
    $arguments = New-CodexArgumentList `
      -BaseCommand $BaseCommand `
      -ProjectRootPath $ProjectRootPath `
      -ResultPath $resultPath `
      -SelectedModel $SelectedModel `
      -SearchEnabled $SearchEnabled `
      -Mode $mode `
      -ResumeThreadId $resumeThreadId

    $inputText = if ($mode -eq "resume") {
      $resumeInstruction
    } else {
      Get-Content -LiteralPath $PromptPath -Raw -Encoding UTF8
    }

    $inputLiteral = Convert-ToSingleQuotedLiteral -Value $inputText
    $codexArgumentLiteral = ($arguments | ForEach-Object { Convert-ToSingleQuotedLiteral -Value $_ }) -join ", "
    $childScript = @"
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
`$promptText = $inputLiteral
`$commandParts = @($codexArgumentLiteral)
`$promptText | & `$commandParts[0] @(`$commandParts[1..(`$commandParts.Count - 1)])
"@

    $encodedCommand = New-EncodedCommand -ScriptText $childScript

    $process = Start-Process `
      -FilePath "C:\Program Files\PowerShell\7\pwsh.exe" `
      -ArgumentList @("-NoProfile", "-EncodedCommand", $encodedCommand) `
      -WorkingDirectory $ProjectRootPath `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -PassThru

    $timedOut = $false
    while (-not $process.HasExited) {
      Start-Sleep -Seconds 5

      Write-ProgressSnapshot -TelemetryDirectory $TelemetryDirectory -Snapshot @{
        prompt_name = $PromptName
        prompt_index = $PromptIndex
        prompt_total = $PromptTotal
        execution_index = $ExecutionIndex
        execution_total = $ExecutionTotal
        attempt_index = $attemptIndex
        status = "running"
        elapsed_seconds = [int]((Get-Date) - $startedAt).TotalSeconds
        timeout_minutes = $TimeoutMinutes
        thread_id = $resumeThreadId
        stdout_path = $stdoutPath
        stderr_path = $stderrPath
        result_path = $resultPath
      }

      if (((Get-Date) - $startedAt).TotalMinutes -ge $TimeoutMinutes) {
        try {
          Stop-Process -Id $process.Id -Force -ErrorAction Stop
        } catch {
          # Keep timeout handling resilient.
        }

        $timedOut = $true
        break
      }
    }

    $threadIdFromLog = Get-ThreadIdFromJsonLog -Path $stdoutPath
    if ($threadIdFromLog) {
      $resumeThreadId = $threadIdFromLog
    }

    $attempts.Add([ordered]@{
      attempt = $attemptIndex
      mode = $mode
      started_at = $startedAt.ToString("o")
      finished_at = (Get-Date).ToString("o")
      timed_out = $timedOut
      exit_code = $process.ExitCode
      thread_id = $resumeThreadId
      stdout_path = $stdoutPath
      stderr_path = $stderrPath
    }) | Out-Null

    if (-not $timedOut) {
      if ($process.ExitCode -ne 0) {
        throw "Codex exited with code $($process.ExitCode) for $PromptPath"
      }

      Write-ProgressSnapshot -TelemetryDirectory $TelemetryDirectory -Snapshot @{
        prompt_name = $PromptName
        prompt_index = $PromptIndex
        prompt_total = $PromptTotal
        execution_index = $ExecutionIndex
        execution_total = $ExecutionTotal
        attempt_index = $attemptIndex
        status = "completed"
        elapsed_seconds = [int]((Get-Date) - $startedAt).TotalSeconds
        timeout_minutes = $TimeoutMinutes
        thread_id = $resumeThreadId
        stdout_path = $stdoutPath
        stderr_path = $stderrPath
        result_path = $resultPath
      }

      $metadata = [ordered]@{
        prompt_path = $PromptPath
        result_path = $resultPath
        attempts = $attempts
      }
      $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $metadataPath -Encoding UTF8
      return
    }

    if (-not $resumeThreadId) {
      throw "Execution timed out after $TimeoutMinutes minutes for $PromptPath and no thread_id could be recovered for resume."
    }

    Write-ProgressSnapshot -TelemetryDirectory $TelemetryDirectory -Snapshot @{
      prompt_name = $PromptName
      prompt_index = $PromptIndex
      prompt_total = $PromptTotal
      execution_index = $ExecutionIndex
      execution_total = $ExecutionTotal
      attempt_index = $attemptIndex
      status = "timed_out_resuming"
      elapsed_seconds = [int]((Get-Date) - $startedAt).TotalSeconds
      timeout_minutes = $TimeoutMinutes
      thread_id = $resumeThreadId
      stdout_path = $stdoutPath
      stderr_path = $stderrPath
      result_path = $resultPath
    }

    $mode = "resume"
  }

  throw "Execution exceeded the maximum resume attempts for $PromptPath"
}

Assert-PathExists -Path $ProjectRoot -Label "Project root"
Assert-PathExists -Path $PromptDirectory -Label "Prompt directory"
Assert-ValidExecutionConfig -ExecutionCount $ExecutionCountPerPrompt -TimeoutMinutes $TimeoutMinutesPerExecution -MaximumResumeAttempts $MaxResumeAttemptsPerExecution

Ensure-Directory -Path $OutputRoot
$runsDirectory = Join-Path $OutputRoot "runs"
Ensure-Directory -Path $runsDirectory
$telemetryDirectory = Join-Path $OutputRoot "telemetry"
Ensure-Directory -Path $telemetryDirectory

$promptFiles = @(Get-PromptFiles -Directory $PromptDirectory)
if (-not $promptFiles -or $promptFiles.Count -eq 0) {
  throw "No markdown prompt files were found in $PromptDirectory"
}

$fullAutonomousExecutionCommand = Get-FullAutonomousExecutionCommand

Write-Section "AI Finish Plan Batch Runner"
Write-Host "Project root: $ProjectRoot"
Write-Host "Prompt directory: $PromptDirectory"
Write-Host "Output root: $OutputRoot"
Write-Host "Execution count per prompt: $ExecutionCountPerPrompt"
Write-Host "Timeout minutes per execution: $TimeoutMinutesPerExecution"
Write-Host "Max resume attempts per execution: $MaxResumeAttemptsPerExecution"
Write-Host "Codex command: $($fullAutonomousExecutionCommand -join ' ')"

for ($promptIndex = 0; $promptIndex -lt $promptFiles.Count; $promptIndex++) {
  $promptFile = $promptFiles[$promptIndex]
  $promptName = [System.IO.Path]::GetFileNameWithoutExtension($promptFile.Name)
  $promptRunDirectory = Join-Path $runsDirectory $promptName
  Ensure-Directory -Path $promptRunDirectory

  Write-Section "Running [$($promptIndex + 1)/$($promptFiles.Count)] $promptName"

  for ($executionIndex = 1; $executionIndex -le $ExecutionCountPerPrompt; $executionIndex++) {
    $executionDirectory = Join-Path $promptRunDirectory ("execution-{0:D2}" -f $executionIndex)
    Ensure-Directory -Path $executionDirectory

    Write-Host "Starting [$($promptIndex + 1)/$($promptFiles.Count)] $promptName / execution-$('{0:D2}' -f $executionIndex)"
    Invoke-PromptExecution `
      -BaseCommand $fullAutonomousExecutionCommand `
      -PromptPath $promptFile.FullName `
      -PromptName $promptName `
      -PromptIndex ($promptIndex + 1) `
      -PromptTotal $promptFiles.Count `
      -ProjectRootPath $ProjectRoot `
      -ExecutionDirectory $executionDirectory `
      -TelemetryDirectory $telemetryDirectory `
      -ExecutionIndex $executionIndex `
      -ExecutionTotal $ExecutionCountPerPrompt `
      -TimeoutMinutes $TimeoutMinutesPerExecution `
      -MaximumResumeAttempts $MaxResumeAttemptsPerExecution `
      -SelectedModel $Model `
      -SearchEnabled $UseSearch.IsPresent
    Write-Host "Completed [$($promptIndex + 1)/$($promptFiles.Count)] $promptName / execution-$('{0:D2}' -f $executionIndex)"
  }
}

Write-Section "Completed"
Write-Host "All prompt files finished."
Write-Host "Results are under: $OutputRoot"
