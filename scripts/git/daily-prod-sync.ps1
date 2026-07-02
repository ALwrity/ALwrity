# Daily sync for ALwrity open-core dual-repo workflow (prod as default).
# Run from repo root:  .\scripts\git\daily-prod-sync.ps1
# Mirror public main to prod (team sync role only):  .\scripts\git\daily-prod-sync.ps1 -MirrorPublicToProd

param(
    [switch]$MirrorPublicToProd
)

$ErrorActionPreference = "Stop"

function Require-Remote($name) {
    $remotes = git remote
    if ($remotes -notcontains $name) {
        Write-Error "Remote '$name' is missing. Add it first:`n  git remote add prod https://github.com/ALwrity/ALwrity-prod.git"
    }
}

function Print-SafetyBanner {
    Write-Host ""
    Write-Host "=== ALwrity git (prod default) ===" -ForegroundColor Cyan
    Write-Host "  origin  -> public (open source)"
    Write-Host "  prod    -> enterprise (private)"
    Write-Host "  enterprise/* branches -> push to prod only"
    Write-Host ""
}

Require-Remote "origin"
Require-Remote "prod"
Print-SafetyBanner

Write-Host "Fetching origin and prod..." -ForegroundColor Yellow
git fetch origin
git fetch prod

$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    $dirty = git status --porcelain
    if ($dirty) {
        Write-Error "Working tree has uncommitted changes on '$currentBranch'. Commit or stash before syncing main."
    }
}

Write-Host "Updating local main from prod/main..." -ForegroundColor Yellow
git checkout main
git branch --set-upstream-to=prod/main main 2>$null | Out-Null
git merge prod/main --no-edit

$publicAhead = git rev-list --count main..origin/main
if ([int]$publicAhead -gt 0) {
    Write-Host "Merging $publicAhead commit(s) from origin/main into main..." -ForegroundColor Yellow
    git merge origin/main --no-edit
} else {
    Write-Host "origin/main: nothing new to merge." -ForegroundColor Green
}

$prodAhead = git rev-list --count prod/main..main
Write-Host ""
Write-Host "Local main is $prodAhead commit(s) ahead of prod/main." -ForegroundColor $(if ([int]$prodAhead -gt 0) { "Yellow" } else { "Green" })

if ($MirrorPublicToProd) {
    if ([int]$prodAhead -eq 0) {
        Write-Host "Nothing to mirror to prod." -ForegroundColor Green
    } else {
        Write-Host "Pushing main -> prod/main (public sync mirror)..." -ForegroundColor Yellow
        git push prod main
        Write-Host "prod/main updated." -ForegroundColor Green
    }
} elseif ([int]$prodAhead -gt 0) {
    Write-Host "Tip: open a PR on ALwrity-prod to land these commits, or re-run with -MirrorPublicToProd if you own daily sync." -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "Ready. Start enterprise work with:" -ForegroundColor Cyan
Write-Host "  .\scripts\git\new-enterprise-branch.ps1 <short-name>"
Write-Host ""
