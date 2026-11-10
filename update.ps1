# Update the booking server to the latest master and start it (Windows PowerShell).
#   Usage (from the project folder):  git pull origin master; .\update.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '==> Fetching latest code'
git pull --ff-only origin master
if ($LASTEXITCODE -ne 0) { throw 'git pull failed' }

# .env is no longer tracked by git, so the pull that removed it from the
# repository also deleted the local copy. Recover it from git history once.
if (-not (Test-Path 'backend\.env')) {
    $last = git log -n 1 --format=%H -- backend/.env
    if ($last) {
        git show "$($last)^:backend/.env" | Set-Content -Encoding utf8 'backend\.env'
        Write-Host '==> Restored backend\.env from git history.'
        Write-Host '    It still holds the OLD database password: after you change the password'
        Write-Host '    in MongoDB Atlas, update MONGODB_URI in backend\.env and run this again.'
    } else {
        throw 'backend\.env is missing. Copy backend\.env.example to backend\.env and fill it in.'
    }
}

Write-Host '==> Installing dependencies'
Push-Location backend
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

Write-Host '==> Starting server (stop any older server window first; Ctrl+C to stop)'
npm start
