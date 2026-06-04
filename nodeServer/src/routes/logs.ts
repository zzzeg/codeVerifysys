import { Router } from "express";
import { respond, authMiddleware, requireAdmin } from "../middlewares/auth";
import { query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { getPagination } from "../utils/pagination";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin());

const fetchLogs = async (type: "operation" | "login" | "error", rawQuery: Record<string, any> = {}) => {
  const { pageSize, offset } = getPagination(rawQuery, 30);
  const totalRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("logs")} WHERE log_type = ?`, [type]);
  const rows = await query(`SELECT * FROM ${table("logs")} WHERE log_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
    type,
    pageSize,
    offset,
  ]);
  return { rows, total: Number(totalRow?.c || 0) };
};

router.get("/operation", async (req, res) => {
  const { rows, total } = await fetchLogs("operation", req.query as Record<string, any>);
  return respond(res, { total, list: rows.map((r: any) => ({ id: r.id, action: r.action, user: r.user, createdAt: Number(r.created_at) })) });
});

router.get("/login", async (req, res) => {
  const { rows, total } = await fetchLogs("login", req.query as Record<string, any>);
  return respond(res, { total, list: rows.map((r: any) => ({ id: r.id, user: r.user, status: r.status, ip: r.ip, createdAt: Number(r.created_at) })) });
});

router.get("/error", async (req, res) => {
  const { rows, total } = await fetchLogs("error", req.query as Record<string, any>);
  return respond(res, { total, list: rows.map((r: any) => ({ id: r.id, message: r.message, stack: r.stack, createdAt: Number(r.created_at) })) });
});

router.get("/export", async (_req, res) => {
  const [operationLogs, loginLogs, errorLogs] = await Promise.all([
    query(`SELECT * FROM ${table("logs")} WHERE log_type = ? ORDER BY created_at DESC`, ["operation"]),
    query(`SELECT * FROM ${table("logs")} WHERE log_type = ? ORDER BY created_at DESC`, ["login"]),
    query(`SELECT * FROM ${table("logs")} WHERE log_type = ? ORDER BY created_at DESC`, ["error"]),
  ]);
  return respond(res, { operationLogs, loginLogs, errorLogs });
});

export default router;
