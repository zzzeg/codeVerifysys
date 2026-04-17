import { Router } from "express";
import { uuid, type Role } from "../db";
import { respond, respondError, authMiddleware } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

const parseJsonArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapRoleRow = (row: any): Role => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  permissions: parseJsonArray(row.permissions),
});

router.get("/", async (_req, res) => {
  const rows = await query(`SELECT * FROM ${table("roles")} ORDER BY created_at ASC`);
  return respond(res, rows.map(mapRoleRow));
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("roles")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到角色", 404);
  return respond(res, mapRoleRow(row));
});

router.post("/", async (req, res) => {
  const id = uuid();
  const now = Date.now();
  const role: Role = {
    id,
    name: req.body?.name,
    description: req.body?.description,
    permissions: Array.isArray(req.body?.permissions) ? req.body.permissions : [],
  };
  if (!role.name) return respondError(res, "角色名称必填");
  await execute(
    `INSERT INTO ${table("roles")} (id, name, description, permissions, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, role.name, role.description || null, JSON.stringify(role.permissions || []), now]
  );
  return respond(res, { id });
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("roles")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到角色", 404);
  const name = req.body?.name;
  const description = req.body?.description;
  const permissions = req.body?.permissions;
  await execute(
    `UPDATE ${table("roles")} SET name = COALESCE(?, name), description = ?,
      permissions = COALESCE(?, permissions)
     WHERE id = ?`,
    [
      name || null,
      typeof description === "undefined" ? null : description,
      Array.isArray(permissions) ? JSON.stringify(permissions) : null,
      req.params.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("roles")} WHERE id = ?`, [req.params.id]);
  await execute(`DELETE FROM ${table("user_roles")} WHERE role_id = ?`, [req.params.id]);
  return respond(res, {});
});

router.get("/:id/permissions", async (req, res) => {
  const row = await queryOne<{ permissions: any }>(`SELECT permissions FROM ${table("roles")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到角色", 404);
  return respond(res, parseJsonArray(row.permissions));
});

router.post("/:id/permissions", async (req, res) => {
  const perms = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  await execute(`UPDATE ${table("roles")} SET permissions = ? WHERE id = ?`, [JSON.stringify(perms), req.params.id]);
  return respond(res, {});
});

export default router;

