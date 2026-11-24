<#
.SYNOPSIS
    Synterview All-in-One Runner Script
.DESCRIPTION
    Launches and monitors the complete Synterview platform:
    1. Ollama LLM Service (port 11434) with qwen2.5-coder:7b
    2. FastAPI Local Model & Evaluation Engine (port 8000)
    3. Vite React Frontend Development Server (port 3000)

Usage:
    .\run.ps1
#>

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Synterview: Intelligent Multimodal Mock Interview      " -ForegroundColor Green
Write-Host "   Automated Speech, Vision, & Rubric Response Engine     " -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$workspaceRoot = $PSScriptRoot
Set-Location $workspaceRoot

# Helper: Test if TCP port is actively listening
function Test-PortActive ($port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(600, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

$spawnedProcesses = @()

# -----------------------------------------------------------------------------
# 1. Ollama LLM Engine (Port 11434)
# -----------------------------------------------------------------------------
Write-Host "[1/3] Checking Ollama LLM Engine (Port 11434)..." -ForegroundColor Yellow

$ollamaUp = Test-PortActive 11434
if (-not $ollamaUp) {
    if (Get-Command "ollama" -ErrorAction SilentlyContinue) {
        Write-Host "      Starting Ollama background daemon on http://localhost:11434 ..." -ForegroundColor DarkGray
        $ollamaProc = Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -PassThru
        $spawnedProcesses += $ollamaProc
        
        $attempts = 0
        while (-not (Test-PortActive 11434) -and $attempts -lt 8) {
            Start-Sleep -Milliseconds 500
            $attempts++
        }
    } else {
        Write-Host "      [!] Ollama binary not found in PATH. LLM calls will use heuristic fallbacks." -ForegroundColor DarkYellow
    }
}

if (Test-PortActive 11434) {
    Write-Host "      [OK] Ollama is active on http://localhost:11434 (Ready for qwen2.5-coder:7b)" -ForegroundColor Green
} else {
    Write-Host "      [!] Ollama is offline or uninstalled. Evaluator will run in deterministic fallback mode." -ForegroundColor DarkYellow
}

# -----------------------------------------------------------------------------
# 2. FastAPI Local Model & Evaluation Engine (Port 8000)
# -----------------------------------------------------------------------------
Write-Host "[2/3] Checking FastAPI Model & Speech Service (Port 8000)..." -ForegroundColor Yellow

$modelUp = Test-PortActive 8000
if (-not $modelUp) {
    if (Get-Command "python" -ErrorAction SilentlyContinue) {
        Write-Host "      Starting FastAPI Model Service (services/local_speech_model/main.py) ..." -ForegroundColor DarkGray
        
        $logPath = Join-Path $workspaceRoot "services\local_speech_model\server.log"
        $backendProc = Start-Process -FilePath "python" `
            -ArgumentList "services/local_speech_model/main.py" `
            -WorkingDirectory $workspaceRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $logPath `
            -RedirectStandardError $logPath `
            -PassThru
        
        $spawnedProcesses += $backendProc

        $attempts = 0
        while (-not (Test-PortActive 8000) -and $attempts -lt 12) {
            Start-Sleep -Milliseconds 500
            $attempts++
        }
    } else {
        Write-Host "      [!] Python not found in PATH. Backend service could not be started." -ForegroundColor Red
    }
}

if (Test-PortActive 8000) {
    Write-Host "      [OK] FastAPI Model Engine is active on http://localhost:8000" -ForegroundColor Green
    Write-Host "           - Whisper ASR Speech Recognition (/api/transcribe)" -ForegroundColor DarkGray
    Write-Host "           - Acoustic Hesitation & Tone Analysis Engine" -ForegroundColor DarkGray
    Write-Host "           - Fixed 5-Dimension Rubric Scoring & Claim Verifier" -ForegroundColor DarkGray
    Write-Host "           - Multi-Role Curated Question Bank & Hints" -ForegroundColor DarkGray
} else {
    Write-Host "      [!] FastAPI service failed to start on port 8000. Check services/local_speech_model/server.log." -ForegroundColor Red
}

# -----------------------------------------------------------------------------
# 3. Frontend Dependencies & Vite Server (Port 3000)
# -----------------------------------------------------------------------------
Write-Host "[3/3] Preparing React/TypeScript Frontend (Port 3000)..." -ForegroundColor Yellow

if (-not (Test-Path (Join-Path $workspaceRoot "node_modules"))) {
    Write-Host "      Installing frontend node_modules..." -ForegroundColor Yellow
    if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
        pnpm install
    } else {
        npm install
    }
}

Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  All systems ready! Endpoints & Quick Links:" -ForegroundColor Cyan
Write-Host "  • Web Application:  " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "  • Direct Room:      " -NoNewline
Write-Host "http://localhost:3000/interview/session-001" -ForegroundColor Yellow
Write-Host "  • Backend Swagger:  " -NoNewline
Write-Host "http://localhost:8000/docs" -ForegroundColor Blue
Write-Host "  • Ollama LLM:       " -NoNewline
Write-Host "http://localhost:11434 (qwen2.5-coder:7b)" -ForegroundColor Magenta
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Press Ctrl+C at any time in this window to stop the frontend server." -ForegroundColor DarkGray
Write-Host ""
Write-Host "[+] Launching Vite development server..." -ForegroundColor Cyan
Write-Host ""

try {
    if (Get-Command "pnpm" -ErrorAction SilentlyContinue) {
        pnpm run dev
    } else {
        npm run dev
    }
} finally {
    Write-Host ""
    Write-Host "[*] Frontend server terminated." -ForegroundColor Yellow
}
