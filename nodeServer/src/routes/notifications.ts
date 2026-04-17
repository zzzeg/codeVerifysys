import { Router } from "express";
import { respond, authMiddleware } from "../middlewares/auth";
import { execute, query } from "../db/mysql";
import { table } from "../db/tables";
import type { Notification } from "../db";

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

router.get("/", async (_req, res) => {
  const rows = await query(`SELECT * FROM ${table("notifications")} ORDER BY created_at DESC`);
  return respond(res, rows.map(mapRow));
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

