import { Router } from "express";
import { uuid, type Role } from "../db";
import { respond, respondError, authMiddleware, requireAdmin } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import {
  ROLE_DEVELOPER,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_IDS,
  sanitizeAssignablePermissions,
} from "../constants/roles";

const router = Router();
router.use(authMiddleware);
router.use(requireAdmin());

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
  isSystem: SYSTEM_ROLE_IDS.includes(row.id),
  isDefault: row.id === ROLE_DEVELOPER,
  roleType: SYSTEM_ROLE_IDS.includes(row.id) ? "system" : "extension",
});

router.get("/", async (_req, res) => {
  const rows = await query(
    `SELECT * FROM ${table("roles")}
     ORDER BY
       CASE id
         WHEN 'role-admin' THEN 1
         WHEN 'role-developer' THEN 2
         ELSE 3
       END,
       created_at ASC`
  );
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
  const baseRoleId = typeof req.body?.baseRoleId === "string" ? req.body.baseRoleId : ROLE_DEVELOPER;
  const template = SYSTEM_ROLE_DEFINITIONS.find((role) => role.id === baseRoleId && role.id !== "role-admin");
  const requestedPermissions = Array.isArray(req.body?.permissions) ? req.body.permissions : template?.permissions || [];
  const role: Role = {
    id,
    name: req.body?.name,
    description: req.body?.description,
    permissions: sanitizeAssignablePermissions(requestedPermissions),
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
  const isSystemRole = SYSTEM_ROLE_IDS.includes(req.params.id);
  if (isSystemRole) {
    const description = typeof req.body?.description === "undefined" ? undefined : String(req.body.description || "");
    if (typeof description !== "undefined") {
      await execute(`UPDATE ${table("roles")} SET description = ? WHERE id = ?`, [description, req.params.id]);
    }
    return respond(res, {});
  }

  const name = req.body?.name;
  const description = req.body?.description;
  const permissions = req.body?.permissions;
  const sanitizedPermissions = Array.isArray(permissions) ? sanitizeAssignablePermissions(permissions) : null;
  await execute(
    `UPDATE ${table("roles")} SET name = COALESCE(?, name), description = ?,
      permissions = COALESCE(?, permissions)
     WHERE id = ?`,
    [
      name || null,
      typeof description === "undefined" ? null : description,
      sanitizedPermissions ? JSON.stringify(sanitizedPermissions) : null,
      req.params.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  if (SYSTEM_ROLE_IDS.includes(req.params.id)) return respondError(res, "系统内置角色不能删除", 400);
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
  if (SYSTEM_ROLE_IDS.includes(req.params.id)) return respondError(res, "系统内置角色权限不能直接修改", 400);
  const perms = sanitizeAssignablePermissions(req.body?.permissions);
  await execute(`UPDATE ${table("roles")} SET permissions = ? WHERE id = ?`, [JSON.stringify(perms), req.params.id]);
  return respond(res, {});
});

export default router;
