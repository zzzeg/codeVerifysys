# Auth.dll — 按键精灵网络验证插件

## 项目结构

```
client-com-dll/
├── VerifyCom/
│   ├── VerifyCom.idl        # COM 接口定义
│   ├── VerifyCom.h          # 头文件
│   ├── VerifyCom.cpp        # COM 框架 + 业务方法
│   ├── VerifyClient.cpp     # HTTP 通信 + 机器码采集
│   ├── dllmain.cpp          # DLL 入口
│   ├── VerifyCom.def        # 导出定义
│   ├── VerifyCom.rgs        # 注册表脚本
│   └── resource.h           # 资源定义
├── Auth.dll                 # 编译产物，复制到按键精灵 plugin 目录
├── Auth.html                # 按键精灵插件帮助文件
├── register.bat             # 注册 COM（管理员运行，调试用）
├── unregister.bat           # 反注册 COM
├── demo-按键精灵.vbs         # 按键精灵调用示例
└── README.md
```

## 编译方法

### 方法一：Visual Studio（推荐）

1. 安装 [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - 勾选「使用 C++ 的桌面开发」工作负载
2. 打开 x86 Native Tools Command Prompt（编译 32 位 DLL，兼容按键精灵）
3. 执行：
   ```bat
   cd /d D:\git\verifySys\client-com-dll\VerifyCom

   :: 编译为 32 位 DLL
   cl /EHsc /LD /O2 /DUNICODE /D_UNICODE ^
      VerifyCom.cpp VerifyClient.cpp dllmain.cpp ^
      /link /DEF:VerifyCom.def ^
      winhttp.lib iphlpapi.lib advapi32.lib crypt32.lib ^
      /OUT:..\VerifyCom.dll
   ```

### 方法二：MinGW

```bat
cd /d D:\git\verifySys\client-com-dll\VerifyCom

i686-w64-mingw32-g++ -shared -O2 -o ..\VerifyCom.dll ^
    VerifyCom.cpp VerifyClient.cpp dllmain.cpp ^
    -lwinhttp -liphlpapi -ladvapi32 -lcrypt32 ^
    -static -static-libgcc -static-libstdc++
```

## 使用流程

### 开发者（卖脚本的人）

1. 在管理后台注册账号
2. 创建项目，获得 **项目编号**（如 `p-1` 或自定义 token）
3. 在后台生成注册码，分发给用户
4. 把 `Auth.dll` 和 `Auth.html` 放到按键精灵 `plugin` 目录
5. 脚本里调用：

```vb
' 脚本开头：释放附件中的 DLL 并注册
PutAttachment ".\lib", "VerifyCom.dll"
Set ws = CreateObject("WScript.Shell")
ws.Run "regsvr32 /s .\lib\VerifyCom.dll", 0, True

' 创建验证对象
ret = Plugin.Auth.Init("http://127.0.0.1:3000", "项目编号", "项目密钥")
If ret <> 1 Then
    MsgBox "验证失败"
    ExitScript
End If

ret = Plugin.Auth.Verify("注册码")
If ret <> 1 Then
    MsgBox Plugin.Auth.GetLastMessage()
    ExitScript
End If
```

### 用户（用脚本的人）

1. 收到开发者给的注册码
2. 运行脚本，自动验证
3. 如需换电脑，找开发者解绑或用解绑密码自助解绑

## COM 接口一览

| 方法 | 参数 | 说明 |
|------|------|------|
| `Init` | serverUrl, appId, appSecret | 初始化 |
| `Verify` | 注册码 | 验证注册码 |
| `Heartbeat` | 无 | 心跳保活 |
| `Logout` | 无 | 登出 |
| `UnbindEx` | 注册码, 解绑密码 | 解绑机器码 |
| `GetMachineCode` | (无) | 获取本机机器码 |
| `GetPlacard` | (无) | 获取公告 |
| `GetServerTime` | (无) | 获取服务器时间 |
| `TrialLogin` | (无) | 试用登录 |
| `Charge` | 注册码, 充值卡号, 机器码 | 充值续期 |
| `GetCustomData` | key | 读取自定义数据 |
| `SetClientInfo` | textOrJson | 上报客户端信息 |
| `ReportEvent` | name, message | 上报客户端事件 |

## 返回值格式

所有方法返回 JSON 字符串：

```json
{
  "success": true,
  "code": 0,
  "message": "验证成功",
  "data": { ... }
}
```

错误码对照：
- `0` — 成功
- `1001` — 注册码无效
- `1002` — 注册码已过期
- `1003` — 机器码不匹配（已绑定其他机器）
- `1004` — 注册码已被冻结
- `1005` — 项目不存在
- `2001` — 试用已过期
- `2002` — 解绑密码错误
- `-1` — 网络错误

## 对接后端

DLL 调用的后端 API 路径为 `/api/client/*`，需要在 nodeServer 中实现。
详见项目根目录的 `nodeServer/src/routes/client.ts`。
