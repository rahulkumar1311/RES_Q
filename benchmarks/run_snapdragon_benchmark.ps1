# PowerShell Runner for RESQ AI Benchmark on Qualcomm Snapdragon Hardware
# Target: Snapdragon X Elite / Snapdragon X Plus (HP OmniBook X, HP EliteBook Ultra)

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "         LAUNCHING RESQ AI BENCHMARK ON SNAPDRAGON COPILOT+ PC                  " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# Set Snapdragon execution preferences
$env:AI_MODE = "local"
$env:SNAPDRAGON_AI_ENABLED = "true"
$env:SNAPDRAGON_EXECUTION_PROVIDER = "auto"
$env:SNAPDRAGON_MODEL_PRECISION = "INT8"

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found in PATH. Please install Node.js 20+ for Windows on ARM."
    exit 1
}

# Resolve benchmark script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$benchmarkScript = Join-Path $scriptDir "run_ai_benchmark.js"

Write-Host "Executing: node $benchmarkScript --samples 100 --warmup 10" -ForegroundColor Green
node $benchmarkScript --samples 100 --warmup 10

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Benchmark completed successfully. Results saved in benchmarks/." -ForegroundColor Green
} else {
    Write-Host "`n✗ Benchmark exited with code $LASTEXITCODE" -ForegroundColor Red
}
