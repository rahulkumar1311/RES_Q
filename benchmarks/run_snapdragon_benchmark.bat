@echo off
REM Windows Command Prompt Runner for RESQ AI Benchmark on Qualcomm Snapdragon Hardware
REM Target: Snapdragon X Elite / Snapdragon X Plus (HP OmniBook X, HP EliteBook Ultra)

echo ================================================================================
echo          LAUNCHING RESQ AI BENCHMARK ON SNAPDRAGON COPILOT+ PC                  
echo ================================================================================

set AI_MODE=local
set SNAPDRAGON_AI_ENABLED=true
set SNAPDRAGON_EXECUTION_PROVIDER=auto
set SNAPDRAGON_MODEL_PRECISION=INT8

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not found in PATH. Please install Node.js 20+ for Windows on ARM.
    exit /b 1
)

node "%~dp0run_ai_benchmark.js" --samples 100 --warmup 10

echo.
echo Results saved to %~dp0benchmark_results.json
