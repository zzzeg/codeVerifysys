import { Router } from "express";
import { uuid, type Product, type ProductVariant, type Order } from "../db";
import { respond, respondError, authMiddleware, requirePermission, type AuthRequest } from "../middlewares/auth";
import { execute, query, queryOne, withTransaction } from "../db/mysql";
import { table } from "../db/tables";
import { randomCode32 } from "../db";
import { sendOrderDeliveryEmail } from "../utils/mailer";
import { createOrderIdCandidate } from "../utils";
import { ResultSetHeader } from "mysql2";
import { getPagination } from "../utils/pagination";
import {
  generateUniquePublicId,
  getAccessibleProject,
  getDeveloperKeywordScope,
  getProjectOwnerScope,
} from "../utils/permissionScope";

const router = Router();

const parseVariants = (val: any): ProductVariant[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val as ProductVariant[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as ProductVariant[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const sanitizeVariants = (raw: any): ProductVariant[] | null => {
  if (typeof raw === "undefined") return null;
  if (!Array.isArray(raw)) return [];
  return raw.map((v: any) => ({
    id: v?.id || uuid(),
    label: String(v?.label || ""),
    price: Number(v?.price || 0),
    cardType: String(v?.cardType || ""),
  }));
};

const cardTypePinyinPrefix = (cardType: string) => {
  const map: Record<string, string> = {
    trial: "shiyongka",
    hour: "xiaoshika",
    day: "tianka",
    week: "zhouka",
    month: "yueka",
    quarter: "jika",
    half_year: "bannianka",
    year: "nianka",
    permanent: "yongjiuka",
  };
  return map[cardType] || String(cardType || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
};

const generateCardCode = (cardType: string, addonMode?: boolean) => {
  if (!addonMode) return randomCode32();
  const prefix = `${cardTypePinyinPrefix(cardType)}+`;
  const randomLength = Math.max(8, 32 - prefix.length);
  return `${prefix}${randomCode32().slice(0, randomLength)}`.slice(0, 32);
};

const mapProductRow = (r: any): Product => ({
  id: r.id,
  publicId: r.public_id || undefined,
  projectId: r.project_id,
  creatorUserId: r.creator_user_id || r.project_creator_user_id || undefined,
  developerUsername: r.developer_username || undefined,
  developerCode: r.developer_code || undefined,
  name: r.name,
  summary: r.summary || undefined,
  status: (r.status as Product["status"]) || "published",
  coverUrl: r.cover_url || undefined,
  allowAnonymous: Boolean(r.allow_anonymous),
  addonMode: Boolean(r.addon_mode),
  minBuy: Number(r.min_buy || 1),
  maxBuy: Number(r.max_buy || 1),
  variants: parseVariants(r.variants),
  description: r.description || undefined,
  linkCode: r.link_code,
});

const mapOrderRow = (r: any): Order => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name || undefined,
  creatorUserId: r.creator_user_id || undefined,
  buyer: r.buyer,
  buyerEmail: r.buyer_email || undefined,
  mockPayToken: r.mock_pay_token || undefined,
  variantId: r.variant_id || undefined,
  variantLabel: r.variant_label || undefined,
  verifyCode: r.verify_code || undefined,
  deliveryPayload: Array.isArray(r.delivery_payload)
    ? r.delivery_payload
    : typeof r.delivery_payload === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(r.delivery_payload);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [],
  quantity: Number(r.quantity),
  amount: Number(r.amount),
  status: r.status,
  settlementStatus: (r.settlement_status as Order["settlementStatus"]) || "unsettled",
  settleAt: r.settle_at ? Number(r.settle_at) : undefined,
  paidAt: r.paid_at ? Number(r.paid_at) : undefined,
  deliveredAt: r.delivered_at ? Number(r.delivered_at) : undefined,
  createdAt: Number(r.created_at),
});

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicOrderCaptchaStore = new Map<string, { code: string; expireAt: number; productId: string }>();
const captchaCleanupIntervalMs = 60_000;
let lastCaptchaCleanupAt = 0;

const cleanupExpiredCaptchas = (now = Date.now()) => {
  if (now - lastCaptchaCleanupAt < captchaCleanupIntervalMs) return;
  lastCaptchaCleanupAt = now;
  for (const [id, captcha] of publicOrderCaptchaStore.entries()) {
    if (captcha.expireAt < now) publicOrderCaptchaStore.delete(id);
  }
};

const svgEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const createCaptchaText = (length = 4) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let text = "";
  for (let i = 0; i < length; i += 1) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }
  return text;
};

const createCaptchaSvg = (text: string) => {
  const width = 132;
  const height = 44;
  const chars = text
    .split("")
    .map((char, index) => {
      const x = 18 + index * 26;
      const y = 28 + (index % 2 === 0 ? -2 : 3);
      const rotate = (index % 2 === 0 ? -12 : 10) + (index === 1 ? 3 : 0);
      const color = ["#1d4ed8", "#7c3aed", "#0f766e", "#ea580c"][index % 4];
      return `<text x="${x}" y="${y}" fill="${color}" font-size="24" font-family="Arial, sans-serif" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${svgEscape(char)}</text>`;
    })
    .join("");

  const lines = Array.from({ length: 4 }, (_, index) => {
    const y1 = 8 + index * 9;
    const y2 = 14 + ((index + 1) % 4) * 7;
    const color = ["#cbd5e1", "#bfdbfe", "#ddd6fe", "#fecaca"][index % 4];
    return `<line x1="8" y1="${y1}" x2="124" y2="${y2}" stroke="${color}" stroke-width="1.2" />`;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="8" fill="#f8fafc"/>
      ${lines}
      ${chars}
    </svg>
  `.trim();
};

const cardTypeExpireMs = (cardType: string) => {
  const day = 86400000;
  const map: Record<string, number> = {
    trial: 1 * day,
    hour: 3600000,
    day: 1 * day,
    week: 7 * day,
    month: 30 * day,
    quarter: 90 * day,
    half_year: 180 * day,
    year: 365 * day,
    permanent: 3650 * day,
  };
  return map[cardType] || 30 * day;
};

const createShortLinkCode = () => Math.random().toString(16).slice(2, 10).toLowerCase().padEnd(8, "0").slice(0, 8);

const sanitizeProductPayload = (body: any) => {
  const name = String(body?.name || "").trim();
  const summary = String(body?.summary || "").trim();
  const status: Product["status"] = body?.status === "draft" ? "draft" : "published";
  const coverUrl = "";
  const description = typeof body?.description === "undefined" ? undefined : String(body.description || "").trim();
  const minBuy = Number(body?.minBuy ?? 1);
  const maxBuy = Number(body?.maxBuy ?? 5);
  const rawVariants = sanitizeVariants(body?.variants) || [];
  const variants = rawVariants.map((variant) => ({
    ...variant,
    label: String(variant.label || "").trim(),
    price: Number(variant.price || 0),
    cardType: String(variant.cardType || "").trim(),
  }));

  if (!body?.projectId) return { ok: false as const, message: "projectId 必填" };
  if (!name) return { ok: false as const, message: "name 必填" };
  if (summary.length > 200) return { ok: false as const, message: "商品简介不能超过 200 个字符" };
  if (!Number.isFinite(minBuy) || !Number.isFinite(maxBuy) || minBuy < 1 || maxBuy < 1 || minBuy > maxBuy || maxBuy > 1000) {
    return { ok: false as const, message: "购买数量范围不合法" };
  }
  if (!variants.length) return { ok: false as const, message: "至少需要一个商品规格" };
  if (variants.some((variant) => !variant.label || !variant.cardType)) {
    return { ok: false as const, message: "商品规格名称和卡类型不能为空" };
  }
  if (variants.some((variant) => !Number.isFinite(variant.price) || variant.price < 0)) {
    return { ok: false as const, message: "商品价格必须为非负数" };
  }

  return {
    ok: true as const,
    payload: {
      projectId: String(body.projectId),
      name,
      summary,
      status,
      coverUrl,
      description,
      allowAnonymous: body?.allowAnonymous ?? true,
      addonMode: Boolean(body?.addonMode),
      minBuy,
      maxBuy,
      variants,
    },
  };
};

const generateUniqueProductLinkCode = async () => {
  for (let i = 0; i < 8; i += 1) {
    const linkCode = createShortLinkCode();
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("products")} WHERE link_code = ?`, [linkCode]);
    if (!exists) return linkCode;
  }
  return uuid().replace(/-/g, "").slice(0, 8).toLowerCase();
};

const generateUniqueOrderId = async (developerCode: string) => {
  for (let i = 0; i < 20; i += 1) {
    const orderId = createOrderIdCandidate(developerCode);
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("orders")} WHERE id = ?`, [orderId]);
    if (!exists) return orderId;
  }
  throw new Error("生成订单号失败");
};

const isDuplicateEntry = (err: any) => String(err?.code || "").includes("ER_DUP_ENTRY");

/**
 * 按内部 ID 或 public_id 查询当前用户可访问的商品
 *
 * @param req 当前请求对象，内部读取登录用户的数据范围
 * @param value 商品内部 ID 或 public_id
 * @returns 返回商品记录，不存在或无权访问时返回 undefined
 */
const getAccessibleProduct = async (req: AuthRequest, value: string) => {
  const owner = getProjectOwnerScope(req, "p");
  return queryOne(
    `SELECT pr.*, p.creator_user_id as project_creator_user_id,
            u.username as developer_username,
            u.developer_code as developer_code
     FROM ${table("products")} pr
     LEFT JOIN ${table("projects")} p ON p.id = pr.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     WHERE (pr.id = ? OR pr.public_id = ?) AND ${owner.sql}`,
    [value, value, ...owner.params]
  );
};

const insertIssuedCode = async (
  conn: any,
  product: Product,
  variant: ProductVariant,
  projectName: string,
  buyerEmail: string,
  now: number,
) => {
  const expireAt = now + cardTypeExpireMs(variant.cardType);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateCardCode(variant.cardType, product.addonMode);
    try {
      await conn.execute(
        `INSERT INTO ${table("register_codes")}
         (id, code, project_id, project_name, card_type, status, is_online, is_bound, sale_type, remark, expire_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'unused', 0, 0, 'auto_issue', ?, ?, ?)`,
        [uuid(), code, product.projectId, projectName, variant.cardType, `订单邮箱：${buyerEmail}`, expireAt, now],
      );
      return code;
    } catch (err) {
      if (isDuplicateEntry(err)) continue;
      throw err;
    }
  }
  throw new Error("生成卡密失败：多次尝试仍冲突");
};

const issueCardCodes = async (product: Product, variant: ProductVariant, quantity: number, buyerEmail: string) => {
  const cards: string[] = [];
  const now = Date.now();
  const projectRow = await queryOne<{ name: string }>(`SELECT name FROM ${table("projects")} WHERE id = ?`, [product.projectId]);
  const projectName = projectRow?.name || product.projectId;

  for (let i = 0; i < quantity; i += 1) {
    cards.push(await insertIssuedCode({ execute }, product, variant, projectName, buyerEmail, now));
  }

  return cards;
};

// Public routes
router.get("/public/:code", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);
  if (row.status === "draft") return respondError(res, "商品尚未发布", 404);
  return respond(res, mapProductRow(row));
});

router.post("/public/:code/captcha", async (req, res) => {
  cleanupExpiredCaptchas();
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);
  if (row.status === "draft") return respondError(res, "商品尚未发布", 404);

  const code = createCaptchaText();
  const captchaId = uuid();
  const expireAt = Date.now() + 5 * 60_000;
  publicOrderCaptchaStore.set(captchaId, { code, expireAt, productId: row.id });
  return respond(res, {
    captchaId,
    image: `data:image/svg+xml;utf8,${encodeURIComponent(createCaptchaSvg(code))}`,
    expireAt,
  });
});

router.post("/public/:code/purchase", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);
  const product = mapProductRow(row);
  if (product.status === "draft") return respondError(res, "商品尚未发布", 404);
  if (!product.creatorUserId) return respondError(res, "商品尚未绑定创建者，暂不可购买", 400);
  if (!product.allowAnonymous) return respondError(res, "该商品未开启匿名购买", 403);

  const { variantId, quantity = 1, buyer = "anonymous", email = "", captchaCode = "", captchaId = "" } = req.body || {};
  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  if (!variant) return respondError(res, "未找到商品规格", 404);

  const buyerEmail = String(email || "").trim().toLowerCase();
  if (!buyerEmail || !isEmail(buyerEmail)) return respondError(res, "邮箱格式不正确", 400);

  const captcha = publicOrderCaptchaStore.get(String(captchaId || ""));
  if (
    !captcha ||
    captcha.productId !== product.id ||
    captcha.expireAt < Date.now() ||
    captcha.code.toUpperCase() !== String(captchaCode || "").trim().toUpperCase()
  ) {
    return respondError(res, "验证码错误或已过期", 400);
  }
  publicOrderCaptchaStore.delete(String(captchaId || ""));

  const qty = Math.min(Math.max(Number(quantity) || 1, product.minBuy), product.maxBuy);
  const amount = Number(variant.price) * qty;
  const creatorRow = await queryOne<{ developer_code: string | null }>(
    `SELECT developer_code FROM ${table("users")} WHERE id = ?`,
    [product.creatorUserId],
  );
  const developerCode = String(creatorRow?.developer_code || "").trim().toUpperCase();
  if (!developerCode) return respondError(res, "商品创建者缺少开发者短码，暂不可购买", 400);
  const orderId = await generateUniqueOrderId(developerCode);
  const mockPayToken = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO ${table("orders")} (id, product_id, creator_user_id, buyer, buyer_email, mock_pay_token, variant_id, variant_label, quantity, amount, verify_code, status, settlement_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unsettled', ?)`,
    [orderId, product.id, product.creatorUserId, buyer, buyerEmail, mockPayToken, variant.id, variant.label, qty, amount, captcha.code, now]
  );

  return respond(res, {
    orderId,
    mockPayToken,
    amount,
    productName: product.name,
    quantity: qty,
    variantLabel: variant.label,
  });
});

router.post("/public/payment/callback", async (req, res) => {
  const { orderId, mockPayToken = "", status = "paid" } = req.body || {};
  if (!orderId) return respond(res, {});

  const orderRow = await queryOne<any>(`SELECT * FROM ${table("orders")} WHERE id = ?`, [orderId]);
  if (!orderRow) return respondError(res, "订单不存在", 404);
  if (String(orderRow.mock_pay_token || "") !== String(mockPayToken || "")) {
    return respondError(res, "支付确认凭证无效", 403);
  }

  if (orderRow.status === "delivered" && orderRow.delivery_payload) {
    return respond(res, { orderId, cards: JSON.parse(orderRow.delivery_payload) });
  }

  let cards: string[] = [];
  let productName = "";
  let buyerEmail = "";

  try {
    const result = await withTransaction(async (conn) => {
      const [lockedRows] = await conn.query(`SELECT * FROM ${table("orders")} WHERE id = ? FOR UPDATE`, [orderId]);
      const lockedOrder = (lockedRows as any[])[0];
      if (!lockedOrder) throw new Error("订单不存在");
      if (String(lockedOrder.mock_pay_token || "") !== String(mockPayToken || "")) throw new Error("支付确认凭证无效");
      if (lockedOrder.status === "delivered" && lockedOrder.delivery_payload) {
        return {
          cards: JSON.parse(lockedOrder.delivery_payload),
          productName: "",
          buyerEmail: String(lockedOrder.buyer_email || ""),
          alreadyDelivered: true,
        };
      }

      const now = Date.now();
      const configRow = await queryOne<{ config: any }>(`SELECT config FROM ${table("system_config")} WHERE id = 1`);
      const config =
        typeof configRow?.config === "string"
          ? JSON.parse(configRow.config)
          : configRow?.config || {};
      const settlementDays = Math.max(Number(config.settlementDays ?? 1) || 1, 0);
      const settleAt = now + settlementDays * 86400000;
      const updateResult = await conn.execute(
        `UPDATE ${table("orders")} SET status = ?, paid_at = ?, settle_at = ? WHERE id = ? AND status = 'pending'`,
        [status, status === "paid" ? now : null, status === "paid" ? settleAt : null, orderId],
      );
      const affectedRows = ((updateResult[0] as ResultSetHeader)?.affectedRows || 0);
      if (affectedRows === 0) throw new Error("订单状态已变更，请刷新后重试");
      if (status !== "paid") return { cards: [], productName: "", buyerEmail: String(lockedOrder.buyer_email || "") };

      const [productRows] = await conn.query(`SELECT * FROM ${table("products")} WHERE id = ?`, [lockedOrder.product_id]);
      const productRow = (productRows as any[])[0];
      if (!productRow) throw new Error("商品不存在");
      const product = mapProductRow(productRow);
      const variant = product.variants.find((item) => item.id === lockedOrder.variant_id) || product.variants[0];
      if (!variant) throw new Error("规格不存在");

      const [projectRows] = await conn.query(`SELECT name FROM ${table("projects")} WHERE id = ?`, [product.projectId]);
      const projectName = (projectRows as any[])[0]?.name || product.projectId;
      const issued: string[] = [];
      for (let i = 0; i < Number(lockedOrder.quantity || 1); i += 1) {
        issued.push(await insertIssuedCode(conn, product, variant, projectName, String(lockedOrder.buyer_email || ""), now));
      }

      await conn.execute(
        `UPDATE ${table("orders")} SET status = 'delivered', delivery_payload = ?, delivered_at = ? WHERE id = ?`,
        [JSON.stringify(issued), Date.now(), orderId],
      );
      await conn.execute(
        `INSERT INTO ${table("notifications")} (id, title, content, category, is_read, created_at)
         VALUES (?, ?, ?, 'order', 0, ?)`,
        [uuid(), "新订单已发货", `订单 ${orderId} 已自动发货，金额 ${Number(lockedOrder.amount || 0).toFixed(2)} 元。`, now],
      );
      return { cards: issued, productName: product.name, buyerEmail: String(lockedOrder.buyer_email || "") };
    });
    cards = result.cards;
    productName = result.productName;
    buyerEmail = result.buyerEmail;
  } catch (error: any) {
    return respondError(res, error?.message || "支付确认失败", 400);
  }

  if (buyerEmail && cards.length && productName) {
    try {
      await sendOrderDeliveryEmail({
        to: buyerEmail,
        orderId,
        productName,
        cards,
      });
    } catch (error) {
      console.error("【订单发货】【发送邮件】订单发货邮件发送失败：", error);
    }
  }

  return respond(res, { orderId, cards });
});

// Protected routes
router.use(authMiddleware);
router.use(requirePermission("products", "auto-delivery"));

router.get("/", async (req: AuthRequest, res) => {
  const owner = getProjectOwnerScope(req, "p");
  const { keyword = "", projectId = "", developerKeyword = "" } = req.query as Record<string, string>;
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const kw = (keyword || "").trim();
  const where = [owner.sql];
  const params = [...owner.params];
  if (projectId.trim()) {
    where.push("pr.project_id = ?");
    params.push(projectId.trim());
  }
  if (kw) {
    where.push("pr.name LIKE ?");
    params.push(`%${kw}%`);
  }
  const developerScope = getDeveloperKeywordScope(developerKeyword, "u");
  if (developerScope.sql) {
    where.push(developerScope.sql);
    params.push(...developerScope.params);
  }
  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM ${table("products")} pr
     LEFT JOIN ${table("projects")} p ON p.id = pr.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     WHERE ${where.join(" AND ")}`,
    params,
  );
  const pagedRows = await query(
    `SELECT pr.*, p.creator_user_id as project_creator_user_id,
            u.username as developer_username,
            u.developer_code as developer_code
     FROM ${table("products")} pr
     LEFT JOIN ${table("projects")} p ON p.id = pr.project_id
     LEFT JOIN ${table("users")} u ON u.id = p.creator_user_id
     WHERE ${where.join(" AND ")}
     ORDER BY pr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return respond(res, { list: pagedRows.map(mapProductRow), total: Number(totalRow?.c || 0) });
});

router.get("/orders", async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return respondError(res, "未授权", 401);
  const { productName = "", startTime = "", endTime = "" } = req.query as Record<string, string>;
  const { pageSize, offset } = getPagination(req.query as Record<string, any>);
  const where = [`o.creator_user_id = ?`];
  const params: any[] = [userId];

  if (productName.trim()) {
    where.push("p.name LIKE ?");
    params.push(`%${productName.trim()}%`);
  }
  if (startTime) {
    where.push("o.created_at >= ?");
    params.push(Number(startTime));
  }
  if (endTime) {
    where.push("o.created_at <= ?");
    params.push(Number(endTime));
  }

  const totalRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM ${table("orders")} o
     LEFT JOIN ${table("products")} p ON p.id = o.product_id
     WHERE ${where.join(" AND ")}`,
    params,
  );
  const rows = await query(
    `SELECT o.*, p.name as product_name
     FROM ${table("orders")} o
     LEFT JOIN ${table("products")} p ON p.id = o.product_id
     WHERE ${where.join(" AND ")}
     ORDER BY o.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return respond(res, { list: rows.map(mapOrderRow), total: Number(totalRow?.c || 0) });
});

router.get("/orders/:orderId", async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return respondError(res, "未授权", 401);
  const row = await queryOne(
    `SELECT o.*, p.name as product_name
     FROM ${table("orders")} o
     LEFT JOIN ${table("products")} p ON p.id = o.product_id
     WHERE o.id = ? AND o.creator_user_id = ?`,
    [req.params.orderId, userId],
  );
  if (!row) return respondError(res, "未找到订单", 404);
  return respond(res, mapOrderRow(row));
});

router.get("/:id", async (req, res) => {
  const row = await getAccessibleProduct(req as AuthRequest, req.params.id);
  if (!row) return respondError(res, "未找到商品", 404);
  return respond(res, mapProductRow(row));
});

router.post("/", async (req: AuthRequest, res) => {
  const id = uuid();
  const now = Date.now();
  const sanitized = sanitizeProductPayload(req.body);
  if (!sanitized.ok) return respondError(res, sanitized.message, 400);
  const { projectId, name, summary, status, description, allowAnonymous, addonMode, minBuy, maxBuy, variants } = sanitized.payload;
  const project = await getAccessibleProject(req, projectId);
  if (!project) return respondError(res, "项目不存在或无权访问", 400);
  const normalizedVariants: ProductVariant[] = variants.map((v) => ({ ...v, id: uuid() }));
  const nextPublicId = await generateUniquePublicId("products");

  const product: Product = {
    id,
    publicId: nextPublicId,
    projectId: project.id,
    creatorUserId: project.creator_user_id || req.user?.id,
    name,
    summary,
    status,
    coverUrl: "",
    allowAnonymous,
    addonMode,
    minBuy,
    maxBuy,
    variants: normalizedVariants,
    description,
    linkCode: await generateUniqueProductLinkCode(),
  };

  await execute(
     `INSERT INTO ${table("products")}
     (id, public_id, project_id, creator_user_id, name, summary, status, cover_url, allow_anonymous, addon_mode, min_buy, max_buy, variants, description, link_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.publicId,
      product.projectId,
      product.creatorUserId || null,
      product.name,
      product.summary || null,
      product.status || "published",
      product.coverUrl || null,
      product.allowAnonymous ? 1 : 0,
      product.addonMode ? 1 : 0,
      product.minBuy,
      product.maxBuy,
      JSON.stringify(product.variants || []),
      product.description || null,
      product.linkCode,
      now,
    ]
  );
  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, action, user, status, message, created_at) VALUES (?, 'operation', 'create_product', ?, 'success', ?, ?)`,
    [uuid(), req.user?.username || "", `创建商品：${product.name}`, now],
  );

  return respond(res, { id: product.id, publicId: product.publicId });
});

router.put("/:id", async (req: AuthRequest, res) => {
  const existing = await getAccessibleProduct(req, req.params.id);
  if (!existing) return respondError(res, "未找到商品", 404);

  const sanitized = sanitizeProductPayload({ ...req.body, projectId: req.body?.projectId ?? "__optional__" });
  if (!sanitized.ok && typeof req.body?.projectId !== "undefined") return respondError(res, sanitized.message, 400);

  const projectId = req.body?.projectId;
  let nextProjectId: string | undefined;
  let nextCreatorUserId: string | undefined;
  if (typeof projectId !== "undefined") {
    const project = await getAccessibleProject(req, String(projectId));
    if (!project) return respondError(res, "项目不存在或无权访问", 400);
    nextProjectId = project.id;
    nextCreatorUserId = project.creator_user_id || req.user?.id;
  }

  if (typeof req.body?.summary !== "undefined" && String(req.body.summary || "").trim().length > 200) {
    return respondError(res, "商品简介不能超过 200 个字符", 400);
  }
  if (typeof req.body?.minBuy !== "undefined" || typeof req.body?.maxBuy !== "undefined") {
    const minBuy = Number(req.body?.minBuy);
    const maxBuy = Number(req.body?.maxBuy);
    if (!Number.isFinite(minBuy) || !Number.isFinite(maxBuy) || minBuy < 1 || maxBuy < 1 || minBuy > maxBuy || maxBuy > 1000) {
      return respondError(res, "购买数量范围不合法", 400);
    }
  }

  const variantsArr = sanitizeVariants(req.body?.variants)?.map((variant) => ({
    ...variant,
    label: String(variant.label || "").trim(),
    price: Number(variant.price || 0),
    cardType: String(variant.cardType || "").trim(),
  })) || null;
  if (variantsArr && (!variantsArr.length || variantsArr.some((variant) => !variant.label || !variant.cardType || !Number.isFinite(variant.price) || variant.price < 0))) {
    return respondError(res, "商品规格数据不合法", 400);
  }
  const variants = variantsArr ? JSON.stringify(variantsArr) : null;

  await execute(
    `UPDATE ${table("products")}
     SET project_id = COALESCE(?, project_id),
         creator_user_id = COALESCE(?, creator_user_id),
         name = COALESCE(?, name),
         summary = COALESCE(?, summary),
         status = COALESCE(?, status),
         cover_url = cover_url,
         allow_anonymous = COALESCE(?, allow_anonymous),
         addon_mode = COALESCE(?, addon_mode),
         min_buy = COALESCE(?, min_buy),
         max_buy = COALESCE(?, max_buy),
         variants = COALESCE(?, variants),
         description = COALESCE(?, description)
     WHERE id = ?`,
    [
      typeof projectId === "undefined" ? null : nextProjectId || null,
      typeof projectId === "undefined" ? null : nextCreatorUserId || null,
      typeof req.body?.name === "undefined" ? null : String(req.body.name || "").trim(),
      typeof req.body?.summary === "undefined" ? null : String(req.body.summary || "").trim(),
      typeof req.body?.status === "undefined" ? null : req.body.status === "draft" ? "draft" : "published",
      typeof req.body?.allowAnonymous === "undefined" ? null : req.body.allowAnonymous ? 1 : 0,
      typeof req.body?.addonMode === "undefined" ? null : req.body.addonMode ? 1 : 0,
      typeof req.body?.minBuy === "undefined" ? null : Number(req.body.minBuy),
      typeof req.body?.maxBuy === "undefined" ? null : Number(req.body.maxBuy),
      variants,
      typeof req.body?.description === "undefined" ? null : String(req.body.description || "").trim(),
      (existing as any).id,
    ]
  );
  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, action, user, status, message, created_at) VALUES (?, 'operation', 'update_product', ?, 'success', ?, ?)`,
    [uuid(), req.user?.username || "", `更新商品：${req.params.id}`, Date.now()],
  );
  return respond(res, {});
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const existing = await getAccessibleProduct(req, req.params.id);
  if (!existing) return respondError(res, "未找到商品", 404);
  await execute(`DELETE FROM ${table("products")} WHERE id = ?`, [(existing as any).id]);
  await execute(
    `INSERT INTO ${table("logs")} (id, log_type, action, user, status, message, created_at) VALUES (?, 'operation', 'delete_product', ?, 'success', ?, ?)`,
    [uuid(), req.user?.username || "", `删除商品：${req.params.id}`, Date.now()],
  );
  return respond(res, {});
});

router.get("/:id/link", async (req: AuthRequest, res) => {
  const row = await getAccessibleProduct(req, req.params.id) as { link_code?: string; status?: string } | undefined;
  if (!row) return respondError(res, "未找到商品", 404);
  if (row.status === "draft") return respondError(res, "草稿商品没有公开链接", 400);
  return respond(res, { link: `/api/products/public/${row.link_code}` });
});

export default router;
