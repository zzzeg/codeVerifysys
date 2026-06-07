import { Router } from "express";
import { uuid, type CustomData } from "../db";
import { respond, respondError, authMiddleware, requirePermission, type AuthRequest } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import {
  generateUniquePublicId,
  getAccessibleProject,
  getDeveloperKeywordScope,
  getProjectOwnerScope,
  resolveRecordIdentity,
} from "../utils/permissionScope";

const router = Router();
router.use(authMiddleware);
router.use(requirePermission("custom-data"));

/**
 * 解析并校验当前用户可访问的自定义数据
 *
 * @param req 当前请求对象，内部读取数据标识和登录用户
 * @returns 返回自定义数据记录，不存在或无权访问时返回 undefined
 */
const resolveAccessibleCustomData = async (req: AuthRequest) => {
  const identity = await resolveRecordIdentity("custom_data", req.params.id);
  if (!identity?.id) return undefined;
  const scope = getProjectOwnerScope(req, "p");
  return queryOne<any>(
    `SELECT cd.*, p.name as project_name, u.username as developer_username, u.developer_code as developer_code
     FROM ${table("custom_data")} cd
     LEFT JOIN ${table("projects")} p ON p.id = cd.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     WHERE cd.id = ? AND ${scope.sql}`,
    [identity.id, ...scope.params]
  );
};

router.get("/", async (req: AuthRequest, res) => {
  const { projectId = "", key = "", remark = "", developerKeyword = "", page = "1", pageSize = "10" } = req.query as Record<string, string>;

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
    `SELECT COUNT(*) as c
     FROM ${table("custom_data")} cd
     LEFT JOIN ${table("projects")} p ON p.id = cd.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     ${whereSql}`,
    params
  );

  const rows = await query(
    `SELECT cd.*, p.name as project_name, p.creator_user_id as developer_id, u.username as developer_username, u.developer_code as developer_code
     FROM ${table("custom_data")} cd
     LEFT JOIN ${table("projects")} p ON p.id = cd.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     ${whereSql}
     ORDER BY cd.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, size, offset]
  );

  const list: CustomData[] = rows.map((r: any) => ({
    id: r.id,
    publicId: r.public_id || undefined,
    projectId: r.project_id,
    projectName: r.project_name || undefined,
    developerId: r.developer_id || undefined,
    developerUsername: r.developer_username || undefined,
    developerCode: r.developer_code || undefined,
    key: r.key,
    value: r.value,
    remark: r.remark || undefined,
  }));

  return respond(res, { total: totalRow?.c || 0, list });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const row = await resolveAccessibleCustomData(req);
  if (!row) return respondError(res, "未找到数据项", 404);
  return respond(res, {
    id: row.id,
    publicId: row.public_id || undefined,
    projectId: row.project_id,
    projectName: row.project_name || undefined,
    developerUsername: row.developer_username || undefined,
    developerCode: row.developer_code || undefined,
    key: row.key,
    value: row.value,
    remark: row.remark || undefined,
  } as CustomData);
});

router.post("/", async (req: AuthRequest, res) => {
  const { projectId, key, value, remark } = req.body || {};
  if (!projectId || !key) return respondError(res, "projectId 与 key 必填");
  const project = await getAccessibleProject(req, String(projectId));
  if (!project) return respondError(res, "项目不存在或无权访问", 404);
  const id = uuid();
  const nextPublicId = await generateUniquePublicId("custom_data");
  await execute(
    `INSERT INTO ${table("custom_data")} (id, public_id, project_id, \`key\`, \`value\`, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, nextPublicId, project.id, key, String(value ?? ""), typeof remark === "undefined" ? null : String(remark), Date.now()]
  );
  return respond(res, { id, publicId: nextPublicId });
});

router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await resolveAccessibleCustomData(req);
  if (!existing) return respondError(res, "未找到数据项", 404);
  const { projectId, key, value, remark } = req.body || {};
  let nextProjectId: string | null = null;
  if (projectId) {
    const project = await getAccessibleProject(req, String(projectId));
    if (!project) return respondError(res, "项目不存在或无权访问", 404);
    nextProjectId = project.id;
  }
  await execute(
    `UPDATE ${table("custom_data")}
     SET project_id = COALESCE(?, project_id),
         \`key\` = COALESCE(?, \`key\`),
         \`value\` = COALESCE(?, \`value\`),
         remark = COALESCE(?, remark)
     WHERE id = ?`,
    [
      nextProjectId,
      typeof key === "undefined" ? null : key,
      typeof value === "undefined" ? null : String(value),
      typeof remark === "undefined" ? null : String(remark),
      existing.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const existing = await resolveAccessibleCustomData(req);
  if (!existing) return respondError(res, "未找到数据项", 404);
  await execute(`DELETE FROM ${table("custom_data")} WHERE id = ?`, [existing.id]);
  return respond(res, {});
});

router.get("/project/:projectId", async (req: AuthRequest, res) => {
  const project = await getAccessibleProject(req, req.params.projectId);
  if (!project) return respondError(res, "项目不存在或无权访问", 404);
  const rows = await query(`SELECT * FROM ${table("custom_data")} WHERE project_id = ? ORDER BY created_at DESC`, [project.id]);
  const list: CustomData[] = rows.map((r: any) => ({ id: r.id, publicId: r.public_id || undefined, projectId: r.project_id, key: r.key, value: r.value, remark: r.remark || undefined }));
  return respond(res, list);
});

export default router;
