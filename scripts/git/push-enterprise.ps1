# Safe push to prod for the current enterprise/* branch.
# Usage:  .\scripts\git\push-enterprise.ps1

$ErrorActionPreference = "Stop"

$branch = git branch --show-current
if (-not $branch -or $branch -notmatch "^enterprise/") {
    Write-Error "Current branch is '$branch'. Only enterprise/* branches may use this script (prod remote)."
}

if (-not (git remote) -contains "prod") {
    Write-Error "Remote 'prod' is missing."
}

Write-Host "Pushing $branch -> prod (NOT origin)..." -ForegroundColor Yellow
git push -u prod $branch

Write-Host ""
Write-Host "Open PR on ALwrity-prod:" -ForegroundColor Green
Write-Host "  gh pr create --repo ALwrity/ALwrity-prod --base main --head $branch"
Write-Host ""
