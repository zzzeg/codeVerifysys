import { Router } from "express";
import { uuid, type User, type UserStatus } from "../db";
import { respond, respondError, authMiddleware } from "../middlewares/auth";
import { execute, query, queryOne, withTransaction } from "../db/mysql";
import { table } from "../db/tables";
import { hashPassword } from "../utils";

const router = Router();
router.use(authMiddleware);

const parseRoleIds = (raw: string | null) => (raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : []);

const mapUserRow = (row: any): User => ({
  id: row.id,
  username: row.username,
  passwordHash: row.password_hash,
  roleIds: parseRoleIds(row.role_ids || null),
  email: row.email || undefined,
  phone: row.phone || undefined,
  status: row.status === "disabled" ? "disabled" : "active",
  departmentId: row.department_id || undefined,
  remark: row.remark || undefined,
  avatar: row.avatar || undefined,
});

router.get("/", async (req, res) => {
  const { keyword = "", page = "1", pageSize = "10", status } = req.query as Record<string, string>;
  const kw = (keyword || "").trim();
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  const where: string[] = [];
  const params: any[] = [];

  if (kw) {
    where.push("(u.username LIKE ? OR u.email LIKE ?)");
    params.push(`%${kw}%`, `%${kw}%`);
  }
  if (status) {
    where.push("u.status = ?");
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("users")} u ${whereSql}`, params);
  const rows = await query(
    `SELECT u.*,
            GROUP_CONCAT(ur.role_id) as role_ids
     FROM ${table("users")} u
     LEFT JOIN ${table("user_roles")} ur ON ur.user_id = u.id
     ${whereSql}
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );

  return respond(res, { total: totalRow?.c || 0, list: rows.map(mapUserRow) });
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(
    `SELECT u.*, GROUP_CONCAT(ur.role_id) as role_ids
     FROM ${table("users")} u
     LEFT JOIN ${table("user_roles")} ur ON ur.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id`,
    [req.params.id]
  );
  if (!row) return respondError(res, "未找到用户", 404);
  return respond(res, mapUserRow(row));
});

router.post("/", async (req, res) => {
  const { username, password = "123456", roleIds = [], email, phone, departmentId, remark } = req.body || {};
  if (!username) return respondError(res, "用户名必填");

  const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE username = ?`, [username]);
  if (exists) return respondError(res, "用户名已存在");

  const id = uuid();
  const now = Date.now();
  const status: UserStatus = "active";

  await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO ${table("users")} (id, username, password_hash, status, email, phone, department_id, remark, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [id, username, hashPassword(password), status, email || null, phone || null, departmentId || null, remark || null, now, now]
    );
    const uniqueRoleIds = Array.from(new Set((roleIds as string[]).filter(Boolean)));
    for (const roleId of uniqueRoleIds) {
      await conn.execute(`INSERT INTO ${table("user_roles")} (user_id, role_id) VALUES (?, ?)`, [id, roleId]);
    }
  });

  return respond(res, { id });
});

router.put("/:id", async (req, res) => {
  const userId = req.params.id;
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE id = ?`, [userId]);
  if (!existing) return respondError(res, "未找到用户", 404);

  const { roleIds, username, email, phone, departmentId, remark, status, avatar } = req.body || {};
  const now = Date.now();

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE ${table("users")}
       SET username = COALESCE(?, username),
           email = ?,
           phone = ?,
           department_id = ?,
           remark = ?,
           status = COALESCE(?, status),
           avatar = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        username || null,
        email ?? null,
        phone ?? null,
        departmentId ?? null,
        remark ?? null,
        status || null,
        avatar ?? null,
        now,
        userId,
      ]
    );

    if (Array.isArray(roleIds)) {
      await conn.execute(`DELETE FROM ${table("user_roles")} WHERE user_id = ?`, [userId]);
      const uniqueRoleIds = Array.from(new Set((roleIds as string[]).filter(Boolean)));
      for (const roleId of uniqueRoleIds) {
        await conn.execute(`INSERT INTO ${table("user_roles")} (user_id, role_id) VALUES (?, ?)`, [userId, roleId]);
      }
    }
  });

  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  const userId = req.params.id;
  await withTransaction(async (conn) => {
    await conn.execute(`DELETE FROM ${table("user_roles")} WHERE user_id = ?`, [userId]);
    await conn.execute(`DELETE FROM ${table("users")} WHERE id = ?`, [userId]);
  });
  return respond(res, {});
});

router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};
  const next = status === "active" ? "active" : "disabled";
  await execute(`UPDATE ${table("users")} SET status = ?, updated_at = ? WHERE id = ?`, [next, Date.now(), req.params.id]);
  return respond(res, {});
});

router.post("/:id/reset-pwd", async (req, res) => {
  const pwd = hashPassword(req.body?.password || "123456");
  await execute(`UPDATE ${table("users")} SET password_hash = ?, updated_at = ? WHERE id = ?`, [pwd, Date.now(), req.params.id]);
  return respond(res, {});
});

router.post("/batch-delete", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return respond(res, {});
  await withTransaction(async (conn) => {
    await conn.query(`DELETE FROM ${table("user_roles")} WHERE user_id IN (?)`, [ids]);
    await conn.query(`DELETE FROM ${table("users")} WHERE id IN (?)`, [ids]);
  });
  return respond(res, {});
});

router.get("/export", async (_req, res) => {
  const rows = await query(
    `SELECT u.*, GROUP_CONCAT(ur.role_id) as role_ids
     FROM ${table("users")} u
     LEFT JOIN ${table("user_roles")} ur ON ur.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return respond(res, { items: rows.map(mapUserRow).map((u) => ({ ...u, passwordHash: undefined })) });
});

export default router;

