@echo off
setlocal
title PROMPT Chien - Khoi Dong Nhanh (Moc G2)

echo ======================================================================
echo   PROMPT CHIEN - MOC G2: PREMIUM VERTICAL SLICE
echo   Workshop, Brain Lab, Arena Replay, Thuc nghiem doi dau local
echo ======================================================================
echo.

:: 1. Kich hoat moi truong Node 24 qua fnm neu co
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

:: 2. Kiem tra phien ban Node
for /f "tokens=1" %%v in ('node -v 2^>nul') do set NODE_VERSION=%%v
echo [*] Phien ban Node: %NODE_VERSION%

:: 3. Kiem tra file .env
if not exist .env (
    echo [*] Khoi tao file .env...
    call npx --yes pnpm@10.34.6 env:init
)

echo.
echo [*] Khoi chay he thong (Web Client + API Backend)...
echo [*] Web Client:  http://127.0.0.1:5173
echo [*] API Backend: http://127.0.0.1:3001
echo [*] Tu dong mo trinh duyet sau 3 giay...
echo [*] Nhan Ctrl + C de dung ung dung khi ket thuc.
echo ======================================================================
echo.

:: Tu dong mo trinh duyet sau 3 giay
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://127.0.0.1:5173'"

:: Khoi chay dev server
call npx --yes pnpm@10.34.6 dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Ung dung dung hoac loi (Exit code: %ERRORLEVEL%).
    pause
)
