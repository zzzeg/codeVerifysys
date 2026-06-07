import { Router } from "express";
import { uuid, type Project, type RegisterCode, type CustomData } from "../db";
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
router.use(requirePermission("projects"));

/**
 * 解析并校验当前用户可访问的项目
 *
 * @param req 当前请求对象，内部读取项目标识和登录用户
 * @returns 返回项目记录，不存在或无权访问时返回 undefined
 */
const resolveAccessibleProject = async (req: AuthRequest) => {
  const identity = await resolveRecordIdentity("projects", req.params.id);
  if (!identity?.id) return undefined;
  return getAccessibleProject(req, identity.id);
};

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

router.get("/", async (req: AuthRequest, res) => {
  const { keyword = "", notice = "", developerKeyword = "" } = req.query as Record<string, string>;
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const kw = (keyword || "").trim();
  const remark = (notice || "").trim();
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
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );
  const rows = await query(
    `SELECT p.*,
            u.username as developer_username,
            u.developer_code as developer_code,
            COUNT(c.id) as totalCodes,
            SUM(CASE WHEN c.status = 'in_use' THEN 1 ELSE 0 END) as activeCodes
     FROM ${table("projects")} p
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
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
      publicId: r.public_id || undefined,
      projectNo: Number(r.project_no || 0) || undefined,
      creatorUserId: r.creator_user_id || undefined,
      developerUsername: r.developer_username || undefined,
      developerCode: r.developer_code || undefined,
      name: r.name,
      description: r.description || undefined,
      config,
      remark: typeof config.remark === "string" ? config.remark : undefined,
      stats: { totalCodes: Number(r.totalCodes || 0), activeCodes: Number(r.activeCodes || 0) },
    };
  });
  return respond(res, { list, total: Number(totalRow?.c || 0) });
});

router.get("/names", async (req: AuthRequest, res) => {
  const ownerScope = getProjectOwnerScope(req, "p");
  const rows = await query<{ id: string; public_id: string | null; name: string }>(
    `SELECT p.id, p.public_id, p.name
     FROM ${table("projects")} p
     WHERE ${ownerScope.sql}
     ORDER BY p.created_at DESC`,
    ownerScope.params
  );
  return respond(res, rows.map((r) => ({ id: r.id, publicId: r.public_id || undefined, name: r.name })));
});

router.get("/:id", async (req: AuthRequest, res) => {
  const projectRow = await resolveAccessibleProject(req);
  if (!projectRow) return respondError(res, "未找到项目", 404);
  const row = await queryOne(`SELECT * FROM ${table("projects")} WHERE id = ?`, [projectRow.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  const project: Project = {
    id: row.id,
    publicId: (row as any).public_id || undefined,
    projectNo: Number((row as any).project_no || 0) || undefined,
    creatorUserId: (row as any).creator_user_id || undefined,
    name: row.name,
    description: row.description || undefined,
    config: parseJsonObj(row.config),
  };
  return respond(res, project);
});

router.post("/", async (req: AuthRequest, res) => {
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
  const nextPublicId = await generateUniquePublicId("projects");
  const now = Date.now();
  const projectNoRow = await queryOne<{ n: number }>(`SELECT COALESCE(MAX(project_no), 0) as n FROM ${table("projects")}`);
  const projectNo = Number(projectNoRow?.n || 0) + 1;
  const description = req.body?.description || req.body?.notice || null;

  await execute(
    `INSERT INTO ${table("projects")} (id, public_id, project_no, creator_user_id, name, description, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, nextPublicId, projectNo, req.user?.id || null, name, description, JSON.stringify(config), now, now]
  );
  return respond(res, { id, publicId: nextPublicId, projectNo });
});

router.put("/:id", async (req: AuthRequest, res) => {
  const row = await resolveAccessibleProject(req);
  if (!row) return respondError(res, "未找到项目", 404);
  const name = typeof req.body?.name === "undefined" ? undefined : String(req.body.name || "").trim();
  const description = req.body?.description;
  const config = typeof req.body?.config === "undefined" ? undefined : req.body.config;
  if (typeof name !== "undefined") {
    if (!name) return respondError(res, "项目名称必填", 400);
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE name = ? AND id <> ?`, [
      name,
      row.id,
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
    [name || null, typeof description === "undefined" ? null : description, typeof config === "undefined" ? null : JSON.stringify(config), Date.now(), row.id]
  );
  return respond(res, {});
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const row = await resolveAccessibleProject(req);
  if (!row) return respondError(res, "未找到项目", 404);
  await execute(`DELETE FROM ${table("projects")} WHERE id = ?`, [row.id]);
  return respond(res, {});
});

router.get("/:id/codes", async (req: AuthRequest, res) => {
  const projectRow = await resolveAccessibleProject(req);
  if (!projectRow) return respondError(res, "未找到项目", 404);
  const rows = await query(`SELECT * FROM ${table("register_codes")} WHERE project_id = ? ORDER BY created_at DESC`, [projectRow.id]);
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

router.get("/:id/custom-data", async (req: AuthRequest, res) => {
  const projectRow = await resolveAccessibleProject(req);
  if (!projectRow) return respondError(res, "未找到项目", 404);
  const rows = await query(`SELECT * FROM ${table("custom_data")} WHERE project_id = ? ORDER BY created_at DESC`, [projectRow.id]);
  const list: CustomData[] = rows.map((r: any) => ({ id: r.id, publicId: r.public_id || undefined, projectId: r.project_id, key: r.key, value: r.value, remark: r.remark || undefined }));
  return respond(res, list);
});

router.get("/:id/stats", async (req: AuthRequest, res) => {
  const projectRow = await resolveAccessibleProject(req);
  if (!projectRow) return respondError(res, "未找到项目", 404);
  const row = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("register_codes")} WHERE project_id = ?`, [projectRow.id]);
  return respond(res, { totalCodes: row?.c || 0 });
});

router.get("/:id/config", async (req: AuthRequest, res) => {
  const projectRow = await resolveAccessibleProject(req);
  if (!projectRow) return respondError(res, "未找到项目", 404);
  const row = await queryOne<{ config: any }>(`SELECT config FROM ${table("projects")} WHERE id = ?`, [projectRow.id]);
  if (!row) return respondError(res, "未找到项目", 404);
  return respond(res, parseJsonObj(row.config));
});

router.put("/:id/config", async (req: AuthRequest, res) => {
  const row = await resolveAccessibleProject(req);
  if (!row) return respondError(res, "未找到项目", 404);
  await execute(`UPDATE ${table("projects")} SET config = ?, updated_at = ? WHERE id = ?`, [JSON.stringify(req.body || {}), Date.now(), row.id]);
  return respond(res, req.body || {});
});

export default router;
