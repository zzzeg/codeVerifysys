import { Router } from "express";
import { uuid, type SecurityPolicy } from "../db";
import { respond, respondError, authMiddleware, requirePermission, type AuthRequest } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { getPagination } from "../utils/pagination";
import {
  generateUniquePublicId,
  getAccessibleProject,
  getDeveloperKeywordScope,
  getProjectOwnerScope,
  resolveRecordIdentity,
} from "../utils/permissionScope";

const router = Router();
router.use(authMiddleware);
router.use(requirePermission("security-policies"));

/**
 * 解析并校验当前用户可访问的安全策略
 *
 * @param req 当前请求对象，内部读取策略标识和登录用户
 * @returns 返回安全策略记录，不存在或无权访问时返回 undefined
 */
const resolveAccessiblePolicy = async (req: AuthRequest) => {
  const identity = await resolveRecordIdentity("security_policies", req.params.id);
  if (!identity?.id) return undefined;
  const scope = getProjectOwnerScope(req, "p");
  return queryOne<any>(
    `SELECT sp.*, p.name as project_name, p.creator_user_id as developer_id, u.username as developer_username, u.developer_code as developer_code
     FROM ${table("security_policies")} sp
     LEFT JOIN ${table("projects")} p ON p.id = sp.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     WHERE sp.id = ? AND ${scope.sql}`,
    [identity.id, ...scope.params]
  );
};

router.get("/", async (req: AuthRequest, res) => {
  const raw = req.query as Record<string, string>;
  const { projectId = "", status = "", mode = "", developerKeyword = "" } = raw;
  const { pageSize, offset } = getPagination(raw);

  const where: string[] = [];
  const params: any[] = [];
  const ownerScope = getProjectOwnerScope(req, "p");
  where.push(ownerScope.sql);
  params.push(...ownerScope.params);

  const developerScope = getDeveloperKeywordScope(developerKeyword, "u");
  if (developerScope.sql) {
    where.push(developerScope.sql);
    params.push(...developerScope.params);
  }

  if (projectId) {
    where.push("sp.project_id = ?");
    params.push(projectId);
  }
  if (status === "enabled" || status === "disabled") {
    where.push("sp.status = ?");
    params.push(status);
  }
  if (mode === "basic") {
    where.push("(sp.mode = 'basic' OR sp.mode NOT IN ('basic','advanced'))");
  } else if (mode === "advanced") {
    where.push("sp.mode = 'advanced'");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM ${table("security_policies")} sp
     LEFT JOIN ${table("projects")} p ON p.id = sp.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     ${whereSql}`,
    params
  );

  const rows = await query(
    `SELECT sp.*, p.name as project_name, p.creator_user_id as developer_id, u.username as developer_username, u.developer_code as developer_code
     FROM ${table("security_policies")} sp
     LEFT JOIN ${table("projects")} p ON p.id = sp.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     ${whereSql}
     ORDER BY sp.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const list: SecurityPolicy[] = rows.map((r: any) => {
    const rawMode = String(r.mode || "");
    const normalizedMode: "basic" | "advanced" = rawMode === "advanced" ? "advanced" : "basic";
    const config = r.config ? (() => {
      try {
        return typeof r.config === "string" ? JSON.parse(r.config) : r.config;
      } catch {
        return undefined;
      }
    })() : undefined;

    const migratedConfig =
      !config && rawMode && rawMode !== "basic" && rawMode !== "advanced"
        ? { userKey: "", verifyAlgo: rawMode, assistAlgo: rawMode }
        : config;

    return {
      id: r.id,
      publicId: r.public_id || undefined,
      projectId: r.project_id,
      projectName: r.project_name || undefined,
      developerId: r.developer_id || undefined,
      developerUsername: r.developer_username || undefined,
      developerCode: r.developer_code || undefined,
      name: r.name,
      mode: normalizedMode,
      status: r.status === "disabled" ? "disabled" : "enabled",
      config: migratedConfig,
      createdAt: Number(r.created_at),
    };
  });

  return respond(res, { total: Number(totalRow?.c || 0), list });
});

router.get("/project-ids", async (req: AuthRequest, res) => {
  const scope = getProjectOwnerScope(req, "p");
  const rows = await query<{ project_id: string }>(
    `SELECT DISTINCT sp.project_id
     FROM ${table("security_policies")} sp
     LEFT JOIN ${table("projects")} p ON p.id = sp.project_id
     WHERE ${scope.sql}`,
    scope.params
  );
  return respond(res, rows.map((r) => r.project_id));
});

router.get("/algorithms", (_req, res) => respond(res, ["AES", "DES", "TEA", "RC2", "RC5", "RC6", "RSA", "SM2", "SM4"]));

router.get("/:id", async (req: AuthRequest, res) => {
  const row = await resolveAccessiblePolicy(req);
  if (!row) return respondError(res, "未找到策略", 404);
  const rawMode = String((row as any).mode || "");
  const normalizedMode: "basic" | "advanced" = rawMode === "advanced" ? "advanced" : "basic";
  const config = (row as any).config
    ? (() => {
        try {
          return typeof (row as any).config === "string" ? JSON.parse((row as any).config) : (row as any).config;
        } catch {
          return undefined;
        }
      })()
    : undefined;
  const policy: SecurityPolicy = {
    id: (row as any).id,
    publicId: (row as any).public_id || undefined,
    projectId: (row as any).project_id,
    projectName: (row as any).project_name || undefined,
    developerId: (row as any).developer_id || undefined,
    developerUsername: (row as any).developer_username || undefined,
    developerCode: (row as any).developer_code || undefined,
    name: (row as any).name,
    mode: normalizedMode,
    status: (row as any).status === "disabled" ? "disabled" : "enabled",
    config,
    createdAt: Number((row as any).created_at),
  };
  return respond(res, policy);
});

router.post("/", async (req: AuthRequest, res) => {
  const { projectId, status, mode, config, name } = req.body || {};
  if (!projectId) return respondError(res, "projectId 必填");
  const project = await getAccessibleProject(req, String(projectId));
  if (!project) return respondError(res, "项目不存在或无权访问", 404);
  const existingByProject = await queryOne<{ id: string }>(
    `SELECT id FROM ${table("security_policies")} WHERE project_id = ? LIMIT 1`,
    [project.id]
  );
  if (existingByProject) return respondError(res, "该项目已存在安全策略", 400);
  const id = uuid();
  const nextPublicId = await generateUniquePublicId("security_policies");
  const now = Date.now();
  const resolvedStatus = status === "disabled" ? "disabled" : "enabled";
  const resolvedMode = mode === "advanced" ? "advanced" : "basic";
  const resolvedName = typeof name === "string" && name.trim() ? name.trim() : "default";
  const configJson = typeof config === "undefined" ? null : JSON.stringify(config);

  await execute(
    `INSERT INTO ${table("security_policies")} (id, public_id, project_id, name, mode, status, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nextPublicId, project.id, resolvedName, resolvedMode, resolvedStatus, configJson, now, now]
  );
  return respond(res, { id, publicId: nextPublicId });
});

router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await resolveAccessiblePolicy(req);
  if (!existing) return respondError(res, "未找到策略", 404);
  const { projectId, name, mode, status, config } = req.body || {};
  let nextProjectId: string | null = null;
  if (projectId) {
    const project = await getAccessibleProject(req, String(projectId));
    if (!project) return respondError(res, "项目不存在或无权访问", 404);
    nextProjectId = project.id;
    const conflict = await queryOne<{ id: string }>(
      `SELECT id FROM ${table("security_policies")} WHERE project_id = ? AND id <> ? LIMIT 1`,
      [project.id, existing.id]
    );
    if (conflict) return respondError(res, "该项目已存在安全策略", 400);
  }
  await execute(
    `UPDATE ${table("security_policies")}
     SET project_id = COALESCE(?, project_id),
          name = COALESCE(?, name),
          mode = COALESCE(?, mode),
         status = COALESCE(?, status),
         config = COALESCE(?, config),
         updated_at = ?
     WHERE id = ?`,
    [
      nextProjectId,
      typeof name === "undefined" ? null : name,
      typeof mode === "undefined" ? null : mode === "advanced" ? "advanced" : "basic",
      typeof status === "undefined" ? null : status === "disabled" ? "disabled" : "enabled",
      typeof config === "undefined" ? null : JSON.stringify(config),
      Date.now(),
      existing.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const existing = await resolveAccessiblePolicy(req);
  if (!existing) return respondError(res, "未找到策略", 404);
  await execute(`DELETE FROM ${table("security_policies")} WHERE id = ?`, [existing.id]);
  return respond(res, {});
});

router.get("/project/:projectId", async (req: AuthRequest, res) => {
  const project = await getAccessibleProject(req, req.params.projectId);
  if (!project) return respondError(res, "项目不存在或无权访问", 404);
  const rows = await query(`SELECT * FROM ${table("security_policies")} WHERE project_id = ? ORDER BY created_at DESC`, [project.id]);
  const list: SecurityPolicy[] = rows.map((r: any) => ({
    id: r.id,
    publicId: r.public_id || undefined,
    projectId: r.project_id,
    name: r.name,
    mode: r.mode === "advanced" ? "advanced" : "basic",
    status: r.status === "disabled" ? "disabled" : "enabled",
    config: r.config ? (typeof r.config === "string" ? JSON.parse(r.config) : r.config) : undefined,
    createdAt: Number(r.created_at),
  }));
  return respond(res, list);
});

export default router;
