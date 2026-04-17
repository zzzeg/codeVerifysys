import { Router } from "express";
import { uuid, type SecurityPolicy } from "../db";
import { respond, respondError, authMiddleware } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res) => {
  const raw = req.query as Record<string, string>;
  const { projectId = "", status = "", mode = "" } = raw;
  const hasPaging = typeof raw.page !== "undefined" || typeof raw.pageSize !== "undefined";
  const pageNum = Math.max(parseInt(raw.page || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(raw.pageSize || "10", 10) || 10, 1), 200);
  const offset = (pageNum - 1) * pageSize;

  const where: string[] = [];
  const params: any[] = [];

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

  const totalRow = hasPaging
    ? await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("security_policies")} sp ${whereSql}`, params)
    : null;

  const rows = await query(
    `SELECT sp.*, p.name as project_name
     FROM ${table("security_policies")} sp
     LEFT JOIN ${table("projects")} p ON p.id = sp.project_id
     ${whereSql}
     ORDER BY sp.created_at DESC
     ${hasPaging ? "LIMIT ? OFFSET ?" : ""}`,
    hasPaging ? [...params, pageSize, offset] : params
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
      projectId: r.project_id,
      projectName: r.project_name || undefined,
      name: r.name,
      mode: normalizedMode,
      status: r.status === "disabled" ? "disabled" : "enabled",
      config: migratedConfig,
      createdAt: Number(r.created_at),
    };
  });

  if (hasPaging) return respond(res, { total: totalRow?.c || 0, list });
  return respond(res, list);
});

router.get("/project-ids", async (_req, res) => {
  const rows = await query<{ project_id: string }>(`SELECT DISTINCT project_id FROM ${table("security_policies")}`);
  return respond(res, rows.map((r) => r.project_id));
});

router.get("/algorithms", (_req, res) => respond(res, ["AES", "DES", "TEA", "RC2", "RC5", "RC6", "RSA", "SM2", "SM4"]));

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("security_policies")} WHERE id = ?`, [req.params.id]);
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
    projectId: (row as any).project_id,
    name: (row as any).name,
    mode: normalizedMode,
    status: (row as any).status === "disabled" ? "disabled" : "enabled",
    config,
    createdAt: Number((row as any).created_at),
  };
  return respond(res, policy);
});

router.post("/", async (req, res) => {
  const { projectId, status, mode, config, name } = req.body || {};
  if (!projectId) return respondError(res, "projectId 必填");
  const existingByProject = await queryOne<{ id: string }>(
    `SELECT id FROM ${table("security_policies")} WHERE project_id = ? LIMIT 1`,
    [projectId]
  );
  if (existingByProject) return respondError(res, "该项目已存在安全策略", 400);
  const id = uuid();
  const now = Date.now();
  const resolvedStatus = status === "disabled" ? "disabled" : "enabled";
  const resolvedMode = mode === "advanced" ? "advanced" : "basic";
  const resolvedName = typeof name === "string" && name.trim() ? name.trim() : "default";
  const configJson = typeof config === "undefined" ? null : JSON.stringify(config);

  await execute(
    `INSERT INTO ${table("security_policies")} (id, project_id, name, mode, status, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, projectId, resolvedName, resolvedMode, resolvedStatus, configJson, now, now]
  );
  return respond(res, { id });
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("security_policies")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到策略", 404);
  const { projectId, name, mode, status, config } = req.body || {};
  if (projectId) {
    const conflict = await queryOne<{ id: string }>(
      `SELECT id FROM ${table("security_policies")} WHERE project_id = ? AND id <> ? LIMIT 1`,
      [projectId, req.params.id]
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
      projectId ?? null,
      typeof name === "undefined" ? null : name,
      typeof mode === "undefined" ? null : mode === "advanced" ? "advanced" : "basic",
      typeof status === "undefined" ? null : status === "disabled" ? "disabled" : "enabled",
      typeof config === "undefined" ? null : JSON.stringify(config),
      Date.now(),
      req.params.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("security_policies")} WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.get("/project/:projectId", async (req, res) => {
  const rows = await query(`SELECT * FROM ${table("security_policies")} WHERE project_id = ? ORDER BY created_at DESC`, [req.params.projectId]);
  const list: SecurityPolicy[] = rows.map((r: any) => ({
    id: r.id,
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
