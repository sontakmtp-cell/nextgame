# PROMPT Chiến — Script Khởi Động Nhanh (Mốc G2)
# Hỗ trợ Windows PowerShell (5.1) và PowerShell Core (pwsh 7+)
[CmdletBinding()]
param(
    [switch]$WebOnly
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  PROMPT CHIẾN — MỐC G2: PREMIUM VERTICAL SLICE" -ForegroundColor Cyan
Write-Host "  Workshop, Brain Lab, Arena Replay, Thực nghiệm đối đầu local" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kích hoạt môi trường Node 24 qua fnm
if (Get-Command fnm -ErrorAction SilentlyContinue) {
    Write-Host "[*] Kích hoạt môi trường Node 24 qua fnm..." -ForegroundColor Yellow
    fnm env --use-on-cd | Out-String | Invoke-Expression
    fnm use 24.18.0 | Out-Null
}

$nodeVer = & node -v
Write-Host "[*] Phiên bản Node hiện tại: $nodeVer" -ForegroundColor White

# 2. Khởi tạo file .env nếu chưa có
if (-not (Test-Path ".env")) {
    Write-Host "[*] Khởi tạo file .env..." -ForegroundColor Yellow
    npx --yes pnpm@10.34.6 env:init
}

Write-Host ""
if ($WebOnly) {
    Write-Host "[*] Chế độ: Chỉ chạy Web Client (Workshop + Brain Lab + Arena)..." -ForegroundColor Green
    Write-Host "[*] Địa chỉ: http://127.0.0.1:5173" -ForegroundColor White
} else {
    Write-Host "[*] Chế độ: Đầy đủ (Web Client + API Backend)..." -ForegroundColor Green
    Write-Host "[*] Web Client:  http://127.0.0.1:5173" -ForegroundColor White
    Write-Host "[*] API Backend: http://127.0.0.1:3001" -ForegroundColor White
}
Write-Host "[*] Tự động mở trình duyệt sau 2.5 giây..." -ForegroundColor Gray
Write-Host "[*] Nhấn Ctrl + C để dừng ứng dụng khi kết thúc." -ForegroundColor Gray
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 3. Mở trình duyệt sau 2.5 giây
Start-Job -ScriptBlock {
    Start-Sleep -Milliseconds 2500
    Start-Process "http://127.0.0.1:5173"
} | Out-Null

# 4. Khởi chạy
if ($WebOnly) {
    npx --yes pnpm@10.34.6 --filter @prompt-chien/web dev
} else {
    npx --yes pnpm@10.34.6 dev
}
