[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Model,

    [Parameter(Mandatory = $true)]
    [string]$Title,

    [string]$Prompt,

    [string]$PromptFile,

    [string]$Worktree,

    [string]$Session,

    [string]$AttachFile,

    [string]$WorkingDirectory = (Get-Location).Path,

    [ValidateSet('all', 'trace', 'debug', 'info', 'warn', 'warning', 'error', 'fatal', 'none')]
    [string]$LogLevel = 'info',

    [bool]$KeepOpen = $true,

    [switch]$NoWait,

    [switch]$NoWindow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $utf8NoBom } catch {}
try { [Console]::InputEncoding = $utf8NoBom } catch {}
$OutputEncoding = $utf8NoBom

function ConvertTo-PowerShellSingleQuoted {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function ConvertTo-WindowsArgString {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $quoted = foreach ($arg in $Arguments) {
        if ($arg -eq '') {
            '""'
        } elseif ($arg -match '[\s"]') {
            # Escape backslashes before double quotes and trailing backslashes per Win32 rules
            $escaped = $arg -replace '(\\*)"', '$1$1\"'
            $escaped = $escaped -replace '(\\+)$', '$1$1'
            '"' + $escaped + '"'
        } else {
            $arg
        }
    }
    return ($quoted -join ' ')
}

function Get-CurrentWindowsDesktopName {
    try {
        if (-not ('OpenCodeDesktopCheck' -as [type])) {
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class OpenCodeDesktopCheck {
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern IntPtr GetThreadDesktop(uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool GetUserObjectInformationW(
        IntPtr hObj,
        int nIndex,
        byte[] pvInfo,
        int nLength,
        out int lpnLengthNeeded
    );

    public static string GetDesktopName() {
        IntPtr desktop = GetThreadDesktop(GetCurrentThreadId());
        if (desktop == IntPtr.Zero) return "";
        int needed = 0;
        GetUserObjectInformationW(desktop, 2, null, 0, out needed);
        if (needed <= 0) return "";
        byte[] buffer = new byte[needed];
        if (!GetUserObjectInformationW(desktop, 2, buffer, needed, out needed)) return "";
        return Encoding.Unicode.GetString(buffer).TrimEnd('\0');
    }
}
"@ -ErrorAction Stop
        }
        return [OpenCodeDesktopCheck]::GetDesktopName()
    } catch {
        return ''
    }
}

if ([string]::IsNullOrWhiteSpace($Prompt) -and [string]::IsNullOrWhiteSpace($PromptFile)) {
    throw 'Either -Prompt or -PromptFile must be provided.'
}

if (-not [string]::IsNullOrWhiteSpace($Prompt) -and -not [string]::IsNullOrWhiteSpace($PromptFile)) {
    throw 'Specify either -Prompt or -PromptFile, not both.'
}

if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
    throw "WorkingDirectory does not exist: $WorkingDirectory"
}
$resolvedWorkDir = (Resolve-Path -LiteralPath $WorkingDirectory).Path

$resolvedAttachFile = $null
if (-not [string]::IsNullOrWhiteSpace($AttachFile)) {
    if (-not (Test-Path -LiteralPath $AttachFile -PathType Leaf)) {
        throw "AttachFile does not exist: $AttachFile"
    }
    $resolvedAttachFile = (Resolve-Path -LiteralPath $AttachFile).Path
}

$promptText = $Prompt
if (-not [string]::IsNullOrWhiteSpace($PromptFile)) {
    if (-not (Test-Path -LiteralPath $PromptFile -PathType Leaf)) {
        throw "PromptFile does not exist: $PromptFile"
    }
    $resolvedPromptFile = (Resolve-Path -LiteralPath $PromptFile).Path
    $promptText = [System.IO.File]::ReadAllText($resolvedPromptFile, $utf8NoBom)
}

if ([string]::IsNullOrWhiteSpace($promptText)) {
    throw 'Prompt text cannot be empty.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$slug = ($Title -replace '[^a-zA-Z0-9_-]+', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = 'opencode-run'
}
if ($slug.Length -gt 32) {
    $slug = $slug.Substring(0, 32).Trim('-')
}
$shortGuid = ([guid]::NewGuid().ToString('N')).Substring(0, 8)
$baseTempDir = Join-Path ([System.IO.Path]::GetTempPath()) 'opencode-dispatch'
$runDir = Join-Path $baseTempDir "$timestamp-$slug-$shortGuid"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$promptPath = Join-Path $runDir 'prompt.txt'
$runnerScript = Join-Path $runDir 'runner.ps1'
$logPath = Join-Path $runDir 'output.log'
$pidPath = Join-Path $runDir 'runner.pid'
$exitCodePath = Join-Path $runDir 'exit.code'
$tailCommand = "Get-Content -Path `"$logPath`" -Wait -Tail 50"

[System.IO.File]::WriteAllText($promptPath, $promptText, $utf8NoBom)

$worktreeLabel = if ([string]::IsNullOrWhiteSpace($Worktree)) { 'in-place' } else { $Worktree }
$safeTitle = ($Title -replace '[\r\n;"]+', ' ').Trim()
if ([string]::IsNullOrWhiteSpace($safeTitle)) {
    $safeTitle = 'OpenCode Worker'
}

$runnerBody = @"
`$ErrorActionPreference = 'Continue'
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) {
    `$PSNativeCommandUseErrorActionPreference = `$false
}

`$utf8NoBom = New-Object System.Text.UTF8Encoding(`$false)
try { [Console]::OutputEncoding = `$utf8NoBom } catch {}
try { [Console]::InputEncoding = `$utf8NoBom } catch {}
`$OutputEncoding = `$utf8NoBom

`$pidFile = $(ConvertTo-PowerShellSingleQuoted $pidPath)
`$exitFile = $(ConvertTo-PowerShellSingleQuoted $exitCodePath)
`$logFile = $(ConvertTo-PowerShellSingleQuoted $logPath)
`$promptFile = $(ConvertTo-PowerShellSingleQuoted $promptPath)
`$workDir = $(ConvertTo-PowerShellSingleQuoted $resolvedWorkDir)
`$model = $(ConvertTo-PowerShellSingleQuoted $Model)
`$runTitle = $(ConvertTo-PowerShellSingleQuoted $safeTitle)
`$worktree = $(ConvertTo-PowerShellSingleQuoted $(if ($Worktree) { $Worktree } else { '' }))
`$sessionId = $(ConvertTo-PowerShellSingleQuoted $(if ($Session) { $Session } else { '' }))
`$attachFile = $(ConvertTo-PowerShellSingleQuoted $(if ($resolvedAttachFile) { $resolvedAttachFile } else { '' }))
`$logLevel = $(ConvertTo-PowerShellSingleQuoted $LogLevel)
`$worktreeLabel = $(ConvertTo-PowerShellSingleQuoted $worktreeLabel)

[System.IO.File]::WriteAllText(`$pidFile, "`$PID", `$utf8NoBom)

try {
    `$Host.UI.RawUI.WindowTitle = "OpenCode: `$runTitle [`$model]"
} catch {
}

Set-Location -LiteralPath `$workDir
`$startTime = Get-Date

Write-Host '========================================================================' -ForegroundColor Cyan
Write-Host " OpenCode Worker : `$runTitle" -ForegroundColor White
Write-Host " Model           : `$model" -ForegroundColor Yellow
Write-Host " Working Dir     : `$workDir" -ForegroundColor Gray
Write-Host " Isolation       : `$worktreeLabel" -ForegroundColor Gray
Write-Host " Log Level       : `$logLevel (--thinking --print-logs)" -ForegroundColor Gray
Write-Host " Log File        : `$logFile" -ForegroundColor Gray
Write-Host " Started         : `$(`$startTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
Write-Host '========================================================================' -ForegroundColor Cyan
Write-Host ''

`$promptContent = [System.IO.File]::ReadAllText(`$promptFile, `$utf8NoBom)
`$ocArgs = New-Object System.Collections.Generic.List[string]
`$ocArgs.Add('run')
`$ocArgs.Add('-m')
`$ocArgs.Add(`$model)
`$ocArgs.Add('--auto')
`$ocArgs.Add('--archived')
`$ocArgs.Add('--thinking')
`$ocArgs.Add('--print-logs')
`$ocArgs.Add('--log-level')
`$ocArgs.Add(`$logLevel)
`$ocArgs.Add('--title')
`$ocArgs.Add(`$runTitle)
if (-not [string]::IsNullOrWhiteSpace(`$worktree)) {
    `$ocArgs.Add('--worktree')
    `$ocArgs.Add(`$worktree)
}
if (-not [string]::IsNullOrWhiteSpace(`$sessionId)) {
    `$ocArgs.Add('--session')
    `$ocArgs.Add(`$sessionId)
}
if (-not [string]::IsNullOrWhiteSpace(`$attachFile)) {
    `$ocArgs.Add('-f')
    `$ocArgs.Add(`$attachFile)
}
`$ocArgs.Add(`$promptContent)

`$exitCode = 1
`$logWriter = `$null
try {
    `$logWriter = New-Object System.IO.StreamWriter(`$logFile, `$false, `$utf8NoBom)
    `$logWriter.AutoFlush = `$true
    $null | & opencode @ocArgs 2>&1 |
        ForEach-Object {
            `$line = if (`$_ -is [System.Management.Automation.ErrorRecord]) {
                `$_.ToString()
            } else {
                [string]`$_
            }
            `$logWriter.WriteLine(`$line)
            Write-Output `$line
        }
    if (`$null -ne `$LASTEXITCODE) {
        `$exitCode = [int]`$LASTEXITCODE
    } else {
        `$exitCode = 0
    }
} catch {
    `$errLine = "[dispatch-opencode] Runner exception: `$(`$_.Exception.Message)"
    Write-Host `$errLine -ForegroundColor Red
    if (`$null -ne `$logWriter) {
        `$logWriter.WriteLine(`$errLine)
    }
    `$exitCode = 1
} finally {
    if (`$null -ne `$logWriter) {
        `$logWriter.Dispose()
    }
    `$endTime = Get-Date
    `$elapsed = `$endTime - `$startTime
    [System.IO.File]::WriteAllText(`$exitFile, "`$exitCode", `$utf8NoBom)
    Write-Host ''
    Write-Host '========================================================================' -ForegroundColor Cyan
    `$statusColor = if (`$exitCode -eq 0) { 'Green' } else { 'Red' }
    Write-Host " Completed       : Exit Code `$exitCode (Elapsed: `$(`$elapsed.ToString('hh\:mm\:ss')))" -ForegroundColor `$statusColor
    Write-Host " Log File        : `$logFile" -ForegroundColor Gray
    Write-Host '========================================================================' -ForegroundColor Cyan
}
exit `$exitCode
"@

[System.IO.File]::WriteAllText($runnerScript, $runnerBody, $utf8NoBom)

$pwshCmd = Get-Command 'pwsh.exe' -ErrorAction SilentlyContinue
if ($null -eq $pwshCmd) {
    $pwshCmd = Get-Command 'pwsh' -ErrorAction SilentlyContinue
}
$shellExe = if ($null -ne $pwshCmd) {
    $pwshCmd.Source
} else {
    (Get-Command 'powershell.exe' -ErrorAction Stop).Source
}

$desktopName = ''
if (-not $NoWindow) {
    $desktopName = Get-CurrentWindowsDesktopName
}

$isIsolatedDesktop = (-not $NoWindow) -and (-not [string]::IsNullOrWhiteSpace($desktopName)) -and ($desktopName -ine 'Default')

if ($NoWindow -or $isIsolatedDesktop) {
    if ($isIsolatedDesktop) {
        Write-Output "Isolated Windows desktop detected ('$desktopName' != 'Default'); running inline instead of spawning an invisible window."
        Write-Output "Watch live in your terminal: $tailCommand"
    } else {
        Write-Output "Running OpenCode headless | Model: $Model | Title: $safeTitle | Log: $logPath"
    }

    if ($NoWait) {
        $bgArgs = ConvertTo-WindowsArgString -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runnerScript)
        Start-Process -FilePath $shellExe -WorkingDirectory $resolvedWorkDir -WindowStyle Hidden -ArgumentList $bgArgs | Out-Null
        $metadata = [ordered]@{
            runDir       = $runDir
            logFile      = $logPath
            exitCodeFile = $exitCodePath
            pidFile      = $pidPath
            model        = $Model
            title        = $safeTitle
            worktree     = $worktreeLabel
            tailCommand  = $tailCommand
        }
        Write-Output ($metadata | ConvertTo-Json -Compress)
        exit 0
    }

    & $shellExe -NoProfile -ExecutionPolicy Bypass -File $runnerScript
    $inlineExit = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 1 }
    exit $inlineExit
}

$shellArgs = if ($KeepOpen) {
    @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runnerScript)
} else {
    @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runnerScript)
}

$wtCmd = Get-Command 'wt.exe' -ErrorAction SilentlyContinue
if ($null -ne $wtCmd) {
    $wtArgs = @('-w', 'new', 'new-tab', '--title', "OpenCode: $safeTitle", '-d', $resolvedWorkDir, $shellExe) + $shellArgs
    $wtArgLine = ConvertTo-WindowsArgString -Arguments $wtArgs
    Start-Process -FilePath $wtCmd.Source -ArgumentList $wtArgLine | Out-Null
} else {
    $shellArgLine = ConvertTo-WindowsArgString -Arguments $shellArgs
    Start-Process -FilePath $shellExe -WorkingDirectory $resolvedWorkDir -ArgumentList $shellArgLine | Out-Null
}

Write-Output "Dispatched OpenCode in new terminal window | Model: $Model | Title: $safeTitle | Isolation: $worktreeLabel | Log: $logPath"

if ($NoWait) {
    $metadata = [ordered]@{
        runDir       = $runDir
        logFile      = $logPath
        exitCodeFile = $exitCodePath
        pidFile      = $pidPath
        model        = $Model
        title        = $safeTitle
        worktree     = $worktreeLabel
        tailCommand  = $tailCommand
    }
    Write-Output ($metadata | ConvertTo-Json -Compress)
    exit 0
}

$pidDeadline = (Get-Date).AddSeconds(20)
while (-not (Test-Path -LiteralPath $pidPath) -and (Get-Date) -lt $pidDeadline) {
    Start-Sleep -Milliseconds 250
}

if (-not (Test-Path -LiteralPath $pidPath)) {
    Write-Error "Timed out after 20s waiting for runner PID file at $pidPath (terminal window failed to start)."
    exit 1
}

$runnerPidText = ([System.IO.File]::ReadAllText($pidPath, $utf8NoBom)).Trim()
$runnerPid = 0
if (-not [int]::TryParse($runnerPidText, [ref]$runnerPid)) {
    Write-Error "Invalid runner PID '$runnerPidText' in $pidPath"
    exit 1
}

while (-not (Test-Path -LiteralPath $exitCodePath)) {
    $proc = Get-Process -Id $runnerPid -ErrorAction SilentlyContinue
    if ($null -eq $proc) {
        Start-Sleep -Milliseconds 500
        if (-not (Test-Path -LiteralPath $exitCodePath)) {
            Write-Error "OpenCode terminal (PID $runnerPid) closed before completion. Partial log: $logPath"
            exit 1
        }
        break
    }
    Start-Sleep -Milliseconds 500
}

$workerExitText = ([System.IO.File]::ReadAllText($exitCodePath, $utf8NoBom)).Trim()
$workerExitCode = 1
if (-not [int]::TryParse($workerExitText, [ref]$workerExitCode)) {
    $workerExitCode = 1
}

Write-Output "OpenCode run finished | Exit Code: $workerExitCode | Log: $logPath"
if (Test-Path -LiteralPath $logPath) {
    Write-Output '--- Tail of output.log (last 40 lines) ---'
    Get-Content -LiteralPath $logPath -Tail 40 -Encoding UTF8
}

exit $workerExitCode
