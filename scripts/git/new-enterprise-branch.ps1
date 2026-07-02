# Create a new enterprise/* feature branch from updated prod-aligned main.
# Usage:  .\scripts\git\new-enterprise-branch.ps1 linkedin-my-feature
#    ->  enterprise/linkedin-my-feature

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ShortName
)

$ErrorActionPreference = "Stop"

if ($ShortName -match "^enterprise/") {
    $branch = $ShortName
} else {
    $branch = "enterprise/$ShortName"
}

if ($branch -notmatch "^enterprise/[a-z0-9][a-z0-9-]*$") {
    Write-Error "Branch must be enterprise/<short-name> (lowercase, hyphens). Got: $branch"
}

$dirty = git status --porcelain
if ($dirty) {
    Write-Error "Working tree is dirty. Commit or stash before creating a new branch."
}

Write-Host "Running daily prod sync first..." -ForegroundColor Yellow
& "$PSScriptRoot/daily-prod-sync.ps1"

Write-Host "Creating branch $branch from main..." -ForegroundColor Yellow
git checkout -b $branch

Write-Host ""
Write-Host "Branch $branch created." -ForegroundColor Green
Write-Host "When ready to publish (prod only):"
Write-Host "  git push -u prod $branch"
Write-Host "  gh pr create --repo ALwrity/ALwrity-prod --base main --head $branch"
Write-Host ""
