@echo off
echo ========================================
echo   Auth 按键精灵插件注册工具
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 请右键选择"以管理员身份运行"
    pause
    exit /b 1
)

:: 获取当前目录
set "DLL_PATH=%~dp0Auth.dll"

if not exist "%DLL_PATH%" (
    echo [错误] 未找到 Auth.dll
    echo 请确保 Auth.dll 与本脚本在同一目录
    pause
    exit /b 1
)

echo 正在注册: %DLL_PATH%
regsvr32 /s "%DLL_PATH%"

if %errorlevel% equ 0 (
    echo [成功] COM 组件注册成功！
    echo.
    echo 按键精灵调用方式：
    echo   Plugin.Auth.Init "http://127.0.0.1:3000", "p-1", "secret"
) else (
    echo [失败] 注册失败，请检查 DLL 是否匹配当前系统位数
    echo   32位 DLL → 用 %windir%\SysWOW64\regsvr32.exe
    echo   64位 DLL → 用 %windir%\System32\regsvr32.exe
)

echo.
pause
