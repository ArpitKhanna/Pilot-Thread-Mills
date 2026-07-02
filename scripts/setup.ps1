# Pilot Thread Mills — interactive setup helper (Windows PowerShell)
# Run from project root: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host ""
Write-Host "=== Pilot Thread Mills Setup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Check .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[1/5] Creating .env.local from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "      Open .env.local and paste your Supabase keys from:" -ForegroundColor Gray
    Write-Host "      https://supabase.com/dashboard/project/_/settings/api" -ForegroundColor Gray
    Write-Host ""
    notepad ".env.local"
    Read-Host "Press Enter after you've saved .env.local with your Supabase keys"
} else {
    Write-Host "[1/5] .env.local already exists" -ForegroundColor Green
}

# 2. Load env for seed script
Get-Content ".env.local" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# 3. Admin seed
Write-Host ""
Write-Host "[2/5] Create first admin employee" -ForegroundColor Yellow
$seed = Read-Host "Run admin seed now? (y/n)"
if ($seed -eq "y") {
    if (-not $env:ADMIN_PHONE) {
        $env:ADMIN_PHONE = Read-Host "Admin mobile number (10 digits)"
    }
    if (-not $env:ADMIN_PIN) {
        $env:ADMIN_PIN = Read-Host "Admin PIN (4-6 digits)"
    }
    if (-not $env:ADMIN_NAME) {
        $env:ADMIN_NAME = Read-Host "Admin full name"
    }
    npm run seed:admin
}

# 4. GitHub
Write-Host ""
Write-Host "[3/5] GitHub" -ForegroundColor Yellow
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "      Not logged in. Run: gh auth login" -ForegroundColor Gray
    gh auth login --web --git-protocol https
}

$hasRemote = git remote get-url origin 2>$null
if (-not $hasRemote) {
    $create = Read-Host "Create GitHub repo Pilot-Thread-Mills and push? (y/n)"
    if ($create -eq "y") {
        git add -A
        git commit -m "Initial v1: Next.js app with phone+PIN auth, Supabase, PWA" 2>$null
        gh repo create Pilot-Thread-Mills --public --source=. --remote=origin --push
    }
} else {
    Write-Host "      Remote origin already configured: $hasRemote" -ForegroundColor Green
}

# 5. Dev server
Write-Host ""
Write-Host "[4/5] Start dev server" -ForegroundColor Yellow
$dev = Read-Host "Start npm run dev now? (y/n)"
if ($dev -eq "y") {
    Write-Host ""
    Write-Host "App: http://localhost:3000/login" -ForegroundColor Cyan
    npm run dev
}

Write-Host ""
Write-Host "[5/5] Vercel (manual)" -ForegroundColor Yellow
Write-Host "      1. Go to https://vercel.com/new" -ForegroundColor Gray
Write-Host "      2. Import Pilot-Thread-Mills from GitHub" -ForegroundColor Gray
Write-Host "      3. Add env vars from .env.local" -ForegroundColor Gray
Write-Host "      4. Deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "Setup helper finished." -ForegroundColor Green
