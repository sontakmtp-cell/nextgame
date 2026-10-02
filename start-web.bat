@echo off
setlocal
title PROMPT Chien - Web Client

echo ======================================================================
echo   PROMPT CHIEN - WEB CLIENT (KHOI DONG TUC THI)
echo   Workshop, Brain Lab, Arena Replay chay 100%% trong Web Worker
echo ======================================================================
echo.

where fnm >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [*] Kich hoat Node 24 qua fnm...
    fnm env --shell cmd > "%TEMP%\fnm_env_%RANDOM%.bat" 2>nul
    if exist "%TEMP%\fnm_env_*.bat" (
        for %%f in ("%TEMP%\fnm_env_*.bat") do (
            call "%%f" >nul 2>&1
            del "%%f" >nul 2>&1
        )
    )
    call fnm use 24.18.0 >nul 2>&1
)

for /f "tokens=1" %%v in ('node -v 2^>nul') do set NODE_VERSION=%%v
echo [*] Phien ban Node: %NODE_VERSION%
echo [*] Web Client: http://127.0.0.1:5173
echo.

start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173'"

call npx --yes pnpm@10.34.6 --filter @prompt-chien/web dev
