import { Router } from "express";
import { respond, authMiddleware, requireAdmin } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { uuid, type Notification } from "../db";
import { getPagination } from "../utils/pagination";

const router = Router();
router.use(authMiddleware);

const mapRow = (r: any): Notification => ({
  id: r.id,
  title: r.title,
  content: r.content,
  category: r.category,
  read: Boolean(r.is_read),
  createdAt: Number(r.created_at),
});

router.get("/", async (req, res) => {
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const totalRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("notifications")}`);
  const rows = await query(`SELECT * FROM ${table("notifications")} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [pageSize, offset]);
  return respond(res, { list: rows.map(mapRow), total: Number(totalRow?.c || 0) });
});

router.post("/", requireAdmin(), async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const content = String(req.body?.content || "").trim();
  const category = String(req.body?.category || "system").trim() || "system";
  if (!title || !content) return respond(res, {}, "标题和内容不能为空", 400);
  const id = uuid();
  const now = Date.now();
  await execute(
    `INSERT INTO ${table("notifications")} (id, title, content, category, is_read, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, title, content, category, now],
  );
  return respond(res, { id });
});

router.get("/unread", async (_req, res) => {
  const rows = await query(`SELECT * FROM ${table("notifications")} WHERE is_read = 0 ORDER BY created_at DESC`);
  return respond(res, rows.map(mapRow));
});

router.put("/:id/read", async (req, res) => {
  await execute(`UPDATE ${table("notifications")} SET is_read = 1 WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.post("/read-all", async (_req, res) => {
  await execute(`UPDATE ${table("notifications")} SET is_read = 1 WHERE is_read = 0`);
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("notifications")} WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

export default router;
