import { Router } from "express";
import { respond, authMiddleware } from "../middlewares/auth";
import { query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

const count = async (tbl: string) => {
  const row = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table(tbl)}`);
  return row?.c || 0;
};

router.get("/stats", async (_req, res) => {
  const [users, projects, codes, products, orders] = await Promise.all([
    count("users"),
    count("projects"),
    count("register_codes"),
    count("products"),
    count("orders"),
  ]);
  return respond(res, { users, projects, codes, products, orders });
});

router.get("/charts", (_req, res) => {
  const series = Array.from({ length: 7 }, (_, i) => ({ date: `Day-${i + 1}`, value: Math.round(Math.random() * 20) }));
  return respond(res, { series });
});

router.get("/recent", async (_req, res) => {
  const [logs, orders] = await Promise.all([
    query(`SELECT id, action, user, created_at FROM ${table("logs")} WHERE log_type='operation' ORDER BY created_at DESC LIMIT 5`),
    query(`SELECT * FROM ${table("orders")} ORDER BY created_at DESC LIMIT 5`),
  ]);
  return respond(res, {
    logs: logs.map((l: any) => ({ id: l.id, action: l.action, user: l.user, createdAt: Number(l.created_at) })),
    orders,
  });
});

export default router;

