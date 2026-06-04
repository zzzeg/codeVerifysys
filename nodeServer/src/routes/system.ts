import { Router } from "express";
import { respond, authMiddleware, requireAdmin } from "../middlewares/auth";
import { execute, queryOne } from "../db/mysql";
import { table } from "../db/tables";
import type { SystemConfig } from "../db";

const router = Router();
router.use(authMiddleware);

const parseConfig = (val: any): SystemConfig => {
  if (!val) return { siteName: "VerifySys 控制台", logo: "/uploads/logo.png", uploadLimitMb: 5, params: { locale: "zh-CN" } };
  if (typeof val === "object") return val as SystemConfig;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parsed as SystemConfig;
    } catch {
      return { siteName: "VerifySys 控制台", logo: "/uploads/logo.png", uploadLimitMb: 5, params: { locale: "zh-CN" } };
    }
  }
  return { siteName: "VerifySys 控制台", logo: "/uploads/logo.png", uploadLimitMb: 5, params: { locale: "zh-CN" } };
};

router.get("/dict/:type", (req, res) => {
  const { type } = req.params;
  const dict: Record<string, unknown> = {
    status: [
      { label: "启用", value: "active" },
      { label: "禁用", value: "disabled" },
    ],
    cardType: [
      { label: "试用卡", value: "trial" },
      { label: "小时卡", value: "hour" },
      { label: "天卡", value: "day" },
      { label: "周卡", value: "week" },
      { label: "月卡", value: "month" },
      { label: "季卡", value: "quarter" },
      { label: "半年卡", value: "half_year" },
      { label: "年卡", value: "year" },
      { label: "永久卡", value: "permanent" },
    ],
  };
  return respond(res, dict[type] || []);
});

router.use(requireAdmin());

router.get("/config", async (_req, res) => {
  const row = await queryOne<{ config: any }>(`SELECT config FROM ${table("system_config")} WHERE id = 1`);
  if (!row) {
    const now = Date.now();
    const config: SystemConfig = { siteName: "VerifySys 控制台", logo: "/uploads/logo.png", uploadLimitMb: 5, params: { locale: "zh-CN" } };
    await execute(`INSERT INTO ${table("system_config")} (id, config, updated_at) VALUES (1, ?, ?)`, [JSON.stringify(config), now]);
    return respond(res, config);
  }
  return respond(res, parseConfig(row.config));
});

router.put("/config", async (req, res) => {
  const now = Date.now();
  const config = req.body || {};
  await execute(
    `INSERT INTO ${table("system_config")} (id, config, updated_at) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = VALUES(updated_at)`,
    [JSON.stringify(config), now]
  );
  return respond(res, config);
});

export default router;
