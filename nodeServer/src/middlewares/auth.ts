import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { SECRET } from "../config";
import type { User } from "../db";
import { query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

export interface JwtPayloadShape {
  userId: string;
  roles: string[];
}

export interface AuthRequest extends Request {
  user?: User;
  tokenPayload?: JwtPayloadShape;
}

export const respond = (res: Response, data: unknown = {}, message = "success", code = 200) =>
  res.json({ code, message, data, timestamp: Date.now() });

export const respondError = (res: Response, message = "请求错误", code = 400) =>
  res.status(200).json({ code, message, timestamp: Date.now() });

const loadUserById = async (userId: string): Promise<User | undefined> => {
  const row = await queryOne<{
    id: string;
    username: string;
    password_hash: string;
    status: string;
    email: string | null;
    phone: string | null;
    department_id: string | null;
    remark: string | null;
    avatar: string | null;
  }>(`SELECT * FROM ${table("users")} WHERE id = ?`, [userId]);
  if (!row) return;

  const roles = await query<{ role_id: string }>(`SELECT role_id FROM ${table("user_roles")} WHERE user_id = ?`, [
    userId,
  ]);

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    roleIds: roles.map((r) => r.role_id),
    status: row.status === "disabled" ? "disabled" : "active",
    email: row.email || undefined,
    phone: row.phone || undefined,
    departmentId: row.department_id || undefined,
    remark: row.remark || undefined,
    avatar: row.avatar || undefined,
  };
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return respondError(res, "未授权", 401);

  try {
    const payload = jwt.verify(token, SECRET) as JwtPayloadShape;
    const user = await loadUserById(payload.userId);
    if (!user) return respondError(res, "用户不存在", 401);
    if (user.status === "disabled") return respondError(res, "账号已禁用", 403);
    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (_err) {
    return respondError(res, "Token 无效或已过期", 401);
  }
};

