import { Router } from "express";
import jwt from "jsonwebtoken";
import { SECRET } from "../config";
import { uuid, type User } from "../db";
import { respond, respondError, authMiddleware, type AuthRequest } from "../middlewares/auth";
import { hashPassword, verifyPassword } from "../utils";
import { execute, query, queryOne, withTransaction } from "../db/mysql";
import { table } from "../db/tables";
import { sendVerificationEmail } from "../utils/mailer";

const router = Router();

const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

const randomEmailCode = () => Math.floor(Math.random() * 900000 + 100000).toString();

type EmailCodePurpose = "register" | "reset";

const issueEmailCode = async (email: string, purpose: EmailCodePurpose) => {
  const now = Date.now();
  const last = await queryOne<{ created_at: number }>(
    `SELECT created_at FROM ${table("email_codes")} WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`,
    [email, purpose]
  );
  if (last?.created_at && now - Number(last.created_at) < 60_000) {
    return { ok: false as const, message: "请求过于频繁，请稍后再试" };
  }

  const id = uuid();
  const code = randomEmailCode();
  const expireMinutes = 10;
  const expireAt = now + expireMinutes * 60_000;

  await withTransaction(async (conn) => {
    // 唯一性：同一邮箱+用途只保留最新的一个未使用验证码
    await conn.execute(
      `UPDATE ${table("email_codes")}
       SET used_at = ?
       WHERE email = ? AND purpose = ? AND used_at IS NULL`,
      [now, email, purpose]
    );

    await conn.execute(
      `INSERT INTO ${table("email_codes")} (id, email, code, purpose, expire_at, used_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      [id, email, code, purpose, expireAt, now]
    );
  });

  try {
    await sendVerificationEmail({ to: email, code, purpose, expireMinutes });
  } catch (err) {
    // 发送失败时立即失效，避免“没收到但验证码仍可用”
    await execute(`UPDATE ${table("email_codes")} SET used_at = ? WHERE id = ? AND used_at IS NULL`, [Date.now(), id]);
    throw err;
  }

  const debug = process.env.VERIFYSYS_EMAIL_DEBUG === "1" || process.env.NODE_ENV !== "production";
  return { ok: true as const, id, expireAt, debugCode: debug ? code : undefined };
};

const verifyEmailCode = async (email: string, purpose: EmailCodePurpose, code: string) => {
  const now = Date.now();
  const row = await queryOne<{ id: string; expire_at: number }>(
    `SELECT id, expire_at
     FROM ${table("email_codes")}
     WHERE email = ? AND purpose = ? AND code = ? AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose, code]
  );

  if (!row) return { ok: false as const, message: "验证码错误或已失效" };
  if (Number(row.expire_at) < now) return { ok: false as const, message: "验证码已过期，请重新获取" };

  return { ok: true as const, id: row.id, expireAt: Number(row.expire_at) };
};

router.post("/email-code", async (req, res) => {
  const rawEmail = req.body?.email;
  const rawPurpose = req.body?.purpose;

  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const purpose = rawPurpose === "register" || rawPurpose === "reset" ? (rawPurpose as EmailCodePurpose) : null;

  if (!email) return respondError(res, "邮箱缺失", 400);
  if (!isEmail(email)) return respondError(res, "邮箱格式不正确", 400);
  if (!purpose) return respondError(res, "purpose 必须是 register 或 reset", 400);

  try {
    const issued = await issueEmailCode(email, purpose);
    if (!issued.ok) return respondError(res, issued.message, 429);
    return respond(res, { expireAt: issued.expireAt, debugCode: issued.debugCode });
  } catch (err: any) {
    return respondError(res, err?.message || "邮件发送失败", 500);
  }
});

router.post("/register", async (req, res) => {
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;
  const rawEmail = req.body?.email;
  const rawEmailCode = req.body?.emailCode;

  const username = typeof rawUsername === "string" ? rawUsername.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const emailCode = typeof rawEmailCode === "string" ? rawEmailCode.trim() : "";

  if (!username || !password) return respondError(res, "用户名或密码缺失", 400);
  if (username.length < 3 || username.length > 32) return respondError(res, "用户名长度需为 3-32", 400);
  if (password.length < 6 || password.length > 64) return respondError(res, "密码长度需为 6-64", 400);
  if (!email) return respondError(res, "邮箱缺失", 400);
  if (!isEmail(email)) return respondError(res, "邮箱格式不正确", 400);
  if (email.length > 128) return respondError(res, "邮箱过长", 400);
  if (!emailCode) return respondError(res, "邮箱验证码缺失", 400);

  const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE username = ?`, [username]);
  if (exists) return respondError(res, "用户名已存在");

  const emailExists = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE email = ?`, [email]);
  if (emailExists) return respondError(res, "邮箱已被注册", 400);

  const verified = await verifyEmailCode(email, "register", emailCode);
  if (!verified.ok) return respondError(res, verified.message, 400);

  const id = uuid();
  const now = Date.now();

  await withTransaction(async (conn) => {
    const [used] = await conn.execute(
      `UPDATE ${table("email_codes")} SET used_at = ? WHERE id = ? AND used_at IS NULL AND expire_at >= ?`,
      [now, verified.id, now]
    );
    if ((used as any)?.affectedRows === 0) throw new Error("验证码已使用或已过期");

    await conn.execute(
      `INSERT INTO ${table("users")} (id, username, password_hash, status, email, phone, department_id, remark, avatar, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, NULL, NULL, NULL, NULL, ?, ?)`,
      [id, username, hashPassword(password), email || null, now, now]
    );
    await conn.execute(`INSERT INTO ${table("user_roles")} (user_id, role_id) VALUES (?, 'role-ops')`, [id]);
  });

  return respond(res, { id });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const remember = Boolean(req.body?.remember);
  if (!username || !password) return respondError(res, "用户名或密码缺失", 401);

  const row = await queryOne<{
    id: string;
    username: string;
    password_hash: string;
    status: string;
  }>(`SELECT id, username, password_hash, status FROM ${table("users")} WHERE username = ?`, [username]);

  const now = Date.now();
  const ip = req.ip || "";

  if (!row) {
    await execute(
      `INSERT INTO ${table("logs")} (id, log_type, user, status, ip, created_at) VALUES (?, 'login', ?, 'not_found', ?, ?)`,
      [uuid(), username, ip, now]
    );
    return respondError(res, "用户不存在", 401);
  }
  if (row.status === "disabled") {
    await execute(
      `INSERT INTO ${table("logs")} (id, log_type, user, status, ip, created_at) VALUES (?, 'login', ?, 'disabled', ?, ?)`,
      [uuid(), username, ip, now]
    );
    return respondError(res, "账号已禁用", 403);
  }
  if (!verifyPassword(password, row.password_hash)) {
    await execute(
      `INSERT INTO ${table("logs")} (id, log_type, user, status, ip, created_at) VALUES (?, 'login', ?, 'bad_password', ?, ?)`,
      [uuid(), username, ip, now]
    );
    return respondError(res, "密码错误", 401);
  }

  const roleRows = await query<{ role_id: string }>(`SELECT role_id FROM ${table("user_roles")} WHERE user_id = ?`, [
    row.id,
  ]);
  const roleIds = roleRows.map((r) => r.role_id);
  const token = jwt.sign({ userId: row.id, roles: roleIds }, SECRET, { expiresIn: remember ? "7d" : "12h" });

  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, user, status, ip, created_at) VALUES (?, 'login', ?, 'success', ?, ?)`,
    [uuid(), username, ip, now]
  );

  const user: Pick<User, "id" | "username" | "roleIds"> = { id: row.id, username: row.username, roleIds };
  return respond(res, { token, user: { id: user.id, username: user.username, roles: user.roleIds } });
});

router.post("/logout", (_req, res) => respond(res, {}));

router.post("/refresh-token", authMiddleware, async (req: AuthRequest, res) => {
  const token = jwt.sign({ userId: req.user!.id, roles: req.user!.roleIds }, SECRET, { expiresIn: "2h" });
  return respond(res, { token });
});

router.post("/send-code", (_req, res) => {
  const code = Math.floor(Math.random() * 900000 + 100000).toString();
  return respond(res, { code }, "验证码发送成功");
});

router.post("/reset-password", async (req, res) => {
  const rawEmail = req.body?.email;
  const rawEmailCode = req.body?.emailCode;
  const rawNewPassword = req.body?.newPassword;

  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const emailCode = typeof rawEmailCode === "string" ? rawEmailCode.trim() : "";
  const newPassword = typeof rawNewPassword === "string" ? rawNewPassword : "";

  // 新流程：邮箱 + 验证码
  if (email) {
    if (!isEmail(email)) return respondError(res, "邮箱格式不正确", 400);
    if (!emailCode) return respondError(res, "邮箱验证码缺失", 400);
    if (!newPassword) return respondError(res, "新密码缺失", 400);
    if (newPassword.length < 6 || newPassword.length > 64) return respondError(res, "密码长度需为 6-64", 400);

    const userRow = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE email = ?`, [email]);
    if (!userRow) return respondError(res, "该邮箱未注册", 404);

    const verified = await verifyEmailCode(email, "reset", emailCode);
    if (!verified.ok) return respondError(res, verified.message, 400);

    const now = Date.now();
    await withTransaction(async (conn) => {
      const [used] = await conn.execute(
        `UPDATE ${table("email_codes")} SET used_at = ? WHERE id = ? AND used_at IS NULL AND expire_at >= ?`,
        [now, verified.id, now]
      );
      if ((used as any)?.affectedRows === 0) throw new Error("验证码已使用或已过期");

      const pwd = hashPassword(newPassword);
      await conn.execute(`UPDATE ${table("users")} SET password_hash = ?, updated_at = ? WHERE id = ?`, [pwd, now, userRow.id]);
    });

    return respond(res, {});
  }

  // 旧流程兼容：username 直接重置（仅用于开发/内部）
  const { username } = req.body || {};
  if (!username) return respondError(res, "用户名缺失", 400);
  const row = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE username = ?`, [username]);
  if (!row) return respondError(res, "用户不存在", 404);
  const pwd = hashPassword(newPassword || "123456");
  await execute(`UPDATE ${table("users")} SET password_hash = ?, updated_at = ? WHERE id = ?`, [pwd, Date.now(), row.id]);
  return respond(res, {});
});

export default router;
