// client.ts — 客户端验证 API（给 DLL / 按键精灵调用，无需后台登录 token）
import { Request, Response, Router } from "express";
import { uuid } from "../db";
import { execute, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import {
  buildBodyHash,
  buildSignatureMaterial,
  clientFail,
  clientOk,
  normalizeClientRequest,
  signHmacSha256,
  type NormalizedClientRequest,
} from "../services/clientProtocol";

const router = Router();

// ============================================================
// 简易 token 存储（内存，生产环境建议用 Redis 或 DB 表）
// key: token → { code, projectId, machineCode, expireAt, createdAt }
// ============================================================
interface Session {
  code: string;
  projectId: string;
  machineCode: string;
  expireAt: number;
  createdAt: number;
}
const sessions = new Map<string, Session>();
const usedNonces = new Map<string, number>();

// 清理过期 session（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  sessions.forEach((v, k) => {
    if (now - v.createdAt > 24 * 3600_000) sessions.delete(k);
  });
  usedNonces.forEach((createdAt, key) => {
    if (now - createdAt > 5 * 60_000) usedNonces.delete(key);
  });
}, 5 * 60_000);

// ============================================================
// 辅助
// ============================================================
const cardTypeExpireMs = (cardType: string) => {
  const day = 86400000;
  const map: Record<string, number> = {
    trial: 1 * day, hour: 3600000, day: 1 * day, week: 7 * day,
    month: 30 * day, quarter: 90 * day, half_year: 180 * day,
    year: 365 * day, permanent: 3650 * day,
  };
  return map[cardType] || 30 * day;
};

/** 同步单条注册码的状态（过期判断） */
const syncCodeStatus = async (code: string) => {
  const row = await queryOne<{
    id: string; project_id: string; project_name: string; status: string; is_bound: number;
    machine_code: string | null; activated_at: number | null; expire_at: number | null;
    card_type: string;
  }>(
    `SELECT id, project_id, project_name, status, is_bound, machine_code, activated_at, expire_at, card_type
     FROM ${table("register_codes")} WHERE code = ?`,
    [code]
  );

  if (!row || !row.activated_at) return row;

  const duration = cardTypeExpireMs(row.card_type);
  const correctExpire = Math.max(row.expire_at || 0, row.activated_at + duration);

  if (correctExpire !== row.expire_at) {
    await execute(`UPDATE ${table("register_codes")} SET expire_at = ? WHERE id = ?`, [correctExpire, row.id]);
    row.expire_at = correctExpire;
  }

  const now = Date.now();
  let newStatus = row.status;
  if (row.expire_at && row.expire_at < now && row.status !== "deleted") {
    newStatus = "expired";
  } else if (row.activated_at && (!row.expire_at || row.expire_at >= now)) {
    newStatus = "in_use";
  }
  if (newStatus !== row.status) {
    await execute(`UPDATE ${table("register_codes")} SET status = ? WHERE id = ?`, [newStatus, row.id]);
    row.status = newStatus;
  }
  return row;
};

const formatTime = (value: number | null | undefined) => {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const remainSeconds = (expireAt: number | null | undefined) => {
  if (!expireAt) return 0;
  return Math.max(0, Math.floor((expireAt - Date.now()) / 1000));
};

const parseJsonObj = (val: any): Record<string, any> => {
  if (!val) return {};
  if (typeof val === "object") return val;
  try {
    const parsed = JSON.parse(String(val));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const findProject = async (appId: string) =>
  queryOne<{ id: string; name: string; config: any }>(
    `SELECT id, name FROM ${table("projects")} WHERE id = ? OR name = ?`,
    [appId, appId]
  );

const buildLicenseData = (rc: any, sessionId: string) => ({
  sessionId,
  token: sessionId,
  licenseCode: rc.code,
  status: rc.status,
  activatedAt: rc.activated_at || null,
  expireAt: rc.expire_at || null,
  expireAtText: formatTime(rc.expire_at),
  remainSeconds: remainSeconds(rc.expire_at),
  cardType: rc.card_type,
});

const bodyWithoutSign = (body: any) => {
  const clone = { ...(body || {}) };
  delete clone.sign;
  return clone;
};

const validateClientSignature = (req: Request, input: NormalizedClientRequest, project: { id: string; config: any }) => {
  const config = parseJsonObj(project.config);
  const secret = String(config.appSecret || config.secret || process.env.CLIENT_DEV_SECRET || "");
  if (!secret) return null;

  const now = Date.now();
  const maxSkewMs = Number(config.signatureWindowSeconds || 300) * 1000;
  if (!input.timestamp || Math.abs(now - input.timestamp) > maxSkewMs) {
    return clientFail(1007, "请求已过期");
  }
  if (!input.nonce) return clientFail(400, "参数不完整");

  const nonceKey = `${project.id}:${input.nonce}`;
  if (usedNonces.has(nonceKey)) return clientFail(1008, "重放请求");

  const material = buildSignatureMaterial({
    method: req.method,
    path: `${req.baseUrl}${req.path}`,
    appId: input.appId,
    licenseCode: input.licenseCode,
    machineCode: input.machineCode,
    timestamp: input.timestamp,
    nonce: input.nonce,
    bodyHash: buildBodyHash(bodyWithoutSign(req.body)),
  });
  const expected = signHmacSha256(material, secret);
  if (!input.sign || expected.toLowerCase() !== input.sign.toLowerCase()) {
    return clientFail(1006, "签名错误");
  }

  usedNonces.set(nonceKey, now);
  return null;
};

const handleVerify = async (req: Request, res: Response) => {
  const input = normalizeClientRequest(req.body || {});
  if (!input.appId || !input.licenseCode || !input.machineCode) {
    return res.json(clientFail(400, "参数不完整"));
  }

  const project = await findProject(input.appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));
  const signatureError = validateClientSignature(req, input, project);
  if (signatureError) return res.json(signatureError);

  const regCode = await syncCodeStatus(input.licenseCode);
  if (!regCode) return res.json(clientFail(1001, "注册码无效"));

  const rc = regCode as any;
  rc.code = input.licenseCode;

  // 检查项目归属
  if (rc.project_id !== project.id) return res.json(clientFail(1001, "注册码不属于该项目"));

  // 检查状态
  if (rc.status === "deleted") return res.json(clientFail(1001, "注册码无效"));
  if (rc.status === "frozen") return res.json(clientFail(1004, "注册码已被冻结"));
  if (rc.status === "expired") return res.json(clientFail(1002, "注册码已过期"));
  if (rc.status === "unused") {
    // 首次使用 → 激活
    const now = Date.now();
    const duration = cardTypeExpireMs(rc.card_type);
    const expireAt = now + duration;
    await execute(
      `UPDATE ${table("register_codes")} SET status = 'in_use', activated_at = ?, expire_at = ?, machine_code = ?, is_bound = 1, last_login_at = ?, last_login_ip = ? WHERE id = ?`,
      [now, expireAt, input.machineCode, now, req.ip, rc.id]
    );
    // 生成 token
    const sessionId = uuid();
    sessions.set(sessionId, { code: input.licenseCode, projectId: project.id, machineCode: input.machineCode, expireAt, createdAt: now });
    return res.json(clientOk(buildLicenseData({
      ...rc,
      status: "in_use",
      activated_at: now,
      expire_at: expireAt,
    }, sessionId), "激活成功"));
  }

  // in_use → 检查机器码绑定
  if (rc.is_bound && rc.machine_code && rc.machine_code !== input.machineCode) {
    return res.json(clientFail(1003, "机器码不匹配，该注册码已绑定其他机器"));
  }

  // 更新登录信息
  const now = Date.now();
  const expireAt = rc.expire_at || 0;
  await execute(
    `UPDATE ${table("register_codes")} SET last_login_at = ?, last_login_ip = ?, is_online = 1, machine_code = ? WHERE id = ?`,
    [now, req.ip, input.machineCode, rc.id]
  );

  const sessionId = uuid();
  sessions.set(sessionId, { code: input.licenseCode, projectId: project.id, machineCode: input.machineCode, expireAt, createdAt: now });

  // 记录日志
  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, action, user, status, ip, message, created_at) VALUES (?, 'client', 'login', ?, 'success', ?, ?, ?)`,
    [uuid(), input.licenseCode, req.ip, `注册码 ${input.licenseCode} 登录成功`, now]
  );

  return res.json(clientOk(buildLicenseData(rc, sessionId), "验证成功"));
};

// ============================================================
// POST /api/client/verify — 正式注册码验证
// ============================================================
router.post("/verify", handleVerify);

// ============================================================
// POST /api/client/login — 兼容旧客户端
// ============================================================
router.post("/login", handleVerify);

// ============================================================
// POST /api/client/heartbeat — 心跳
// ============================================================
router.post("/heartbeat", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  const sessionId = input.sessionId || String((req.body || {}).token || "");
  if (!sessionId || !sessions.has(sessionId)) return res.json(clientFail(1012, "无效会话"));

  const session = sessions.get(sessionId)!;
  if (input.machineCode && session.machineCode !== input.machineCode) {
    return res.json(clientFail(1003, "机器码不匹配"));
  }

  // 检查注册码是否仍然有效
  const rc = await syncCodeStatus(session.code) as any;
  if (!rc || rc.status === "expired") return res.json(clientFail(1002, "注册码已过期"));
  if (rc.status === "frozen") return res.json(clientFail(1004, "注册码已被冻结"));

  await execute(`UPDATE ${table("register_codes")} SET is_online = 1, last_login_at = ? WHERE code = ?`, [Date.now(), session.code]);

  rc.code = session.code;
  return res.json(clientOk(buildLicenseData(rc, sessionId)));
});

// ============================================================
// POST /api/client/logout — 登出
// ============================================================
router.post("/logout", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  const sessionId = input.sessionId || String((req.body || {}).token || "");
  if (!sessionId || !sessions.has(sessionId)) return res.json(clientFail(1012, "无效会话"));

  const session = sessions.get(sessionId)!;
  sessions.delete(sessionId);

  await execute(`UPDATE ${table("register_codes")} SET is_online = 0 WHERE code = ?`, [session.code]);

  return res.json(clientOk(null, "已登出"));
});

// ============================================================
// POST /api/client/unbind — 解绑机器码
// ============================================================
router.post("/unbind", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  const { unbindPassword } = req.body || {};
  if (!input.appId || !input.licenseCode) return res.json(clientFail(400, "参数不完整"));

  const project = await findProject(input.appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));
  const signatureError = validateClientSignature(req, input, project);
  if (signatureError) return res.json(signatureError);

  const rc = await queryOne<{ id: string; project_id: string; unbind_password: string | null; machine_code: string | null }>(
    `SELECT id, project_id, unbind_password, machine_code FROM ${table("register_codes")} WHERE code = ?`, [input.licenseCode]
  );
  if (!rc) return res.json(clientFail(1001, "注册码无效"));
  if (rc.project_id !== project.id) return res.json(clientFail(1001, "注册码不属于该项目"));

  const password = String(unbindPassword || "");
  const isLocalUnbind = input.machineCode && rc.machine_code && rc.machine_code === input.machineCode;
  if (!isLocalUnbind && rc.unbind_password && rc.unbind_password !== password) {
    return res.json(clientFail(2002, "解绑密码错误"));
  }

  await execute(
    `UPDATE ${table("register_codes")} SET machine_code = NULL, is_bound = 0, is_online = 0 WHERE id = ?`,
    [rc.id]
  );

  // 清除相关 session
  sessions.forEach((v, k) => {
    if (v.code === input.licenseCode) sessions.delete(k);
  });

  return res.json(clientOk(null, "解绑成功"));
});

// ============================================================
// POST /api/client/trial-login — 试用登录
// ============================================================
router.post("/trial-login", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  if (!input.appId || !input.machineCode) return res.json(clientFail(400, "参数不完整"));

  const project = await findProject(input.appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));
  const signatureError = validateClientSignature(req, input, project);
  if (signatureError) return res.json(signatureError);

  // 查项目配置中是否允许试用
  const policy = await queryOne<{ config: string | null }>(
    `SELECT config FROM ${table("security_policies")} WHERE project_id = ? AND status = 'enabled'`,
    [project.id]
  );

  const config = policy?.config ? (typeof policy.config === "string" ? JSON.parse(policy.config) : policy.config) : {};
  const trialMinutes = Number(config.trialMinutes || 0);

  if (trialMinutes <= 0) return res.json(clientFail(2001, "该项目不支持试用"));

  // 简单防刷：同一个机器码只允许试用一次（可改为更严格的逻辑）
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM ${table("register_codes")} WHERE project_id = ? AND machine_code = ? AND sale_type = 'trial' LIMIT 1`,
    [project.id, input.machineCode]
  );
  if (existing) return res.json(clientFail(2001, "该机器已使用过试用"));

  // 创建试用注册码
  const now = Date.now();
  const expireAt = now + trialMinutes * 60000;
  const trialCode = uuid();
  await execute(
    `INSERT INTO ${table("register_codes")} (id, code, project_id, project_name, card_type, status, is_online, is_bound, machine_code, activated_at, expire_at, sale_type, created_at)
     VALUES (?, ?, ?, ?, 'trial', 'in_use', 1, 1, ?, ?, ?, 'trial', ?)`,
    [uuid(), trialCode, project.id, project.name, input.machineCode, now, expireAt, now]
  );

  const sessionId = uuid();
  sessions.set(sessionId, { code: trialCode, projectId: project.id, machineCode: input.machineCode, expireAt, createdAt: now });

  return res.json(clientOk({
    sessionId,
    token: sessionId,
    licenseCode: trialCode,
    status: "in_use",
    activatedAt: now,
    expireAt,
    expireAtText: formatTime(expireAt),
    remainSeconds: remainSeconds(expireAt),
    cardType: "trial",
    trialMinutes,
  }, "试用登录成功"));
});

// ============================================================
// POST /api/client/charge — 充值卡充值
// ============================================================
router.post("/charge", async (req, res) => {
  const { code, cardCode, machineCode } = req.body || {};
  if (!code || !cardCode) return res.json(clientFail(400, "参数不完整"));

  const rc = await syncCodeStatus(code) as any;
  if (!rc) return res.json(clientFail(1001, "注册码无效"));

  // 充值卡逻辑：这里简单实现，实际可以复用注册码体系做充值卡
  // 暂时返回不支持
  return res.json(clientFail(400, "充值卡功能暂未开放"));
});

// ============================================================
// GET /api/client/placard — 获取公告
// ============================================================
router.get("/placard", async (req, res) => {
  const appId = String(req.query.appId || req.query.projectToken || "");
  if (!appId) return res.json(clientFail(400, "参数不完整"));

  // 从通知表取最新公告
  const rows = await queryOne<{ title: string; content: string; created_at: number }>(
    `SELECT title, content, created_at FROM ${table("notifications")} WHERE category = 'system' ORDER BY created_at DESC LIMIT 1`
  );

  if (!rows) return res.json(clientOk(null, "暂无公告"));
  return res.json(clientOk({ title: rows.title, content: rows.content, createdAt: rows.created_at }));
});

// ============================================================
// GET /api/client/server-time — 获取服务器时间
// ============================================================
router.get("/server-time", (_req, res) => {
  return res.json(clientOk({ timestamp: Date.now() }));
});

// ============================================================
// GET /api/client/custom-data — 读取自定义数据
// ============================================================
router.get("/custom-data", async (req, res) => {
  const appId = String(req.query.appId || req.query.projectToken || "");
  const key = String(req.query.key || "");
  if (!appId || !key) return res.json(clientFail(400, "参数不完整"));

  const project = await findProject(appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));

  const row = await queryOne<{ value: string }>(
    `SELECT value FROM ${table("custom_data")} WHERE project_id = ? AND \`key\` = ?`,
    [project.id, key]
  );

  return res.json(clientOk({ value: row?.value || "" }));
});

// ============================================================
// GET /api/client/license-info — 获取注册码信息
// ============================================================
router.get("/license-info", async (req, res) => {
  const input = normalizeClientRequest(req.query as Record<string, string>);
  const sessionId = input.sessionId || String(req.query.token || "");
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const licenseCode = session?.code || input.licenseCode;

  if (!licenseCode) return res.json(clientFail(400, "参数不完整"));

  const rc = await syncCodeStatus(licenseCode) as any;
  if (!rc) return res.json(clientFail(1001, "注册码无效"));
  if (session && input.machineCode && session.machineCode !== input.machineCode) {
    return res.json(clientFail(1003, "机器码不匹配"));
  }

  rc.code = licenseCode;
  return res.json(clientOk(buildLicenseData(rc, sessionId)));
});

// ============================================================
// POST /api/client/client-info — 上报客户端信息
// ============================================================
router.post("/client-info", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  const sessionId = input.sessionId || String((req.body || {}).token || "");
  const session = sessionId ? sessions.get(sessionId) : undefined;
  const licenseCode = session?.code || input.licenseCode;
  const clientInfo = String((req.body || {}).clientInfo || "");

  if (!input.appId || !licenseCode || !clientInfo) return res.json(clientFail(400, "参数不完整"));
  const project = await findProject(input.appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));
  const signatureError = validateClientSignature(req, input, project);
  if (signatureError) return res.json(signatureError);
  if (session && input.machineCode && session.machineCode !== input.machineCode) {
    return res.json(clientFail(1003, "机器码不匹配"));
  }

  const rc = await queryOne<{ id: string }>(
    `SELECT id FROM ${table("register_codes")} WHERE code = ?`,
    [licenseCode]
  );
  if (!rc) return res.json(clientFail(1001, "注册码无效"));

  await execute(`UPDATE ${table("register_codes")} SET customer_info = ? WHERE id = ?`, [clientInfo.slice(0, 255), rc.id]);
  return res.json(clientOk(null, "保存成功"));
});

// ============================================================
// POST /api/client/report-event — 上报客户端事件
// ============================================================
router.post("/report-event", async (req, res) => {
  const input = normalizeClientRequest(req.body || {});
  const name = String((req.body || {}).name || "");
  const message = String((req.body || {}).message || "");

  if (!input.appId || !name || !message) return res.json(clientFail(400, "参数不完整"));
  const project = await findProject(input.appId);
  if (!project) return res.json(clientFail(1005, "项目不存在"));
  const signatureError = validateClientSignature(req, input, project);
  if (signatureError) return res.json(signatureError);

  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, action, user, status, ip, message, created_at) VALUES (?, 'client', 'report-event', ?, 'info', ?, ?, ?)`,
    [uuid(), input.licenseCode || input.appId, req.ip, `${name}: ${message}`, Date.now()]
  );

  return res.json(clientOk(null, "上报成功"));
});

// ============================================================
// POST /api/client/custom-data — 禁止普通客户端写入自定义数据
// ============================================================
router.post("/custom-data", (_req, res) =>
  res.json(clientFail(400, "客户端不允许写入自定义数据，请使用 client-info 或 report-event"))
);

export default router;
