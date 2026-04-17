import { Router } from "express";
import { uuid, type CustomData } from "../db";
import { respond, respondError, authMiddleware } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const { projectId = "", key = "", remark = "", page = "1", pageSize = "10" } = req.query as Record<string, string>;

  const where: string[] = [];
  const params: any[] = [];

  if (projectId) {
    where.push("cd.project_id = ?");
    params.push(projectId);
  }
  if (key) {
    where.push("cd.`key` LIKE ?");
    params.push(`%${key}%`);
  }
  if (remark) {
    where.push("cd.remark LIKE ?");
    params.push(`%${remark}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${table("custom_data")} cd ${whereSql}`,
    params
  );

  const rows = await query(
    `SELECT cd.*, p.name as project_name
     FROM ${table("custom_data")} cd
     LEFT JOIN ${table("projects")} p ON p.id = cd.project_id
     ${whereSql}
     ORDER BY cd.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );

  const list: CustomData[] = rows.map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: r.project_name || undefined,
    key: r.key,
    value: r.value,
    remark: r.remark || undefined,
  }));

  return respond(res, { total: totalRow?.c || 0, list });
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("custom_data")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到数据项", 404);
  return respond(res, { id: row.id, projectId: row.project_id, key: row.key, value: row.value, remark: row.remark || undefined } as CustomData);
});

router.post("/", async (req, res) => {
  const { projectId, key, value, remark } = req.body || {};
  if (!projectId || !key) return respondError(res, "projectId 与 key 必填");
  const id = uuid();
  await execute(
    `INSERT INTO ${table("custom_data")} (id, project_id, \`key\`, \`value\`, remark, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, projectId, key, String(value ?? ""), typeof remark === "undefined" ? null : String(remark), Date.now()]
  );
  return respond(res, { id });
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("custom_data")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到数据项", 404);
  const { projectId, key, value, remark } = req.body || {};
  await execute(
    `UPDATE ${table("custom_data")}
     SET project_id = COALESCE(?, project_id),
         \`key\` = COALESCE(?, \`key\`),
         \`value\` = COALESCE(?, \`value\`),
         remark = COALESCE(?, remark)
     WHERE id = ?`,
    [
      projectId ?? null,
      typeof key === "undefined" ? null : key,
      typeof value === "undefined" ? null : String(value),
      typeof remark === "undefined" ? null : String(remark),
      req.params.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("custom_data")} WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.get("/project/:projectId", async (req, res) => {
  const rows = await query(`SELECT * FROM ${table("custom_data")} WHERE project_id = ? ORDER BY created_at DESC`, [req.params.projectId]);
  const list: CustomData[] = rows.map((r: any) => ({ id: r.id, projectId: r.project_id, key: r.key, value: r.value, remark: r.remark || undefined }));
  return respond(res, list);
});

export default router;
