# MANGO VPN - Development Environment Health Check Script
# Tests all installed tools, programs, and dependencies for Rain and Sobree

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MANGO VPN - Development Environment Readiness Check      " -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$results = @()

function Test-Tool {
    param (
        [string]$Name,
        [string]$Command,
        [string[]]$ArgumentList,
        [string]$RequiredFor,
        [string]$MinVersionDesc
    )

    $installed = $false
    $versionOutput = "Not Found"
    $status = "MISSING"

    try {
        $cmdCheck = Get-Command $Command -ErrorAction Stop
        if ($cmdCheck) {
            $installed = $true
            $rawOutput = & $Command @ArgumentList 2>&1
            $versionOutput = ($rawOutput | Select-Object -First 1).ToString().Trim()
            $status = "READY"
        }
    } catch {
        $installed = $false
        $versionOutput = "Not installed or not in PATH"
    }

    [PSCustomObject]@{
        Tool            = $Name
        Status          = $status
        RequiredFor     = $RequiredFor
        DetectedVersion = $versionOutput
        Requirement     = $MinVersionDesc
    }
}

# 1. Node.js
$results += Test-Tool -Name "Node.js" -Command "node" -ArgumentList @("-v") -RequiredFor "Both (Rain & Sobree)" -MinVersionDesc ">= 18.0.0 (LTS 20+)"

# 2. npm
$results += Test-Tool -Name "npm" -Command "npm" -ArgumentList @("-v") -RequiredFor "Both (Rain & Sobree)" -MinVersionDesc ">= 9.0.0"

# 3. Git
$results += Test-Tool -Name "Git" -Command "git" -ArgumentList @("--version") -RequiredFor "Both (Rain & Sobree)" -MinVersionDesc ">= 2.30.0"

# 4. Docker CLI
$results += Test-Tool -Name "Docker CLI" -Command "docker" -ArgumentList @("-v") -RequiredFor "Sobree (Senior Dev)" -MinVersionDesc ">= 24.0.0"

# 5. Docker Compose
$results += Test-Tool -Name "Docker Compose" -Command "docker" -ArgumentList @("compose", "version") -RequiredFor "Sobree (Senior Dev)" -MinVersionDesc ">= v2.20.0"

# 6. Go Toolchain
$results += Test-Tool -Name "Go Toolchain" -Command "go" -ArgumentList @("version") -RequiredFor "Sobree (Senior Dev)" -MinVersionDesc ">= 1.22.0"

Write-Host "Detailed Tool Status:" -ForegroundColor White
$results | Format-Table -AutoSize -Property Tool, Status, RequiredFor, Requirement, DetectedVersion

# Check Docker Desktop process
Write-Host "Checking Docker Desktop Process..." -ForegroundColor White
$dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerProc) {
    Write-Host "  [OK] Docker Desktop process is RUNNING." -ForegroundColor Green
} else {
    Write-Host "  [NOTICE] Docker Desktop is not currently running." -ForegroundColor Yellow
    Write-Host "           (Launch Docker Desktop when you need to start PostgreSQL or WireGuard)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Role Readiness Summary:" -ForegroundColor Cyan

# Rain readiness: needs Node & npm
$nodeOk = ($results | Where-Object { $_.Tool -eq "Node.js" }).Status -eq "READY"
$npmOk = ($results | Where-Object { $_.Tool -eq "npm" }).Status -eq "READY"

if ($nodeOk -and $npmOk) {
    Write-Host "  [READY] Rain (Junior Dev): All required tools are INSTALLED!" -ForegroundColor Green
    Write-Host "          Rain can immediately run: npm run mock:agent, npm run dev:portal, npm run dev:api" -ForegroundColor DarkGreen
} else {
    Write-Host "  [BLOCKED] Rain (Junior Dev): Missing Node.js or npm. Please install Node.js >= 20 LTS." -ForegroundColor Red
}

# Sobree readiness: needs Node, npm, Docker, Go
$dockerOk = ($results | Where-Object { $_.Tool -eq "Docker CLI" }).Status -eq "READY"
$goOk = ($results | Where-Object { $_.Tool -eq "Go Toolchain" }).Status -eq "READY"

if ($nodeOk -and $npmOk -and $dockerOk -and $goOk) {
    Write-Host "  [READY] Sobree (Senior Dev): All systems tools (Node, Go, Docker) are INSTALLED!" -ForegroundColor Green
} else {
    Write-Host "  [PARTIAL] Sobree (Senior Dev):" -ForegroundColor Yellow
    if (-not $goOk) { Write-Host "            - Go Toolchain missing (Install Go >= 1.22 for agent & daemon)" -ForegroundColor Yellow }
    if (-not $dockerOk) { Write-Host "            - Docker missing (Install Docker Desktop for PostgreSQL & WireGuard)" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
