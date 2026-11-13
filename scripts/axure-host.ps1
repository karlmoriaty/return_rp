# Windows Axure host roundtrip: open an owned document, save, close, reopen, preview.
# Requires an interactive desktop session. Emits one JSON line; failures exit 1.
# Keep this file ASCII-only: Windows PowerShell 5.1 misparses BOM-less UTF-8 scripts.
param(
  [Parameter(Mandatory = $true)][string]$File,
  [Parameter(Mandatory = $true)][string]$Exe,
  [Parameter(Mandatory = $true)][string]$Title,
  [int]$OpenTimeoutSeconds = 60,
  [int]$PreviewTimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class AxHostWin32 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$result = [ordered]@{
  opened = $false
  saved = $false
  saveCommandIssued = $false
  mtimeChanged = $false
  closed = $false
  reopened = $false
  previewUrl = $null
  previewVerified = $false
  port = $null
  elapsedMs = 0
}
$started = [DateTime]::UtcNow
$proc = $null

function Fail($message) {
  $result.error = $message
  $result.elapsedMs = [int]([DateTime]::UtcNow - $started).TotalMilliseconds
  $result | ConvertTo-Json -Compress
  exit 1
}

function Start-Host {
  $p = Start-Process -FilePath $Exe -ArgumentList ('"' + $File + '"') -PassThru
  if (-not $p) { Fail 'start-process returned no process' }
  return $p
}

function Wait-Window([System.Diagnostics.Process]$p, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if ($p.HasExited) { return $false }
    try {
      $p.Refresh()
      if ($p.MainWindowHandle -ne 0 -and $p.MainWindowTitle -like ('*' + $Title + '*')) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Focus-Host([System.Diagnostics.Process]$p) {
  $p.Refresh()
  [AxHostWin32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
  [AxHostWin32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 600
}

function Close-Host([System.Diagnostics.Process]$p, [int]$seconds) {
  if ($p -and -not $p.HasExited) {
    $p.CloseMainWindow() | Out-Null
    if (-not $p.WaitForExit($seconds * 1000)) { $p.Kill(); $p.WaitForExit(5000) | Out-Null }
  }
}

try {
  if (Get-Process -Name ([System.IO.Path]::GetFileNameWithoutExtension($Exe)) -ErrorAction SilentlyContinue) {
    Fail 'An Axure host of this version is already running; close it so the preview server can be attributed to this job'
  }

  $before = (Get-Item -LiteralPath $File).LastWriteTimeUtc
  $proc = Start-Host
  if (-not (Wait-Window $proc $OpenTimeoutSeconds)) { Fail 'Owned job document did not open' }
  $result.opened = $true
  Focus-Host $proc
  [System.Windows.Forms.SendKeys]::SendWait('^s')
  $result.saveCommandIssued = $true
  Start-Sleep -Milliseconds 1200
  $after = (Get-Item -LiteralPath $File).LastWriteTimeUtc
  # Axure may skip writing when the opened document has no edits; report the
  # actual write instead of assuming the keystroke saved anything.
  $result.mtimeChanged = ($after -ne $before)
  $result.saved = $result.mtimeChanged
  Close-Host $proc 20
  $result.closed = $true

  $proc = Start-Host
  if (-not (Wait-Window $proc $OpenTimeoutSeconds)) { Fail 'Owned job document did not reopen' }
  $result.reopened = $true
  Focus-Host $proc
  [System.Windows.Forms.SendKeys]::SendWait('{F5}')

  $deadline = (Get-Date).AddSeconds($PreviewTimeoutSeconds)
  while ((Get-Date) -lt $deadline -and -not $result.previewVerified) {
    if ($proc.HasExited) { break }
    $ports = @(Get-NetTCPConnection -State Listen -OwningProcess $proc.Id -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty LocalPort -Unique)
    foreach ($port in $ports) {
      try {
        $resp = Invoke-WebRequest -Uri ('http://127.0.0.1:' + $port + '/start.html') -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200 -and $resp.Content -match [regex]::Escape($Title)) {
          $result.previewUrl = 'http://127.0.0.1:' + $port + '/start.html'
          $result.previewVerified = $true
          $result.port = $port
          break
        }
      } catch { }
    }
    if (-not $result.previewVerified) { Start-Sleep -Milliseconds 500 }
  }
  if (-not $result.previewVerified) { Fail 'Axure preview server did not serve the owned document' }
} catch {
  Fail $_.Exception.Message
} finally {
  if ($proc -and -not $proc.HasExited) { Close-Host $proc 15 }
}

$result.elapsedMs = [int]([DateTime]::UtcNow - $started).TotalMilliseconds
$result | ConvertTo-Json -Compress
exit 0
