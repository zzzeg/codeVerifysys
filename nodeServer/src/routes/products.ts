import { Router } from "express";
import { uuid, type Product, type ProductVariant, type Order } from "../db";
import { respond, respondError, authMiddleware } from "../middlewares/auth";
import { execute, query, queryOne } from "../db/mysql";
import { table } from "../db/tables";

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

// Public routes
router.get("/public/:code", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE link_code = ?`, [req.params.code]);
  if (!row) return respondError(res, "未找到商品", 404);
  return respond(res, mapProductRow(row));
});

router.post("/:id/purchase", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("products")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到商品", 404);
  const product = mapProductRow(row);

  const { variantId, quantity = 1, buyer = "anonymous" } = req.body || {};
  const variant = product.variants.find((v) => v.id === variantId) || product.variants[0];
  if (!variant) return respondError(res, "未找到商品规格", 404);

  const qty = Math.min(Math.max(Number(quantity) || 1, product.minBuy), product.maxBuy);
  const amount = Number(variant.price) * qty;
  const orderId = uuid();
  const now = Date.now();

  await execute(
    `INSERT INTO ${table("orders")} (id, product_id, buyer, quantity, amount, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [orderId, product.id, buyer, qty, amount, now]
  );

  return respond(res, { orderId, amount });
});

router.post("/payment/callback", async (req, res) => {
  const { orderId, status = "paid" } = req.body || {};
  if (!orderId) return respond(res, {});
  await execute(`UPDATE ${table("orders")} SET status = ? WHERE id = ?`, [status, orderId]);
  return respond(res, {});
});

// Protected routes
router.use(authMiddleware);

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

  const projectId = req.body?.projectId;
  const name = req.body?.name;
  if (!projectId || !name) return respondError(res, "projectId 与 name 必填");
  const project = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [projectId]);
  if (!project) return respondError(res, "项目不存在", 400);

  const incoming = sanitizeVariants(req.body?.variants) || [];
  const variants: ProductVariant[] = incoming.map((v) => ({ ...v, id: uuid() }));

  const product: Product = {
    id,
    projectId,
    name,
    summary: req.body?.summary,
    allowAnonymous: req.body?.allowAnonymous ?? true,
    minBuy: req.body?.minBuy ?? 1,
    maxBuy: req.body?.maxBuy ?? 5,
    variants,
    description: req.body?.description,
    linkCode: uuid(),
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

  const projectId = req.body?.projectId;
  if (typeof projectId !== "undefined") {
    const project = await queryOne<{ id: string }>(`SELECT id FROM ${table("projects")} WHERE id = ?`, [projectId]);
    if (!project) return respondError(res, "项目不存在", 400);
  }

  const variantsArr = sanitizeVariants(req.body?.variants);
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
      typeof req.body?.name === "undefined" ? null : req.body.name,
      typeof req.body?.summary === "undefined" ? null : req.body.summary,
      typeof req.body?.allowAnonymous === "undefined" ? null : req.body.allowAnonymous ? 1 : 0,
      typeof req.body?.minBuy === "undefined" ? null : Number(req.body.minBuy),
      typeof req.body?.maxBuy === "undefined" ? null : Number(req.body.maxBuy),
      variants,
      typeof req.body?.description === "undefined" ? null : req.body.description,
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

