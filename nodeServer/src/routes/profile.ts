import { Router } from "express";
import { uuid, type WithdrawalRecord } from "../db";
import { respond, respondError, authMiddleware, type AuthRequest } from "../middlewares/auth";
import { hashPassword, verifyPassword } from "../utils";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { getPagination } from "../utils/pagination";

const router = Router();
router.use(authMiddleware);

/**
 * 判断当前用户是否具备管理员权限
 * @param req 当前登录请求对象
 * @returns 是否为管理员用户
 */
const isAdminUser = (req: AuthRequest) =>
  Boolean(req.user?.username === "admin" || req.user?.roleIds.includes("role-admin") || req.user?.permissions.includes("*"));

/**
 * 获取订单归属查询条件
 * @param req 当前登录请求对象
 * @returns SQL 条件与对应参数
 */
const getOwnerCondition = (req: AuthRequest) => {
  if (isAdminUser(req)) return { sql: "1 = 1", params: [] as any[] };
  return { sql: "creator_user_id = ?", params: [req.user!.id] as any[] };
};

/**
 * 将提现记录数据库行转换为前端字段
 * @param row 提现记录数据库行
 * @returns 前端提现记录对象
 */
const mapWithdrawalRow = (row: any): WithdrawalRecord => ({
  id: row.id,
  userId: row.user_id,
  amount: Number(row.amount || 0),
  status: row.status === "completed" || row.status === "rejected" ? row.status : "processing",
  bankAccount: row.bank_account,
  createdAt: Number(row.created_at || 0),
  updatedAt: Number(row.updated_at || 0),
  completedAt: row.completed_at ? Number(row.completed_at) : undefined,
});

/**
 * 获取当前用户财务汇总数据
 * @param req 当前登录请求对象
 * @returns 可提现余额、待结算收入和收款账户
 */
const getFinanceSummary = async (req: AuthRequest) => {
  const owner = getOwnerCondition(req);
  const [settled, unsettled, withdrawn] = await Promise.all([
    queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount
       FROM ${table("orders")}
       WHERE ${owner.sql} AND status = 'delivered' AND settlement_status = 'settled'`,
      owner.params,
    ),
    queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount
       FROM ${table("orders")}
       WHERE ${owner.sql} AND status = 'delivered' AND settlement_status <> 'settled'`,
      owner.params,
    ),
    queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount
       FROM ${table("withdrawals")}
       WHERE user_id = ? AND status IN ('processing', 'completed')`,
      [req.user!.id],
    ),
  ]);

  const settledAmount = Number(settled?.amount || 0);
  const withdrawnAmount = Number(withdrawn?.amount || 0);

  return {
    bankName: "支付宝",
    balance: Math.max(settledAmount - withdrawnAmount, 0),
    currentIncome: Number(unsettled?.amount || 0),
  };
};

router.get("/", (req: AuthRequest, res) => {
  const { passwordHash: _pwd, ...safeUser } = req.user || ({} as any);
  return respond(res, safeUser);
});

router.put("/", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { email, phone, remark, avatar, departmentId } = req.body || {};

  await execute(
    `UPDATE ${table("users")}
     SET email = ?,
         phone = ?,
         remark = ?,
         avatar = ?,
         department_id = ?,
         updated_at = ?
     WHERE id = ?`,
    [email ?? null, phone ?? null, remark ?? null, avatar ?? null, departmentId ?? null, Date.now(), userId]
  );

  const { passwordHash: _pwd, ...safeUser } = { ...req.user!, email, phone, remark, avatar, departmentId };
  return respond(res, safeUser);
});

router.put("/password", async (req: AuthRequest, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!verifyPassword(oldPassword || "", req.user!.passwordHash)) return respondError(res, "原密码错误", 400);
  await execute(`UPDATE ${table("users")} SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    hashPassword(newPassword || "123456"),
    Date.now(),
    req.user!.id,
  ]);
  return respond(res, {});
});

router.get("/logs", async (req: AuthRequest, res) => {
  const rows = await query(
    `SELECT id, action, user, created_at
     FROM ${table("logs")}
     WHERE log_type = 'operation' AND user = ?
     ORDER BY created_at DESC
     LIMIT 200`,
    [req.user!.username]
  );
  return respond(res, rows.map((r: any) => ({ id: r.id, action: r.action, user: r.user, createdAt: Number(r.created_at) })));
});

router.get("/finance", async (req: AuthRequest, res) => {
  return respond(res, await getFinanceSummary(req));
});

router.get("/withdrawals", async (req: AuthRequest, res) => {
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM ${table("withdrawals")} WHERE user_id = ?`,
    [req.user!.id],
  );
  const rows = await query(
    `SELECT *
     FROM ${table("withdrawals")}
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [req.user!.id, pageSize, offset],
  );
  return respond(res, { list: rows.map(mapWithdrawalRow), total: Number(totalRow?.c || 0) });
});

router.post("/withdrawals", async (req: AuthRequest, res) => {
  const amount = Number(req.body?.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return respondError(res, "提现金额不合法", 400);
  if (amount < 200) return respondError(res, "提现金额不能低于 200 元", 400);

  const summary = await getFinanceSummary(req);
  if (amount > summary.balance) return respondError(res, "可提现余额不足", 400);

  const now = Date.now();
  await execute(
    `INSERT INTO ${table("withdrawals")}
     (id, user_id, amount, status, bank_account, created_at, updated_at)
     VALUES (?, ?, ?, 'processing', ?, ?, ?)`,
    [uuid(), req.user!.id, amount, summary.bankName, now, now],
  );
  return respond(res, {});
});

router.get("/dashboard", async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.username === "admin" || req.user!.roleIds.includes("role-admin") || req.user!.permissions.includes("*");
  const ownerSql = isAdmin ? "1 = 1" : "creator_user_id = ?";
  const ownerParams = isAdmin ? [] : [userId];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [orders, todayOrders, unsettled, settled, products, codes] = await Promise.all([
    queryOne<{ c: number; amount: number }>(
      `SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as amount FROM ${table("orders")} WHERE ${ownerSql}`,
      ownerParams,
    ),
    queryOne<{ c: number; amount: number }>(
      `SELECT COUNT(*) as c, COALESCE(SUM(amount), 0) as amount FROM ${table("orders")} WHERE ${ownerSql} AND created_at >= ?`,
      [...ownerParams, today.getTime()],
    ),
    queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount FROM ${table("orders")} WHERE ${ownerSql} AND status = 'delivered' AND settlement_status <> 'settled'`,
      ownerParams,
    ),
    queryOne<{ amount: number }>(
      `SELECT COALESCE(SUM(amount), 0) as amount FROM ${table("orders")} WHERE ${ownerSql} AND status = 'delivered' AND settlement_status = 'settled'`,
      ownerParams,
    ),
    queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("products")} WHERE ${ownerSql}`, ownerParams),
    query<{ status: string; c: number }>(
      `SELECT rc.status, COUNT(*) as c
       FROM ${table("register_codes")} rc
       WHERE ${isAdmin ? "1 = 1" : `EXISTS (
         SELECT 1 FROM ${table("products")} p
         WHERE p.project_id = rc.project_id AND p.creator_user_id = ?
       )`}
       GROUP BY rc.status`,
      ownerParams,
    ),
  ]);

  return respond(res, {
    orderCount: Number(orders?.c || 0),
    orderAmount: Number(orders?.amount || 0),
    todayOrderCount: Number(todayOrders?.c || 0),
    todayOrderAmount: Number(todayOrders?.amount || 0),
    unsettledAmount: Number(unsettled?.amount || 0),
    settledAmount: Number(settled?.amount || 0),
    productCount: Number(products?.c || 0),
    codeStats: codes.map((item) => ({ status: item.status, count: Number((item as any).c || 0) })),
  });
});

export default router;
