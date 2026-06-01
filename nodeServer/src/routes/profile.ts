import { Router } from "express";
import { respond, respondError, authMiddleware, type AuthRequest } from "../middlewares/auth";
import { hashPassword, verifyPassword } from "../utils";
import { execute, query } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

router.get("/", (req: AuthRequest, res) => {
  const { passwordHash: _pwd, ...safeUser } = req.user || ({} as any);
  return respond(res, safeUser);
});

router.put("/", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { email, phone, remark, avatar, departmentId } = req.body || {};

  await execute(
    `UPDATE ${table("users")}
     SET email = ?,
         phone = ?,
         remark = ?,
         avatar = ?,
         department_id = ?,
         updated_at = ?
     WHERE id = ?`,
    [email ?? null, phone ?? null, remark ?? null, avatar ?? null, departmentId ?? null, Date.now(), userId]
  );

  const { passwordHash: _pwd, ...safeUser } = { ...req.user!, email, phone, remark, avatar, departmentId };
  return respond(res, safeUser);
});

router.put("/password", async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!verifyPassword(oldPassword || "", req.user!.passwordHash)) return respondError(res, "原密码错误", 400);
  await execute(`UPDATE ${table("users")} SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    hashPassword(newPassword || "123456"),
    Date.now(),
    req.user!.id,
  ]);
  return respond(res, {});
});

router.get("/logs", async (req: AuthRequest, res) => {
  const rows = await query(
    `SELECT id, action, user, created_at
     FROM ${table("logs")}
     WHERE log_type = 'operation' AND user = ?
     ORDER BY created_at DESC
     LIMIT 200`,
    [req.user!.username]
  );
  return respond(res, rows.map((r: any) => ({ id: r.id, action: r.action, user: r.user, createdAt: Number(r.created_at) })));
});

export default router;
