import { Router } from "express";
import { respond, authMiddleware, requireAdmin } from "../middlewares/auth";
import { query } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin());

const fetchLogs = async (type: "operation" | "login" | "error") => {
  return query(`SELECT * FROM ${table("logs")} WHERE log_type = ? ORDER BY created_at DESC LIMIT 500`, [type]);
};

router.get("/operation", async (_req, res) => {
  const rows = await fetchLogs("operation");
  return respond(res, rows.map((r: any) => ({ id: r.id, action: r.action, user: r.user, createdAt: Number(r.created_at) })));
});

router.get("/login", async (_req, res) => {
  const rows = await fetchLogs("login");
  return respond(res, rows.map((r: any) => ({ id: r.id, user: r.user, status: r.status, ip: r.ip, createdAt: Number(r.created_at) })));
});

router.get("/error", async (_req, res) => {
  const rows = await fetchLogs("error");
  return respond(res, rows.map((r: any) => ({ id: r.id, message: r.message, stack: r.stack, createdAt: Number(r.created_at) })));
});

router.get("/export", async (_req, res) => {
  const [operationLogs, loginLogs, errorLogs] = await Promise.all([fetchLogs("operation"), fetchLogs("login"), fetchLogs("error")]);
  return respond(res, { operationLogs, loginLogs, errorLogs });
});

export default router;
