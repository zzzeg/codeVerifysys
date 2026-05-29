' ============================================================
' 按键精灵调用示例 — VerifySys 通用在线验证组件
' ============================================================

' 1. 创建 COM 对象
Set v = CreateObject("VerifySys.VerifyClient")

' （可选）如果你的后端不在默认地址，修改 API 地址
' Call v.SetApiBase("https://your-domain.com/api/client")

' 2. 获取本机机器码
machineCode = v.GetMachineCode()
MsgBox "机器码: " & machineCode

' ---- 配置项 ----
projectToken = "你的项目编号"   ' 在管理后台创建项目后获取
regCode      = "用户输入的注册码"

' ============================================================
' 场景1：注册码登录验证
' ============================================================
loginResult = v.Login(projectToken, regCode, machineCode)
MsgBox "登录结果: " & loginResult

' 返回值示例：
' 成功: {"success":true,"code":0,"message":"验证成功","data":{"token":"xxx","expireAt":1770000000000}}
' 失败: {"success":false,"code":1001,"message":"注册码无效","data":null}
' 过期: {"success":false,"code":1002,"message":"注册码已过期","data":null}
' 绑定: {"success":false,"code":1003,"message":"机器码不匹配","data":null}

' ---- 简单解析（按键精灵无 JSON 库，用字符串匹配） ----
If InStr(loginResult, """success"":true") > 0 Then
    ' 登录成功，可以提取 token 供心跳使用
    MsgBox "验证通过！"
Else
    MsgBox "验证失败！"
    ' 这里可以退出脚本
End If

' ============================================================
' 场景2：心跳保活（可选，定期调用保持在线状态）
' ============================================================
' 登录成功后拿到的 token
' token = "从登录结果中提取"
' heartbeatResult = v.Heartbeat(token)
' MsgBox "心跳结果: " & heartbeatResult

' ============================================================
' 场景3：登出（脚本结束时调用）
' ============================================================
' logoutResult = v.Logout(token)
' MsgBox "登出结果: " & logoutResult

' ============================================================
' 场景4：解绑机器码
' ============================================================
' unbindResult = v.Unbind(projectToken, regCode, "解绑密码", machineCode)
' MsgBox "解绑结果: " & unbindResult

' ============================================================
' 场景5：试用登录
' ============================================================
' trialResult = v.TrialLogin(projectToken, machineCode)
' MsgBox "试用结果: " & trialResult

' ============================================================
' 场景6：获取项目公告
' ============================================================
' placardResult = v.GetPlacard(projectToken)
' MsgBox "公告: " & placardResult

' ============================================================
' 场景7：充值卡充值
' ============================================================
' chargeResult = v.Charge(regCode, "充值卡卡号", machineCode)
' MsgBox "充值结果: " & chargeResult
