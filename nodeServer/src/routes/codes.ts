import { Router } from "express";
import {
  uuid,
  randomCode32,
  type RegisterCode,
  type CodeStatus,
} from "../db";
import { respond, respondError, authMiddleware, requirePermission } from "../middlewares/auth";
import { execute, query, queryOne, withTransaction } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);
router.use(requirePermission("codes"));

const cardTypeExpireMsSqlCase = (cardTypeCol: string) => {
  const day = 86400000;
  return `CASE ${cardTypeCol}
    WHEN 'trial' THEN ${1 * day}
    WHEN 'hour' THEN ${3600000}
    WHEN 'day' THEN ${1 * day}
    WHEN 'week' THEN ${7 * day}
    WHEN 'month' THEN ${30 * day}
    WHEN 'quarter' THEN ${90 * day}
    WHEN 'half_year' THEN ${180 * day}
    WHEN 'year' THEN ${365 * day}
    WHEN 'permanent' THEN ${3650 * day}
    ELSE ${30 * day}
  END`;
};

const syncCodeExpireAndStatus = async (now: number) => {
  const durationCase = cardTypeExpireMsSqlCase("card_type");

  // 1) 只对已激活的注册码计算/修正 expire_at：expire_at = max(expire_at, activated_at + 卡时长)
  await execute(
    `UPDATE ${table("register_codes")}
     SET expire_at = GREATEST(IFNULL(expire_at, 0), activated_at + ${durationCase})
     WHERE activated_at IS NOT NULL
       AND status <> 'deleted'
       AND (expire_at IS NULL OR expire_at < activated_at + ${durationCase})`,
    []
  );

  // 2) 过期判断：仅已激活才会过期
  await execute(
    `UPDATE ${table("register_codes")}
     SET status = 'expired'
     WHERE status NOT IN ('deleted','expired')
       AND activated_at IS NOT NULL
       AND expire_at IS NOT NULL
       AND expire_at < ?`,
    [now]
  );

  // 3) 已激活且未过期的，状态修正为 in_use（避免激活后仍显示 unused）
  await execute(
    `UPDATE ${table("register_codes")}
     SET status = 'in_use'
     WHERE status = 'unused'
       AND activated_at IS NOT NULL
       AND (expire_at IS NULL OR expire_at >= ?)`,
    [now]
  );
};

const mapCodeRow = (r: any): RegisterCode => ({
  id: r.id,
  code: r.code,
  projectId: r.project_id,
  projectName: r.project_name,
  cardType: r.card_type,
  status: r.status,
  isOnline: Boolean(r.is_online),
  isBound: Boolean(r.is_bound),
  saleType:r.sale_type,
  machineCode: r.machine_code || undefined,
  lastLoginIp: r.last_login_ip || undefined,
  lastLoginAt: r.last_login_at ? Number(r.last_login_at) : undefined,
  activatedAt: r.activated_at ? Number(r.activated_at) : undefined,
  unbindPassword: r.unbind_password || undefined,
  customerInfo: r.customer_info || undefined,
  remark: r.remark || undefined,
  expireAt: r.activated_at
    ? Math.max(r.expire_at ? Number(r.expire_at) : 0, Number(r.activated_at) + cardTypeExpireMs(r.card_type))
    : undefined,
  createdAt: Number(r.created_at),
});

const cardTypeExpireMs = (cardType: string) => {
  const day = 86400000;
  switch (cardType) {
    case "trial":
      return 1 * day;
    case "hour":
      return 3600000;
    case "day":
      return 1 * day;
    case "week":
      return 7 * day;
    case "month":
      return 30 * day;
    case "quarter":
      return 90 * day;
    case "half_year":
      return 180 * day;
    case "year":
      return 365 * day;
    case "permanent":
      return 3650 * day; // 10 年
    default:
      return 30 * day;
  }
};

const renewUnitMs = (unit: string) => {
  const day = 86400000;
  switch (unit) {
    case "hour":
      return 3600000;
    case "day":
      return day;
    case "week":
      return 7 * day;
    case "month":
      return 30 * day;
    case "quarter":
      return 90 * day;
    case "half_year":
      return 180 * day;
    case "year":
      return 365 * day;
    default:
      return 0;
  }
};

const getRenewDurationMs = (body: any) => {
  const explicitDurationMs = Number(body?.durationMs);
  if (Number.isFinite(explicitDurationMs) && explicitDurationMs !== 0) return Math.trunc(explicitDurationMs);

  const quantity = Number(body?.quantity);
  const unitMs = renewUnitMs(String(body?.unit || ""));
  if (Number.isFinite(quantity) && quantity !== 0 && unitMs > 0) return Math.trunc(quantity * unitMs);

  const days = Number(body?.days);
  if (Number.isFinite(days) && days !== 0) return Math.trunc(days * 86400000);

  return 30 * 86400000;
};

const getRenewBaseTime = (expireAt: number | null | undefined, addMs: number, now: number) => {
  const currentExpireAt = expireAt ? Number(expireAt) : 0;
  if (addMs > 0) return currentExpireAt > now ? currentExpireAt : now;
  return currentExpireAt || now;
};

const normalizeImportDelimiter = (delimiter: string) => {
  if (delimiter === '\t' || delimiter === 'tab') return '\t';
  if (delimiter === ';') return ';';
  return ',';
};

const normalizeImportCardType = (value?: string | null) => {
  const text = String(value || '').trim().toLowerCase();
  const mapping: Record<string, string> = {
    trial: 'trial',
    '试用卡': 'trial',
    hour: 'hour',
    '小时卡': 'hour',
    day: 'day',
    '天卡': 'day',
    week: 'week',
    '周卡': 'week',
    month: 'month',
    '月卡': 'month',
    quarter: 'quarter',
    '季卡': 'quarter',
    half_year: 'half_year',
    '半年卡': 'half_year',
    year: 'year',
    '年卡': 'year',
    permanent: 'permanent',
    '永久卡': 'permanent',
  };
  return mapping[text] || '';
};

const parseImportTime = (value?: string | null) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.replace(/\//g, '-');
  const timestamp = Date.parse(normalized.replace(' ', 'T'));
  if (Number.isNaN(timestamp)) {
    throw new Error(`无法解析时间：${text}`);
  }
  return timestamp;
};

const inferCardTypeFromExpire = (activatedAt: number | null, expireAt: number | null) => {
  if (!activatedAt || !expireAt || expireAt <= activatedAt) return '';
  const diff = expireAt - activatedAt;
  const mapping: Array<[string, number]> = [
    ['hour', 3600000],
    ['day', 86400000],
    ['week', 7 * 86400000],
    ['month', 30 * 86400000],
    ['quarter', 90 * 86400000],
    ['half_year', 180 * 86400000],
    ['year', 365 * 86400000],
    ['permanent', 3650 * 86400000],
  ];
  const matched = mapping.find((item) => Math.abs(diff - item[1]) < 1000);
  return matched ? matched[0] : '';
};
// 假设你用到的依赖和类型已经定义（uuid、queryOne、withTransaction、table、cardTypeExpireMs、respond、respondError、RegisterCode）
router.post("/generate", async (req, res) => {
  const { count = 1, projectId, projectName, saletype, remark, cardType = "month" } = req.body || {};
  const taskId = uuid();
  const generated: string[] = [];
  const items: RegisterCode[] = [];

  // 根据projectId或projectName查询项目
  const project =
    (projectId
      ? await queryOne<{ id: string; name: string }>(`SELECT id, name FROM ${table("projects")} WHERE id = ?`, [projectId])
      : undefined) ||
    (projectName
      ? await queryOne<{ id: string; name: string }>(`SELECT id, name FROM ${table("projects")} WHERE name = ?`, [projectName])
      : undefined);

  if (!project) return respondError(res, "项目不存在", 400);

  const resolvedProjectId = project.id;
  const resolvedProjectName = project.name;
  const now = Date.now();
  const expireAt = null;

  // 事务内生成注册码
  await withTransaction(async (conn) => {
    // 限制生成数量：1~5000
    const max = Math.min(Math.max(Number(count) || 1, 1), 5000);
    for (let i = 0; i < max; i++) {
      let ok = false;
      let codeValue = "";
      // 最多尝试5次（避免code重复）
      for (let attempt = 0; attempt < 5; attempt++) {
        codeValue = randomCode32();
        try {
          const id = uuid();
          // 核心修复：占位符与参数严格一一对应
          await conn.execute(
            `INSERT INTO ${table("register_codes")}
             (
               id, code, project_id, project_name, card_type, 
               status, is_online, is_bound, machine_code, last_login_ip, 
               last_login_at, activated_at, unbind_password, 
               sale_type, remark, expire_at, created_at
             )
             VALUES (
               ?, ?, ?, ?, ?, 
               'unused', 0, 0, NULL, NULL, 
               NULL, NULL, NULL, 
               ?, ?, ?, ?
             )`,
            [
              // 前5个参数：对应id, code, project_id, project_name, card_type
              id,
              codeValue,
              resolvedProjectId,
              resolvedProjectName,
              cardType,
              // 后4个参数：对应sale_type, remark, expire_at, created_at（关键：顺序完全匹配）
              saletype,        // 对应sale_type的?
              remark || null,  // 对应remark的?
              expireAt,        // 对应expire_at的?
              now              // 对应created_at的?
            ]
          );

          // 组装返回的注册码信息
          const item: RegisterCode = {
            id,
            code: codeValue,
            projectId: resolvedProjectId,
            projectName: resolvedProjectName,
            cardType,
            status: "unused",
            isOnline: false,
            isBound: false,
            saleType: saletype || "author_generated", // 这里的saleType是正确的
            remark: remark || undefined,
            createdAt: now,
          };
          items.push(item);
          generated.push(codeValue);
          ok = true;
          break;
        } catch (err: any) {
          // 捕获唯一索引冲突（code重复），继续重试
          if (String(err?.code || "").includes("ER_DUP_ENTRY")) continue;
          // 其他错误直接抛出
          throw err;
        }
      }
      if (!ok) throw new Error("生成注册码失败：多次尝试仍冲突");
    }
  });

  return respond(res, { taskId, generated, items });
});


router.post("/import", async (req, res) => {
  const projectId = String(req.body?.projectId || '').trim();
  const delimiter = normalizeImportDelimiter(String(req.body?.delimiter || ','));
  const content = String(req.body?.content || '');

  if (!projectId) return respondError(res, '项目不能为空', 400);
  if (!content.trim()) return respondError(res, '导入内容不能为空', 400);

  const project = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM ${table("projects")} WHERE id = ?`,
    [projectId]
  );
  if (!project) return respondError(res, '项目不存在', 400);

  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean);

  if (!lines.length) return respondError(res, '没有可导入的数据', 400);

  const now = Date.now();
  const items: RegisterCode[] = [];

  try {
    await withTransaction(async (conn) => {
      for (let index = 0; index < lines.length; index += 1) {
        const lineNo = index + 1;
        const columns = lines[index].split(delimiter).map((item) => item.trim());
        const [code, activatedText = '', expireText = '', cardTypeText = ''] = columns;

        if (!code) {
          throw new Error(`第${lineNo}行注册码不能为空`);
        }

        const activatedAt = parseImportTime(activatedText);
        const expireAt = parseImportTime(expireText);
        let cardType: string = normalizeImportCardType(cardTypeText);

        if (!cardType) {
          cardType = String(inferCardTypeFromExpire(activatedAt, expireAt) || (!activatedAt ? 'hour' : ''));
        }

        if (!cardType) {
          throw new Error(`第${lineNo}行缺少有效卡类型`);
        }

        if (activatedAt && expireAt && expireAt <= activatedAt) {
          throw new Error(`第${lineNo}行到期时间必须晚于激活时间`);
        }

        const finalExpireAt = expireAt ?? (activatedAt ? activatedAt + cardTypeExpireMs(cardType) : null);
        const status: CodeStatus = !activatedAt ? 'unused' : finalExpireAt && finalExpireAt < now ? 'expired' : 'in_use';
        const id = uuid();
        const createdAt = activatedAt || now;

        try {
          await conn.execute(
            `INSERT INTO ${table("register_codes")}
              (
                id, code, project_id, project_name, card_type,
                status, is_online, is_bound, machine_code, last_login_ip,
                last_login_at, activated_at, unbind_password, customer_info,
                remark, sale_type, expire_at, created_at
              )
              VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL, NULL, ?, NULL, NULL, NULL, 'author_generated', ?, ?)`,
            [
              id,
              code,
              project.id,
              project.name,
              cardType,
              status,
              activatedAt,
              finalExpireAt,
              createdAt,
            ]
          );
        } catch (err: any) {
          if (String(err?.code || '').includes('ER_DUP_ENTRY')) {
            throw new Error(`第${lineNo}行注册码已存在：${code}`);
          }
          throw err;
        }

        items.push({
          id,
          code,
          projectId: project.id,
          projectName: project.name,
          cardType,
          status,
          isOnline: false,
          isBound: false,
          activatedAt: activatedAt || undefined,
          expireAt: finalExpireAt || undefined,
          saleType: 'author_generated',
          createdAt,
        });
      }
    });
  } catch (err: any) {
    return respondError(res, err?.message || '导入失败', 400);
  }

  return respond(res, { imported: items.length, items });
});
router.get("/export", async (_req, res) => {
  await syncCodeExpireAndStatus(Date.now());
  const rows = await query(`SELECT * FROM ${table("register_codes")} ORDER BY created_at DESC`);
  return respond(res, { items: rows.map(mapCodeRow) });
});

router.get("/stats", async (_req, res) => {
  await syncCodeExpireAndStatus(Date.now());
  const rows = await query<{ status: string; c: number }>(
    `SELECT status, COUNT(*) as c FROM ${table("register_codes")} GROUP BY status`
  );
  const stats = { total: 0, inUse: 0, unused: 0, frozen: 0, expired: 0, deleted: 0 };
  for (const r of rows) {
    stats.total += Number((r as any).c || 0);
    switch ((r as any).status) {
      case "in_use":
        stats.inUse += Number((r as any).c || 0);
        break;
      case "unused":
        stats.unused += Number((r as any).c || 0);
        break;
      case "frozen":
        stats.frozen += Number((r as any).c || 0);
        break;
      case "expired":
        stats.expired += Number((r as any).c || 0);
        break;
      case "deleted":
        stats.deleted += Number((r as any).c || 0);
        break;
    }
  }
  return respond(res, stats);
});

router.delete("/cleanup-expired", async (_req, res) => {
  const now = Date.now();
  await syncCodeExpireAndStatus(now);
  await execute(
    `UPDATE ${table("register_codes")}
     SET status = 'deleted'
     WHERE status = 'expired' AND expire_at IS NOT NULL AND expire_at < ?`,
    [now]
  );
  return respond(res, {});
});

router.get("/", async (req, res) => {
  const {
    status,
    projectId,
    keyword,
    code,
    machineCode,
    cardType,
    isOnline,
    isBound,
    saleType,
    timeType,
    startTime,
    endTime,
    page = "1",
    pageSize = "10",
  } = req.query as Record<string, string>;

  const now = Date.now();
  await syncCodeExpireAndStatus(now);

  const where: string[] = [];
  const params: any[] = [];

  const kw = (keyword || code || "").trim();
  if (kw) {
    where.push("code LIKE ?");
    params.push(`%${kw}%`);
  }
  if (projectId) {
    where.push("project_id = ?");
    params.push(projectId);
  }
  if (machineCode) {
    where.push("machine_code LIKE ?");
    params.push(`%${machineCode}%`);
  }

  if (status) {
    const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length) {
      where.push(`status IN (${statuses.map(() => "?").join(",")})`);
      params.push(...statuses);
    }
  }

  if (cardType) {
    const types = cardType.split(",").map((s) => s.trim()).filter(Boolean);
    if (types.length) {
      where.push(`card_type IN (${types.map(() => "?").join(",")})`);
      params.push(...types);
    }
  }

  if (typeof isOnline !== "undefined" && isOnline !== "") {
    const online = isOnline === "true" || isOnline === "1";
    where.push("is_online = ?");
    params.push(online ? 1 : 0);
  }

  if (typeof isBound !== "undefined" && isBound !== "") {
    const bound = isBound === "true" || isBound === "1";
    where.push("is_bound = ?");
    params.push(bound ? 1 : 0);
  }

  if (saleType) {
    where.push("sale_type = ?");
    params.push(saleType);
  }

  const startTs = startTime ? Date.parse(startTime) : NaN;
  const endTs = endTime ? Date.parse(endTime) : NaN;
  if (!Number.isNaN(startTs) && !Number.isNaN(endTs) && timeType) {
    const col = timeType === "expired" ? "expire_at" : timeType === "lastLogin" ? "last_login_at" : "activated_at";
    where.push(`${col} IS NOT NULL AND ${col} BETWEEN ? AND ?`);
    params.push(startTs, endTs);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 10, 1), 200);
  const offset = (pageNum - 1) * size;

  const totalRow = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("register_codes")} ${whereSql}`, params);
  const rows = await query(`SELECT * FROM ${table("register_codes")} ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
    ...params,
    size,
    offset,
  ]);

  return respond(res, { total: totalRow?.c || 0, list: rows.map(mapCodeRow) });
});

const sqlPlaceholders = (count: number) => Array.from({ length: count }, () => "?").join(",");

const restoreCodeStatuses = async (ids: string[]) => {
  if (!ids.length) return;
  const now = Date.now();
  await execute(
    `UPDATE ${table("register_codes")}
     SET status = CASE
       WHEN activated_at IS NULL THEN 'unused'
       WHEN expire_at IS NOT NULL AND expire_at < ? THEN 'expired'
       ELSE 'in_use'
     END
     WHERE id IN (${sqlPlaceholders(ids.length)})`,
    [now, ...ids]
  );
};

const updateCodeStatus = async (ids: string[], status: CodeStatus) => {
  if (!ids.length) return;
  await execute(
    `UPDATE ${table("register_codes")} SET status = ? WHERE id IN (${sqlPlaceholders(ids.length)})`,
    [status, ...ids]
  );
};

router.patch("/:id/freeze", async (req, res) => {
  await updateCodeStatus([req.params.id], "frozen");
  return respond(res, {});
});

router.patch("/:id/unfreeze", async (req, res) => {
  await restoreCodeStatuses([req.params.id]);
  return respond(res, {});
});

router.patch("/:id/unbind", async (req, res) => {
  await execute(`UPDATE ${table("register_codes")} SET machine_code = NULL, is_bound = 0 WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.patch("/:id/renew", async (req, res) => {
  const addMs = getRenewDurationMs(req.body);
  if (addMs === 0) return respondError(res, "续费数量不能为 0", 400);
  const row = await queryOne<{ expire_at: number | null }>(`SELECT expire_at FROM ${table("register_codes")} WHERE id = ?`, [req.params.id]);
  const now = Date.now();
  const base = getRenewBaseTime(row?.expire_at, addMs, now);
  const expireAt = base + addMs;
  await execute(`UPDATE ${table("register_codes")} SET expire_at = ? WHERE id = ?`, [expireAt, req.params.id]);
  return respond(res, { expireAt });
});

router.patch("/:id/offline", async (req, res) => {
  await execute(`UPDATE ${table("register_codes")} SET is_online = 0 WHERE id = ?`, [req.params.id]);
  return respond(res, {});
});

router.post("/batch/freeze", async (req, res) => {
  await updateCodeStatus(Array.isArray(req.body?.ids) ? req.body.ids : [], "frozen");
  return respond(res, {});
});

router.post("/batch/unfreeze", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await restoreCodeStatuses(ids);
  return respond(res, {});
});

router.post("/batch/unbind", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length) {
    await execute(
      `UPDATE ${table("register_codes")} SET machine_code = NULL, is_bound = 0 WHERE id IN (${sqlPlaceholders(ids.length)})`,
      ids
    );
  }
  return respond(res, {});
});

router.post("/batch/renew", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const addMs = getRenewDurationMs(req.body);
  if (addMs === 0) return respondError(res, "续费数量不能为 0", 400);
  if (!ids.length) return respond(res, {});

  await withTransaction(async (conn) => {
    const now = Date.now();
    const rows = await conn.query(
      `SELECT id, expire_at FROM ${table("register_codes")} WHERE id IN (${sqlPlaceholders(ids.length)})`,
      ids
    );
    const list = (rows[0] as any[]) || [];
    for (const r of list) {
      const base = getRenewBaseTime(r.expire_at, addMs, now);
      await conn.execute(`UPDATE ${table("register_codes")} SET expire_at = ? WHERE id = ?`, [base + addMs, r.id]);
    }
  });

  return respond(res, { count: ids.length });
});

router.post("/batch/delete", async (req, res) => {
  await updateCodeStatus(Array.isArray(req.body?.ids) ? req.body.ids : [], "deleted");
  return respond(res, {});
});

router.post("/batch/recover", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await restoreCodeStatuses(ids);
  return respond(res, {});
});

router.post("/batch/project", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const projectId = req.body?.projectId;
  if (!ids.length || !projectId) return respond(res, {});
  const project = await queryOne<{ id: string; name: string }>(`SELECT id, name FROM ${table("projects")} WHERE id = ?`, [projectId]);
  if (!project) return respondError(res, "项目不存在", 400);
  await execute(
    `UPDATE ${table("register_codes")}
     SET project_id = ?, project_name = ?
     WHERE id IN (${sqlPlaceholders(ids.length)})`,
    [project.id, project.name, ...ids]
  );
  return respond(res, {});
});

const batchUpdateRemark = async (ids: string[], remark: any) => {
  if (!ids.length) return;
  await execute(
    `UPDATE ${table("register_codes")} SET remark = ? WHERE id IN (${sqlPlaceholders(ids.length)})`,
    [remark ?? null, ...ids]
  );
};

router.post("/batch/remark", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await batchUpdateRemark(ids, req.body?.remark);
  return respond(res, {});
});

// 兼容旧/文档接口：/api/codes/batch/update-remark
router.post("/batch/update-remark", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await batchUpdateRemark(ids, req.body?.remark);
  return respond(res, {});
});

router.post("/batch/unbind-password", async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const password = req.body?.password ?? "";
  if (ids.length) {
    await execute(
      `UPDATE ${table("register_codes")} SET unbind_password = ? WHERE id IN (${sqlPlaceholders(ids.length)})`,
      [password, ...ids]
    );
  }
  return respond(res, {});
});

router.post("/batch/blacklist-ip", (_req, res) => {
  return respond(res, {});
});

router.get("/:id", async (req, res) => {
  const row = await queryOne(`SELECT * FROM ${table("register_codes")} WHERE id = ?`, [req.params.id]);
  if (!row) return respondError(res, "未找到注册码", 404);
  return respond(res, mapCodeRow(row));
});

router.put("/:id", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("register_codes")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到注册码", 404);

  const body = req.body || {};
  let projectId: string | undefined;
  let projectName: string | undefined;
  if (body.projectId) {
    const proj = await queryOne<{ id: string; name: string }>(`SELECT id, name FROM ${table("projects")} WHERE id = ?`, [body.projectId]);
    if (!proj) return respondError(res, "项目不存在", 400);
    projectId = proj.id;
    projectName = proj.name;
  }

  await execute(
    `UPDATE ${table("register_codes")}
     SET project_id = COALESCE(?, project_id),
         project_name = COALESCE(?, project_name),
         card_type = COALESCE(?, card_type),
         status = COALESCE(?, status),
         is_online = COALESCE(?, is_online),
         is_bound = COALESCE(?, is_bound),
         machine_code = COALESCE(?, machine_code),
         unbind_password = COALESCE(?, unbind_password),
         customer_info = COALESCE(?, customer_info),
         remark = COALESCE(?, remark),
         expire_at = COALESCE(?, expire_at)
     WHERE id = ?`,
    [
      projectId ?? null,
      projectName ?? null,
      typeof body.cardType === "undefined" ? null : body.cardType,
      typeof body.status === "undefined" ? null : body.status,
      typeof body.isOnline === "undefined" ? null : body.isOnline ? 1 : 0,
      typeof body.isBound === "undefined" ? null : body.isBound ? 1 : 0,
      typeof body.machineCode === "undefined" ? null : body.machineCode,
      typeof body.unbindPassword === "undefined" ? null : body.unbindPassword,
      typeof body.customerInfo === "undefined" ? null : body.customerInfo,
      typeof body.remark === "undefined" ? null : body.remark,
      typeof body.expireAt === "undefined" ? null : body.expireAt,
      req.params.id,
    ]
  );
  return respond(res, {});
});

// 修改客户信息
router.patch("/:id/customer-info", async (req, res) => {
  const existing = await queryOne<{ id: string }>(`SELECT id FROM ${table("register_codes")} WHERE id = ?`, [req.params.id]);
  if (!existing) return respondError(res, "未找到注册码", 404);

  const customerInfo = typeof req.body?.customerInfo === "undefined" ? null : req.body.customerInfo;
  if (customerInfo !== null && typeof customerInfo !== "string") return respondError(res, "customerInfo 必须是字符串", 400);

  await execute(`UPDATE ${table("register_codes")} SET customer_info = ? WHERE id = ?`, [customerInfo, req.params.id]);
  return respond(res, {});
});

router.delete("/:id", async (req, res) => {
  await updateCodeStatus([req.params.id], "deleted");
  return respond(res, {});
});

export default router;
