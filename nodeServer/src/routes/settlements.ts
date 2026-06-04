import { Router } from "express";
import { uuid } from "../db";
import { respond, authMiddleware, requireAdmin } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { getPagination } from "../utils/pagination";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin());

const parseConfig = (value: any) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const getSettlementDays = async () => {
  const row = await queryOne<{ config: any }>(`SELECT config FROM ${table("system_config")} WHERE id = 1`);
  const config = parseConfig(row?.config);
  return Math.max(Number(config.settlementDays ?? 1) || 1, 0);
};

router.get("/config", async (_req, res) => {
  return respond(res, { settlementDays: await getSettlementDays() });
});

router.put("/config", async (req, res) => {
  const row = await queryOne<{ config: any }>(`SELECT config FROM ${table("system_config")} WHERE id = 1`);
  const config = parseConfig(row?.config);
  config.settlementDays = Math.max(Number(req.body?.settlementDays ?? 1) || 1, 0);
  await execute(
    `INSERT INTO ${table("system_config")} (id, config, updated_at) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = VALUES(updated_at)`,
    [JSON.stringify(config), Date.now()],
  );
  return respond(res, { settlementDays: config.settlementDays });
});

router.post("/auto-run", async (_req, res) => {
  const now = Date.now();
  const result = await execute(
    `UPDATE ${table("orders")}
     SET settlement_status = 'settled'
     WHERE status = 'delivered'
       AND settlement_status <> 'settled'
       AND settle_at IS NOT NULL
       AND settle_at <= ?`,
    [now],
  );
  const count = Number(result.affectedRows || 0);
  if (count > 0) {
    await execute(
      `INSERT INTO ${table("notifications")} (id, title, content, category, is_read, created_at)
       VALUES (?, '自动结算完成', ?, 'settlement', 0, ?)`,
      [uuid(), `系统已自动结算 ${count} 笔订单。`, now],
    );
  }
  return respond(res, { count });
});

router.post("/mark-settled", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) return respond(res, { count: 0 });
  const placeholders = ids.map(() => "?").join(",");
  const result = await execute(
    `UPDATE ${table("orders")}
     SET settlement_status = 'settled'
     WHERE id IN (${placeholders}) AND status = 'delivered'`,
    ids,
  );
  return respond(res, { count: Number(result.affectedRows || 0) });
});

router.get("/orders", async (req, res) => {
  const { status = "", keyword = "" } = req.query as Record<string, string>;
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const where = ["o.status = 'delivered'"];
  const params: any[] = [];
  if (status === "settled" || status === "unsettled") {
    where.push("o.settlement_status = ?");
    params.push(status);
  }
  if (keyword.trim()) {
    where.push("(o.id LIKE ? OR o.buyer_email LIKE ? OR p.name LIKE ? OR u.username LIKE ?)");
    const kw = `%${keyword.trim()}%`;
    params.push(kw, kw, kw, kw);
  }
  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM ${table("orders")} o
     LEFT JOIN ${table("products")} p ON p.id = o.product_id
     LEFT JOIN ${table("users")} u ON u.id = o.creator_user_id
     WHERE ${where.join(" AND ")}`,
    params,
  );
  const rows = await query(
    `SELECT o.*, p.name as product_name, u.username as creator_username
     FROM ${table("orders")} o
     LEFT JOIN ${table("products")} p ON p.id = o.product_id
     LEFT JOIN ${table("users")} u ON u.id = o.creator_user_id
     WHERE ${where.join(" AND ")}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return respond(
    res,
    {
      total: Number(totalRow?.c || 0),
      list: rows.map((r: any) => ({
        id: r.id,
        productName: r.product_name || r.product_id,
        creatorUsername: r.creator_username || r.creator_user_id,
        buyerEmail: r.buyer_email || "",
        amount: Number(r.amount || 0),
        settlementStatus: r.settlement_status || "unsettled",
        settleAt: r.settle_at ? Number(r.settle_at) : undefined,
        paidAt: r.paid_at ? Number(r.paid_at) : undefined,
        deliveredAt: r.delivered_at ? Number(r.delivered_at) : undefined,
        createdAt: Number(r.created_at || 0),
      })),
    },
  );
});

export default router;
