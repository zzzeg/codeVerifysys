# Auth Client API Contract

本文档定义 `Auth.dll` 与 `verifySys/nodeServer` 的客户端接口合同。后台管理接口不使用本合同。

## 1. 通用约定

客户端正式字段统一使用 `camelCase`：

- `appId`：插件项目标识
- `licenseCode`：注册码
- `machineCode`：客户端本机硬件指纹哈希
- `timestamp`：客户端毫秒时间戳
- `nonce`：每次请求随机串
- `sign`：请求签名
- `clientVersion`：插件版本
- `protocolVersion`：协议版本，第一版固定为 `1`
- `sessionId`：验证成功后返回的在线会话标识

兼容期可临时接受旧字段：

- `projectToken` -> `appId`
- `code` -> `licenseCode`

进入 service 层前必须规范化为正式 DTO。

## 2. 签名规则

第一版请求签名使用 `HMAC-SHA256`。

签名材料按固定顺序拼接：

```text
METHOD
PATH
appId
licenseCode
machineCode
timestamp
nonce
bodyHash
```

规则：

- `METHOD` 使用大写，例如 `POST`。
- `PATH` 只包含路径，不包含域名和 query，例如 `/api/client/verify`。
- 空字段使用空字符串参与拼接。
- 每一项之间用换行符 `\n` 拼接。
- `bodyHash` 是请求体移除 `sign` 字段后，再做稳定 JSON 序列化得到的 SHA256 十六进制小写摘要。
- `sign` 是以上签名材料使用项目密钥计算出的 HMAC-SHA256 十六进制小写值。

服务端必须校验：

- `timestamp` 与服务器时间差不超过配置时间窗，默认 300 秒。
- 同一个 `appId + nonce` 在有效时间窗内只能使用一次。
- `sign` 必须与服务端计算结果一致。

本地联调期可以不配置项目密钥，此时服务端跳过签名校验。只要项目配置中存在 `appSecret` 或 `secret`，服务端必须强制校验签名。正式部署必须给每个项目配置密钥。

## 3. 统一响应结构

客户端接口统一返回：

```json
{
  "success": true,
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1760000000000,
  "sign": "server-response-sign"
}
```

说明：

- `success`：便于 DLL 和脚本快速判断。
- `code`：客户端业务码，成功固定为 `0`。
- `message`：可直接展示给脚本作者或最终用户。
- `data`：接口数据。
- `timestamp`：服务端响应时间。
- `sign`：服务端响应签名，第一阶段可预留为空，后续开启。

## 4. 接口列表

### POST `/api/client/verify`

用途：注册码验证。首次验证自动激活并绑定机器码。

请求：

```json
{
  "appId": "p-1",
  "licenseCode": "ABCD-EFGH",
  "machineCode": "sha256-machine-code",
  "timestamp": 1760000000000,
  "nonce": "random-nonce",
  "sign": "hmac",
  "clientVersion": "1.0.0",
  "protocolVersion": 1
}
```

成功响应：

```json
{
  "success": true,
  "code": 0,
  "message": "验证成功",
  "data": {
    "sessionId": "session-id",
    "licenseCode": "ABCD-EFGH",
    "status": "in_use",
    "activatedAt": 1760000000000,
    "expireAt": 1760086400000,
    "expireAtText": "2025-10-10 10:00:00",
    "remainSeconds": 86400,
    "cardType": "day"
  },
  "timestamp": 1760000000000,
  "sign": ""
}
```

### POST `/api/client/heartbeat`

用途：在线保活，并检查注册码是否冻结、过期、解绑、顶下线。

请求：

```json
{
  "appId": "p-1",
  "sessionId": "session-id",
  "licenseCode": "ABCD-EFGH",
  "machineCode": "sha256-machine-code",
  "timestamp": 1760000000000,
  "nonce": "random-nonce",
  "sign": "hmac",
  "clientVersion": "1.0.0",
  "protocolVersion": 1
}
```

### POST `/api/client/logout`

用途：主动下线当前会话。

请求字段同心跳。

### POST `/api/client/unbind`

用途：本机解绑或使用解绑密码解绑。

请求：

```json
{
  "appId": "p-1",
  "licenseCode": "ABCD-EFGH",
  "unbindPassword": "password-or-empty",
  "machineCode": "sha256-machine-code",
  "timestamp": 1760000000000,
  "nonce": "random-nonce",
  "sign": "hmac",
  "clientVersion": "1.0.0",
  "protocolVersion": 1
}
```

### POST `/api/client/trial-login`

用途：试用登录。

请求字段与 `verify` 相同，但不传 `licenseCode`。

### GET `/api/client/placard`

用途：获取公告。

query 字段：

- `appId`
- `timestamp`
- `nonce`
- `sign`

### GET `/api/client/custom-data`

用途：读取项目级自定义数据。

query 字段：

- `appId`
- `key`
- `timestamp`
- `nonce`
- `sign`

### GET `/api/client/license-info`

用途：获取当前注册码状态详情。

query 字段：

- `appId`
- `sessionId`
- `licenseCode`
- `machineCode`
- `timestamp`
- `nonce`
- `sign`

### POST `/api/client/client-info`

用途：上报当前客户端信息。

请求：

```json
{
  "appId": "p-1",
  "sessionId": "session-id",
  "licenseCode": "ABCD-EFGH",
  "machineCode": "sha256-machine-code",
  "clientInfo": "{\"os\":\"Windows\",\"script\":\"demo\"}",
  "timestamp": 1760000000000,
  "nonce": "random-nonce",
  "sign": "hmac",
  "clientVersion": "1.0.0",
  "protocolVersion": 1
}
```

### POST `/api/client/report-event`

用途：上报异常、风控、运行状态。

请求：

```json
{
  "appId": "p-1",
  "sessionId": "session-id",
  "licenseCode": "ABCD-EFGH",
  "machineCode": "sha256-machine-code",
  "name": "anti_debug",
  "message": "debugger detected",
  "timestamp": 1760000000000,
  "nonce": "random-nonce",
  "sign": "hmac",
  "clientVersion": "1.0.0",
  "protocolVersion": 1
}
```

## 5. 错误码

| code | message |
| --- | --- |
| `0` | 成功 |
| `400` | 参数不完整 |
| `1001` | 注册码无效 |
| `1002` | 注册码已过期 |
| `1003` | 机器码不匹配 |
| `1004` | 注册码已被冻结 |
| `1005` | 项目不存在 |
| `1006` | 签名错误 |
| `1007` | 请求已过期 |
| `1008` | 重放请求 |
| `1009` | 机器码已被封禁 |
| `1010` | 客户端版本过低 |
| `1011` | 协议版本不支持 |
| `1012` | 无效会话 |
| `1013` | 注册码正在被其他请求处理 |
| `2001` | 试用已过期或不可用 |
| `2002` | 解绑密码错误 |
| `5000` | 服务器内部错误 |
