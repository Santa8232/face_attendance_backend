# ADB Screenshot Script for Windows (PowerShell)
# This script captures the current screen of the connected Android device and pulls it to the local directory.

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$filename = "screenshot_$timestamp.png"
$remotePath = "/sdcard/screen.png"

Write-Host "Checking for connected devices..." -ForegroundColor Cyan
$devices = adb devices | Select-String -Pattern "\tdevice$"
if ($devices.Count -eq 0) {
    Write-Error "No devices connected via ADB."
    return
}

# Use the first device ID found
$deviceId = $devices[0].ToString().Split("`t")[0]
Write-Host "Targeting device: $deviceId" -ForegroundColor Yellow

Write-Host "Capturing screen..." -ForegroundColor Cyan
adb -s $deviceId shell screencap -p $remotePath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Pulling screenshot to local machine as $filename..." -ForegroundColor Cyan
    adb -s $deviceId pull $remotePath "./$filename"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success! Screenshot saved as $filename" -ForegroundColor Green
        # Clean up remote file
        adb -s $deviceId shell rm $remotePath
    } else {
        Write-Error "Failed to pull screenshot from device."
    }
} else {
    Write-Error "Failed to capture screen. Is the device connected and ADB enabled?"
}
