@echo off
echo ========================================
echo   Auth 按键精灵插件反注册工具
echo ========================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 请右键选择"以管理员身份运行"
    pause
    exit /b 1
)

set "DLL_PATH=%~dp0Auth.dll"

if not exist "%DLL_PATH%" (
    echo [错误] 未找到 Auth.dll
    pause
    exit /b 1
)

echo 正在反注册: %DLL_PATH%
regsvr32 /u /s "%DLL_PATH%"

if %errorlevel% equ 0 (
    echo [成功] COM 组件已反注册
) else (
    echo [失败] 反注册失败
)

echo.
pause
