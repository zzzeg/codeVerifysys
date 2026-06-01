import { Router } from "express";
import { uuid, type Product, type ProductVariant, type Order } from "../db";
import { respond, respondError, authMiddleware, requirePermission } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import { randomCode32 } from "../db";
import { sendOrderDeliveryEmail } from "../utils/mailer";

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

const mapProductRow = (r: any): Product => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  summary: r.summary || undefined,
  allowAnonymous: Boolean(r.allow_anonymous),
  minBuy: Number(r.min_buy || 1),
  maxBuy: Number(r.max_buy || 1),
  variants: parseVariants(r.variants),
  description: r.description || undefined,
  linkCode: r.link_code,
});

const mapOrderRow = (r: any): Order => ({
  id: r.id,
  productId: r.product_id,
  buyer: r.buyer,
  quantity: Number(r.quantity),
  amount: Number(r.amount),
  status: r.status,
  createdAt: Number(r.created_at),
});

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const publicOrderCaptchaStore = new Map<string, { code: string; expireAt: number; productId: string }>();

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
      description,
      allowAnonymous: body?.allowAnonymous ?? true,
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

const issueCardCodes = async (product: Product, variant: ProductVariant, quantity: number, buyerEmail: string) => {
  const cards: string[] = [];
  const now = Date.now();
  const expireAt = now + cardTypeExpireMs(variant.cardType);

  for (let i = 0; i < quantity; i += 1) {
    const code = randomCode32();
    await execute(
      `INSERT INTO ${table("register_codes")}
       (id, code, project_id, project_name, card_type, status, is_online, is_bound, sale_type, remark, expire_at, created_at)
       VALUES (?, ?, ?, ?, ?, 'unused', 0, 0, 'auto_issue', ?, ?, ?)`,
      [uuid(), code, product.projectId, "", variant.cardType, `订单邮箱：${buyerEmail}`, expireAt, now]
    );
    cards.push(code);
  }

  return cards;
};

// Public routes
router.get("/public/:code", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);
  return respond(res, mapProductRow(row));
});

router.post("/public/:code/captcha", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);

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
  const orderId = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO ${table("orders")} (id, product_id, buyer, buyer_email, variant_id, variant_label, quantity, amount, verify_code, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [orderId, product.id, buyer, buyerEmail, variant.id, variant.label, qty, amount, captcha.code, now]
  );

  return respond(res, {
    orderId,
    amount,
    productName: product.name,
    quantity: qty,
    variantLabel: variant.label,
  });
});

router.post("/public/payment/callback", async (req, res) => {
  const { orderId, status = "paid" } = req.body || {};
  if (!orderId) return respond(res, {});

  const orderRow = await queryOne<any>(`SELECT * FROM ${table("orders")} WHERE id = ?`, [orderId]);
  if (!orderRow) return respondError(res, "订单不存在", 404);

  if (orderRow.status === "paid" && orderRow.delivery_payload) {
    return respond(res, { orderId, cards: JSON.parse(orderRow.delivery_payload) });
  }

  await execute(`UPDATE ${table("orders")} SET status = ? WHERE id = ?`, [status, orderId]);
  if (status !== "paid") return respond(res, { orderId, status });

  const productRow = await queryOne(`SELECT * FROM ${table("products")} WHERE id = ?`, [orderRow.product_id]);
  if (!productRow) return respondError(res, "商品不存在", 404);
  const product = mapProductRow(productRow);
  const variant = product.variants.find((item) => item.id === orderRow.variant_id) || product.variants[0];
  if (!variant) return respondError(res, "规格不存在", 404);

  const cards = await issueCardCodes(product, variant, Number(orderRow.quantity || 1), String(orderRow.buyer_email || ""));
  await execute(`UPDATE ${table("orders")} SET delivery_payload = ? WHERE id = ?`, [JSON.stringify(cards), orderId]);

  if (orderRow.buyer_email) {
    await sendOrderDeliveryEmail({
      to: String(orderRow.buyer_email),
      orderId,
      productName: product.name,
      cards,
    });
  }

  return respond(res, { orderId, cards });
});

// Protected routes
router.use(authMiddleware);
router.use(requirePermission("products", "auto-delivery"));

router.get("/", async (req, res) => {
  const { keyword = "" } = req.query as Record<string, string>;
  const kw = (keyword || "").trim();
  const rows = await query(
    `SELECT * FROM ${table("products")} ${kw ? "WHERE name LIKE ?" : ""} ORDER BY created_at DESC`,
    kw ? [`%${kw}%`] : []
  );
  return respond(res, rows.map(mapProductRow));
});

router.get("/orders", async (_req, res) => {
  const rows = await query(`SELECT * FROM ${table("orders")} ORDER BY created_at DESC`);
  return respond(res, rows.map(mapOrderRow));
});

router.get("/orders/:orderId", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("orders")} WHERE id = ?`, [req.params.orderId]);
  if (!row) return respondError(res, "未找到订单", 404);
  return respond(res, mapOrderRow(row));
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到商品", 404);
  return respond(res, mapProductRow(row));
});

router.post("/", async (req, res) => {
  const id = uuid();
  const now = Date.now();
  const sanitized = sanitizeProductPayload(req.body);
  if (!sanitized.ok) return respondError(res, sanitized.message, 400);
  const { projectId, name, summary, description, allowAnonymous, minBuy, maxBuy, variants } = sanitized.payload;
  const project = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [projectId]);
  if (!project) return respondError(res, "项目不存在", 400);
  const normalizedVariants: ProductVariant[] = variants.map((v) => ({ ...v, id: uuid() }));

  const product: Product = {
    id,
    projectId,
    name,
    summary,
    allowAnonymous,
    minBuy,
    maxBuy,
    variants: normalizedVariants,
    description,
    linkCode: await generateUniqueProductLinkCode(),
  };

  await execute(
    `INSERT INTO ${table("products")}
     (id, project_id, name, summary, allow_anonymous, min_buy, max_buy, variants, description, link_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.id,
      product.projectId,
      product.name,
      product.summary || null,
      product.allowAnonymous ? 1 : 0,
      product.minBuy,
      product.maxBuy,
      JSON.stringify(product.variants || []),
      product.description || null,
      product.linkCode,
      now,
    ]
  );

  return respond(res, { id: product.id });
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("products")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到商品", 404);

  const sanitized = sanitizeProductPayload({ ...req.body, projectId: req.body?.projectId ?? "__optional__" });
  if (!sanitized.ok && typeof req.body?.projectId !== "undefined") return respondError(res, sanitized.message, 400);

  const projectId = req.body?.projectId;
  if (typeof projectId !== "undefined") {
    const project = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [projectId]);
    if (!project) return respondError(res, "项目不存在", 400);
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
         name = COALESCE(?, name),
         summary = COALESCE(?, summary),
         allow_anonymous = COALESCE(?, allow_anonymous),
         min_buy = COALESCE(?, min_buy),
         max_buy = COALESCE(?, max_buy),
         variants = COALESCE(?, variants),
         description = COALESCE(?, description)
     WHERE id = ?`,
    [
      typeof projectId === "undefined" ? null : projectId,
      typeof req.body?.name === "undefined" ? null : String(req.body.name || "").trim(),
      typeof req.body?.summary === "undefined" ? null : String(req.body.summary || "").trim(),
      typeof req.body?.allowAnonymous === "undefined" ? null : req.body.allowAnonymous ? 1 : 0,
      typeof req.body?.minBuy === "undefined" ? null : Number(req.body.minBuy),
      typeof req.body?.maxBuy === "undefined" ? null : Number(req.body.maxBuy),
      variants,
      typeof req.body?.description === "undefined" ? null : String(req.body.description || "").trim(),
      req.params.id,
    ]
  );
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await execute(`DELETE FROM ${table("products")} WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.get("/:id/link", async (req, res) => {
  const row = await queryOne<{ link_code: string }>(`SELECT link_code FROM ${table("products")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到商品", 404);
  return respond(res, { link: `/api/products/public/${row.link_code}` });
});

export default router;
