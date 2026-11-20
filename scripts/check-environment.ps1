# MANGO VPN - Development Environment Health Check (Windows wrapper)
# Delegates to check-environment.mjs, which is the single source of truth on Linux, macOS, and Windows.

param(
    [ValidateSet("All", "Rain", "Sobree")]
    [string]$Role = "All"
)

& node (Join-Path $PSScriptRoot 'check-environment.mjs') --role $Role
exit $LASTEXITCODE
