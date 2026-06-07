import { publicId, type User } from "../db";
import { ROLE_ADMIN } from "../constants/roles";
import { queryOne } from "../db/mysql";
import { table } from "../db/tables";
import type { AuthRequest } from "../middlewares/auth";

export interface OwnerScope {
  sql: string;
  params: any[];
}

/**
 * 判断当前用户是否具备超级管理员数据范围
 *
 * @param user 当前登录用户
 * @returns 返回 true 表示可访问全站数据
 */
export const isAdminUser = (user?: User) =>
  Boolean(user && (user.roleIds.includes(ROLE_ADMIN) || user.permissions.includes("*") || user.username === "admin"));

/**
 * 生成按创建者过滤的数据范围 SQL
 *
 * @param req 当前请求对象，内部读取登录用户
 * @param columnName 创建者字段名，可带表别名
 * @returns 返回 SQL 片段和参数
 */
export const getCreatorScope = (req: AuthRequest, columnName = "creator_user_id"): OwnerScope => {
  if (isAdminUser(req.user)) return { sql: "1 = 1", params: [] };
  return { sql: `${columnName} = ?`, params: [req.user?.id] };
};

/**
 * 生成按项目创建者过滤的数据范围 SQL
 *
 * @param req 当前请求对象，内部读取登录用户
 * @param projectAlias 项目表别名
 * @returns 返回 SQL 片段和参数
 */
export const getProjectOwnerScope = (req: AuthRequest, projectAlias = "p"): OwnerScope => {
  if (isAdminUser(req.user)) return { sql: "1 = 1", params: [] };
  return { sql: `${projectAlias}.creator_user_id = ?`, params: [req.user?.id] };
};

/**
 * 生成开发者关键词搜索 SQL
 *
 * @param keyword 搜索关键词，可匹配用户名、开发者短码、邮箱、手机号
 * @param userAlias 用户表别名
 * @returns 返回 SQL 片段和参数，关键词为空时返回空条件
 */
export const getDeveloperKeywordScope = (keyword: unknown, userAlias = "u"): OwnerScope => {
  const text = String(keyword || "").trim();
  if (!text) return { sql: "", params: [] };
  const like = `%${text}%`;
  return {
    sql: `(${userAlias}.username LIKE ? OR ${userAlias}.developer_code LIKE ? OR ${userAlias}.email LIKE ? OR ${userAlias}.phone LIKE ?)`,
    params: [like, like, like, like],
  };
};

/**
 * 生成指定表内唯一 public_id
 *
 * @param tableName 业务表名，不包含统一表前缀
 * @returns 返回 10 位 public_id
 */
export const generateUniquePublicId = async (tableName: string) => {
  for (let i = 0; i < 32; i += 1) {
    const candidate = publicId();
    if (candidate.length !== 10) continue;
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table(tableName)} WHERE public_id = ?`, [candidate]);
    if (!exists) return candidate;
  }
  throw new Error(`生成 ${tableName} public_id 失败`);
};

/**
 * 按内部 ID 或 public_id 解析业务记录
 *
 * @param tableName 业务表名，不包含统一表前缀
 * @param value 前端传入的内部 ID 或 public_id
 * @returns 返回内部 ID 和 public_id，不存在时返回 undefined
 */
export const resolveRecordIdentity = async (tableName: string, value: string) => {
  return queryOne<{ id: string; public_id: string | null }>(
    `SELECT id, public_id FROM ${table(tableName)} WHERE id = ? OR public_id = ? LIMIT 1`,
    [value, value]
  );
};

/**
 * 校验当前用户是否可访问指定项目
 *
 * @param req 当前请求对象，内部读取登录用户
 * @param projectId 项目内部 ID
 * @returns 返回项目基础信息，若无权或不存在则返回 undefined
 */
export const getAccessibleProject = async (req: AuthRequest, projectId: string) => {
  const scope = getProjectOwnerScope(req, "p");
  return queryOne<{ id: string; public_id: string | null; name: string; creator_user_id: string | null }>(
    `SELECT p.id, p.public_id, p.name, p.creator_user_id
     FROM ${table("projects")} p
     WHERE p.id = ? AND ${scope.sql}`,
    [projectId, ...scope.params]
  );
};
