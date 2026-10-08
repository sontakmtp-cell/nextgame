@echo off
setlocal
title PROMPT Chien - Khoi dong ung dung
pushd "%~dp0"
if errorlevel 1 goto folder_error

where node >nul 2>nul
if errorlevel 1 (
  echo Chua tim thay Node.js. Hay cai Node.js 24.18.0 roi thu lai.
  goto failed
)
if not exist "node_modules\typescript\bin\tsc" goto missing_dependencies
if not exist "apps\web\node_modules\vite\bin\vite.js" goto missing_dependencies

echo Dang chuan bi ung dung...
node "node_modules\typescript\bin\tsc" -b
if errorlevel 1 goto failed
if /i "%~1"=="--check" (
  echo Kiem tra khoi dong thanh cong.
  popd
  exit /b 0
)

set "START_PAGE=/?presentation=3d"
if /i "%~1"=="2d" set "START_PAGE=/?presentation=2d"
echo.
echo Dia chi: http://127.0.0.1:5173%START_PAGE%
echo Giu cua so nay mo khi su dung. Bam Ctrl+C de dung ung dung.
echo.
if /i "%~1"=="--no-open" (
  node "apps\web\node_modules\vite\bin\vite.js" "apps/web" --host 127.0.0.1 --port 5173 --strictPort
) else (
  node "apps\web\node_modules\vite\bin\vite.js" "apps/web" --host 127.0.0.1 --port 5173 --strictPort --open "%START_PAGE%"
)
if errorlevel 1 goto failed
popd
exit /b 0

:missing_dependencies
echo Chua co du thu vien cua du an. Chay lenh sau trong thu muc nay:
echo npx --yes pnpm@10.34.6 install --frozen-lockfile
goto failed

:failed
echo.
echo Khong khoi dong duoc. Xem thong bao loi phia tren.
echo Neu cong 5173 dang duoc su dung, kiem tra ung dung da mo truoc do.
pause
popd
exit /b 1

:folder_error
echo Khong mo duoc thu muc chua file Khoi-dong.cmd.
pause
exit /b 1
