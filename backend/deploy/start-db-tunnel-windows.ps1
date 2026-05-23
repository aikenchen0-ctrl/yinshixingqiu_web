param(
  [int]$LocalPort = 15432,
  [string]$RemoteUser = "root",
  [string]$RemoteHost = "112.74.164.233",
  [int]$RemotePort = 5432
)

$sshCommand = Get-Command ssh -ErrorAction Stop
$forwardTarget = "${LocalPort}:127.0.0.1:${RemotePort}"
$remoteTarget = "${RemoteUser}@${RemoteHost}"

Write-Host "Starting SSH tunnel: localhost:${LocalPort} -> ${RemoteHost}:127.0.0.1:${RemotePort}"
Write-Host "When prompted, enter the server password."

& $sshCommand.Source `
  -o ExitOnForwardFailure=yes `
  -o ServerAliveInterval=30 `
  -o ServerAliveCountMax=3 `
  -o StrictHostKeyChecking=accept-new `
  -L $forwardTarget `
  -N `
  $remoteTarget
