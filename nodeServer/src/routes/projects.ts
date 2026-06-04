import { Router } from "express";
import { uuid, type Project, type RegisterCode, type CustomData } from "../db";
import { respond, respondError, authMiddleware, requirePermission } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { getPagination } from "../utils/pagination";

const router = Router();
router.use(authMiddleware);
router.use(requirePermission("projects"));

const parseJsonObj = (val: any): Record<string, any> => {
  if (!val) return {};
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

router.get("/", async (req, res) => {
  const { keyword = "", notice = "" } = req.query as Record<string, string>;
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const kw = (keyword || "").trim();
  const remark = (notice || "").trim();
  const where: string[] = [];
  const params: string[] = [];

  if (kw) {
    where.push("p.name LIKE ?");
    params.push(`%${kw}%`);
  }
  if (remark) {
    where.push("JSON_UNQUOTE(JSON_EXTRACT(p.config, '$.remark')) LIKE ?");
    params.push(`%${remark}%`);
  }

  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM ${table("projects")} p
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );
  const rows = await query(
    `SELECT p.*,
            COUNT(c.id) as totalCodes,
            SUM(CASE WHEN c.status = 'in_use' THEN 1 ELSE 0 END) as activeCodes
     FROM ${table("projects")} p
     LEFT JOIN ${table("register_codes")} c ON c.project_id = p.id AND c.status <> 'deleted'
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const list: Array<Project & { remark?: string }> = rows.map((r: any) => {
    const config = parseJsonObj(r.config);
    return {
      id: r.id,
      projectNo: Number(r.project_no || 0) || undefined,
      name: r.name,
      description: r.description || undefined,
      config,
      remark: typeof config.remark === "string" ? config.remark : undefined,
      stats: { totalCodes: Number(r.totalCodes || 0), activeCodes: Number(r.activeCodes || 0) },
    };
  });
  return respond(res, { list, total: Number(totalRow?.c || 0) });
});

router.get("/names", async (_req, res) => {
  const rows = await query<{ name: string }>(`SELECT name FROM ${table("projects")} ORDER BY created_at DESC`);
  return respond(res, rows.map((r) => ({ name: r.name })));
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("projects")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  const project: Project = {
    id: row.id,
    projectNo: Number((row as any).project_no || 0) || undefined,
    name: row.name,
    description: row.description || undefined,
    config: parseJsonObj(row.config),
  };
  return respond(res, project);
});

router.post("/", async (req, res) => {
  const name = (req.body?.name || "").trim();
  if (!name) return respondError(res, "项目名称必填");
  const config = req.body?.config && typeof req.body.config === "object" ? req.body.config : {};
  const trialMode = String((config as any).trialMode || "");
  const trialTime = Number((config as any).trialTime);
  const deviceTrialTime = Number((config as any).deviceTrialTime);
  const unbindDeductMinutes = Number((config as any).unbindDeductMinutes);

  if (trialMode === "开启试用模式") {
    if (!Number.isFinite(trialTime) || trialTime <= 0 || trialTime > 14400) {
      return respondError(res, "试用时间需在 1 到 14400 分钟之间", 400);
    }
    if (!Number.isFinite(deviceTrialTime) || deviceTrialTime <= 0 || deviceTrialTime > 720) {
      return respondError(res, "单台电脑试用时间需在 1 到 720 分钟之间", 400);
    }
  } else if (trialMode === "关闭试用模式") {
    if (!Number.isFinite(unbindDeductMinutes) || unbindDeductMinutes < 0 || unbindDeductMinutes > 720) {
      return respondError(res, "解绑扣时需在 0 到 720 分钟之间", 400);
    }
  }

  const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE name = ?`, [name]);
  if (exists) return respondError(res, "项目名称已存在");

  const id = uuid();
  const now = Date.now();
  const projectNoRow = await queryOne<{ n: number }>(`SELECT COALESCE(MAX(project_no), 0) as n FROM ${table("projects")}`);
  const projectNo = Number(projectNoRow?.n || 0) + 1;
  const description = req.body?.description || req.body?.notice || null;

  await execute(
    `INSERT INTO ${table("projects")} (id, project_no, name, description, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, projectNo, name, description, JSON.stringify(config), now, now]
  );
  return respond(res, { id, projectNo });
});

router.put("/:id", async (req, res) => {
  const row = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  const name = typeof req.body?.name === "undefined" ? undefined : String(req.body.name || "").trim();
  const description = req.body?.description;
  const config = typeof req.body?.config === "undefined" ? undefined : req.body.config;
  if (typeof name !== "undefined") {
    if (!name) return respondError(res, "项目名称必填", 400);
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE name = ? AND id <> ?`, [
      name,
      req.params.id,
    ]);
    if (exists) return respondError(res, "项目名称已存在", 400);
  }
  if (config && typeof config === "object") {
    const trialMode = String((config as any).trialMode || "");
    const trialTime = Number((config as any).trialTime);
    const deviceTrialTime = Number((config as any).deviceTrialTime);
    const unbindDeductMinutes = Number((config as any).unbindDeductMinutes);
    if (trialMode === "开启试用模式") {
      if (!Number.isFinite(trialTime) || trialTime <= 0 || trialTime > 14400) {
        return respondError(res, "试用时间需在 1 到 14400 分钟之间", 400);
      }
      if (!Number.isFinite(deviceTrialTime) || deviceTrialTime <= 0 || deviceTrialTime > 720) {
        return respondError(res, "单台电脑试用时间需在 1 到 720 分钟之间", 400);
      }
    } else if (trialMode === "关闭试用模式") {
      if (!Number.isFinite(unbindDeductMinutes) || unbindDeductMinutes < 0 || unbindDeductMinutes > 720) {
        return respondError(res, "解绑扣时需在 0 到 720 分钟之间", 400);
      }
    }
  }

  await execute(
    `UPDATE ${table("projects")}
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         config = COALESCE(?, config),
         updated_at = ?
     WHERE id = ?`,
    [name || null, typeof description === "undefined" ? null : description, typeof config === "undefined" ? null : JSON.stringify(config), Date.now(), req.params.id]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("projects")} WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.get("/:id/codes", async (req, res) => {
  const rows = await query(`SELECT * FROM ${table("register_codes")} WHERE project_id = ? ORDER BY created_at DESC`, [req.params.id]);
  const list: RegisterCode[] = rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    projectId: r.project_id,
    projectName: r.project_name,
    cardType: r.card_type,
    status: r.status,
    isOnline: Boolean(r.is_online),
    isBound: Boolean(r.is_bound),
    saleType: r.sale_type,
    machineCode: r.machine_code || undefined,
    lastLoginIp: r.last_login_ip || undefined,
    lastLoginAt: r.last_login_at ? Number(r.last_login_at) : undefined,
    activatedAt: r.activated_at ? Number(r.activated_at) : undefined,
    unbindPassword: r.unbind_password || undefined,
    remark: r.remark || undefined,
    expireAt: r.expire_at ? Number(r.expire_at) : undefined,
    createdAt: Number(r.created_at),
  }));

  return respond(res, list);
});

router.get("/:id/custom-data", async (req, res) => {
  const rows = await query(`SELECT * FROM ${table("custom_data")} WHERE project_id = ? ORDER BY created_at DESC`, [req.params.id]);
  const list: CustomData[] = rows.map((r: any) => ({ id: r.id, projectId: r.project_id, key: r.key, value: r.value, remark: r.remark || undefined }));
  return respond(res, list);
});

router.get("/:id/stats", async (req, res) => {
  const row = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("register_codes")} WHERE project_id = ?`, [req.params.id]);
  return respond(res, { totalCodes: row?.c || 0 });
});

router.get("/:id/config", async (req, res) => {
  const row = await queryOne<{ config: any }>(`SELECT config FROM ${table("projects")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  return respond(res, parseJsonObj(row.config));
});

router.put("/:id/config", async (req, res) => {
  const row = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  await execute(`UPDATE ${table("projects")} SET config = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(req.body || {}), Date.now(), req.params.id]);
  return respond(res, req.body || {});
});

export default router;
