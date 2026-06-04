import { createDeveloperCodeCandidate, hashPassword } from "../utils";
import { LEGACY_ROLE_OPS, ROLE_ADMIN, ROLE_DEVELOPER, SYSTEM_ROLE_DEFINITIONS } from "../constants/roles";
import { execute, query, queryOne } from "./mysql";
import { TABLE_PREFIX, table } from "./tables";

export const initDb = async () => {
  await migratePrefixIfNeeded();
  await createTables();
  await ensureColumns();
  await ensureProjectNumbers();
  await ensureUserDeveloperCodes();
  await ensureProductCreatorUserIds();
  await ensureIndexes();
  await ensureSystemRoles();
  await seedIfEmpty();
};

const migratePrefixIfNeeded = async () => {
  const oldPrefix: string = "vs_";
  if (oldPrefix === TABLE_PREFIX) return;

  const oldUsers = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [`${oldPrefix}users`]
  );
  const newUsers = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [`${TABLE_PREFIX}users`]
  );
  if ((oldUsers?.c || 0) === 0 || (newUsers?.c || 0) > 0) return;

  const names = [
    "users",
    "roles",
    "user_roles",
    "projects",
    "register_codes",
    "custom_data",
    "security_policies",
    "products",
    "orders",
    "withdrawals",
    "notifications",
    "logs",
    "system_config",
  ];

  const renames: string[] = [];
  for (const name of names) {
    const oldExists = await queryOne<{ c: number }>(
      `SELECT COUNT(*) as c
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [`${oldPrefix}${name}`]
    );
    if ((oldExists?.c || 0) === 0) continue;

    const newExists = await queryOne<{ c: number }>(
      `SELECT COUNT(*) as c
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [`${TABLE_PREFIX}${name}`]
    );
    if ((newExists?.c || 0) > 0) continue;

    renames.push(`\`${oldPrefix}${name}\` TO \`${TABLE_PREFIX}${name}\``);
  }

  if (renames.length) {
    await execute(`RENAME TABLE ${renames.join(", ")}`);
  }
};

const createTables = async () => {
  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("users")} (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      developer_code VARCHAR(16) NULL,
      password_hash VARCHAR(128) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      email VARCHAR(128) NULL,
      phone VARCHAR(32) NULL,
      department_id VARCHAR(64) NULL,
      remark VARCHAR(255) NULL,
      avatar VARCHAR(255) NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("roles")} (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      description VARCHAR(255) NULL,
      permissions JSON NOT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("user_roles")} (
      user_id VARCHAR(64) NOT NULL,
      role_id VARCHAR(64) NOT NULL,
      PRIMARY KEY (user_id, role_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("email_codes")} (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(128) NOT NULL,
      code VARCHAR(16) NOT NULL,
      purpose VARCHAR(16) NOT NULL,
      expire_at BIGINT NOT NULL,
      used_at BIGINT NULL,
      created_at BIGINT NOT NULL,
      INDEX idx_email_purpose_created (email, purpose, created_at),
      INDEX idx_expire_at (expire_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("projects")} (
      id VARCHAR(64) PRIMARY KEY,
      project_no BIGINT NULL,
      name VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255) NULL,
      config JSON NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("register_codes")} (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(32) NOT NULL UNIQUE,
      project_id VARCHAR(64) NOT NULL,
      project_name VARCHAR(64) NOT NULL,
      card_type VARCHAR(32) NOT NULL,
      status VARCHAR(16) NOT NULL,
      is_online TINYINT NOT NULL DEFAULT 0,
      is_bound TINYINT NOT NULL DEFAULT 0,
      sale_type VARCHAR(32) NULL,
      machine_code VARCHAR(128) NULL,
      last_login_ip VARCHAR(64) NULL,
      last_login_at BIGINT NULL,
      activated_at BIGINT NULL,
      unbind_password VARCHAR(64) NULL,
      customer_info VARCHAR(255) NULL,
      remark VARCHAR(255) NULL,
      expire_at BIGINT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("custom_data")} (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      \`key\` VARCHAR(64) NOT NULL,
      \`value\` TEXT NOT NULL,
      remark VARCHAR(255) NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("security_policies")} (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      name VARCHAR(64) NOT NULL,
      mode VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL,
      config JSON NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("products")} (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      creator_user_id VARCHAR(64) NULL,
      name VARCHAR(128) NOT NULL,
      summary VARCHAR(255) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'published',
      cover_url VARCHAR(255) NULL,
      allow_anonymous TINYINT NOT NULL DEFAULT 1,
      addon_mode TINYINT NOT NULL DEFAULT 0,
      min_buy INT NOT NULL DEFAULT 1,
      max_buy INT NOT NULL DEFAULT 5,
      variants JSON NOT NULL,
      description TEXT NULL,
      link_code VARCHAR(64) NOT NULL UNIQUE,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("orders")} (
      id VARCHAR(64) PRIMARY KEY,
      product_id VARCHAR(64) NOT NULL,
      creator_user_id VARCHAR(64) NULL,
      buyer VARCHAR(128) NOT NULL,
      buyer_email VARCHAR(128) NULL,
      mock_pay_token VARCHAR(64) NULL,
      variant_id VARCHAR(64) NULL,
      variant_label VARCHAR(128) NULL,
      quantity INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      verify_code VARCHAR(16) NULL,
      delivery_payload JSON NULL,
      status VARCHAR(16) NOT NULL,
      settlement_status VARCHAR(16) NOT NULL DEFAULT 'unsettled',
      settle_at BIGINT NULL,
      paid_at BIGINT NULL,
      delivered_at BIGINT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("withdrawals")} (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'processing',
      bank_account VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      completed_at BIGINT NULL,
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("notifications")} (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(128) NOT NULL,
      content TEXT NOT NULL,
      category VARCHAR(16) NOT NULL,
      is_read TINYINT NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("logs")} (
      id VARCHAR(64) PRIMARY KEY,
      log_type VARCHAR(16) NOT NULL,
      action VARCHAR(128) NULL,
      user VARCHAR(64) NULL,
      status VARCHAR(32) NULL,
      ip VARCHAR(64) NULL,
      message TEXT NULL,
      stack TEXT NULL,
      created_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );

  await execute(
    `CREATE TABLE IF NOT EXISTS ${table("system_config")} (
      id INT PRIMARY KEY,
      config JSON NOT NULL,
      updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  );
};

const ensureColumns = async () => {
  await ensureColumn("register_codes", "sale_type", "VARCHAR(32) NULL");
  await ensureColumn("register_codes", "customer_info", "VARCHAR(255) NULL");
  await ensureColumn("custom_data", "remark", "VARCHAR(255) NULL");
  await ensureColumn("security_policies", "config", "JSON NULL");
  await ensureColumn("security_policies", "updated_at", "BIGINT NULL");
  await ensureColumn("projects", "project_no", "BIGINT NULL");
  await ensureColumn("orders", "buyer_email", "VARCHAR(128) NULL");
  await ensureColumn("orders", "mock_pay_token", "VARCHAR(64) NULL");
  await ensureColumn("orders", "variant_id", "VARCHAR(64) NULL");
  await ensureColumn("orders", "variant_label", "VARCHAR(128) NULL");
  await ensureColumn("orders", "verify_code", "VARCHAR(16) NULL");
  await ensureColumn("orders", "delivery_payload", "JSON NULL");
  await ensureColumn("orders", "creator_user_id", "VARCHAR(64) NULL");
  await ensureColumn("orders", "settlement_status", "VARCHAR(16) NOT NULL DEFAULT 'unsettled'");
  await ensureColumn("orders", "settle_at", "BIGINT NULL");
  await ensureColumn("orders", "paid_at", "BIGINT NULL");
  await ensureColumn("orders", "delivered_at", "BIGINT NULL");
  await ensureColumn("products", "creator_user_id", "VARCHAR(64) NULL");
  await ensureColumn("products", "status", "VARCHAR(16) NOT NULL DEFAULT 'published'");
  await ensureColumn("products", "cover_url", "VARCHAR(255) NULL");
  await ensureColumn("products", "addon_mode", "TINYINT NOT NULL DEFAULT 0");
  await ensureColumn("users", "developer_code", "VARCHAR(16) NULL");
};

const ensureColumn = async (tableName: string, column: string, ddl: string) => {
  const tableNameWithPrefix = `${TABLE_PREFIX}${tableName}`;
  const row = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableNameWithPrefix, column]
  );
  if ((row?.c || 0) > 0) return;
  await execute(`ALTER TABLE ${table(tableName)} ADD COLUMN ${column} ${ddl}`);
};

const ensureProjectNumbers = async () => {
  const maxRow = await queryOne<{ n: number }>(`SELECT COALESCE(MAX(project_no), 0) as n FROM ${table("projects")}`);
  let nextNo = Number(maxRow?.n || 0) + 1;

  const rows = await query<{ id: string }>(
    `SELECT id FROM ${table("projects")} WHERE project_no IS NULL OR project_no = 0 ORDER BY created_at ASC, id ASC`
  );

  for (const row of rows) {
    await execute(`UPDATE ${table("projects")} SET project_no = ? WHERE id = ?`, [nextNo, row.id]);
    nextNo += 1;
  }
};

const generateUniqueDeveloperCode = async () => {
  for (let i = 0; i < 16; i += 1) {
    const code = createDeveloperCodeCandidate(6);
    const exists = await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE developer_code = ?`, [code]);
    if (!exists) return code;
  }
  throw new Error("生成开发者短码失败");
};

const ensureUserDeveloperCodes = async () => {
  const rows = await query<{ id: string }>(
    `SELECT id FROM ${table("users")} WHERE developer_code IS NULL OR developer_code = '' ORDER BY created_at ASC, id ASC`
  );

  for (const row of rows) {
    const code = await generateUniqueDeveloperCode();
    await execute(`UPDATE ${table("users")} SET developer_code = ? WHERE id = ?`, [code, row.id]);
  }
};

const ensureProductCreatorUserIds = async () => {
  const owner =
    (await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} WHERE username = 'admin' LIMIT 1`)) ||
    (await queryOne<{ id: string }>(`SELECT id FROM ${table("users")} ORDER BY created_at ASC, id ASC LIMIT 1`));
  if (!owner?.id) return;

  await execute(`UPDATE ${table("products")} SET creator_user_id = ? WHERE creator_user_id IS NULL OR creator_user_id = ''`, [
    owner.id,
  ]);
};

const ensureIndexes = async () => {
  // 一个项目只能有一条安全策略
  await ensureUniqueIndexIfNoDuplicates("security_policies", "uniq_project_id", ["project_id"]);
  await ensureUniqueIndexIfNoDuplicates("projects", "uniq_project_no", ["project_no"]);
  await ensureUniqueIndexIfNoDuplicates("users", "uniq_developer_code", ["developer_code"]);
};

const ensureUniqueIndexIfNoDuplicates = async (tableName: string, indexName: string, columns: string[]) => {
  const tableNameWithPrefix = `${TABLE_PREFIX}${tableName}`;

  const indexRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableNameWithPrefix, indexName]
  );
  if ((indexRow?.c || 0) > 0) return;

  const notNullWhere = columns.map((column) => `${column} IS NOT NULL`).join(', ').replace(/, /g, ' AND ');
  const groupBy = columns.join(', ');
  const dupRow = await queryOne<{ c: number }>(
    `SELECT COUNT(*) as c FROM (
      SELECT ${groupBy}
      FROM ${table(tableName)}
      ${notNullWhere ? `WHERE ${notNullWhere}` : ""}
      GROUP BY ${groupBy}
      HAVING COUNT(*) > 1
    ) t`
  );
  if ((dupRow?.c || 0) > 0) return;

  const cols = columns.map((c) => `\`${c}\``).join(', ');
  await execute(`ALTER TABLE ${table(tableName)} ADD UNIQUE INDEX ${indexName} (${cols})`);
};

const ensureSystemRoles = async () => {
  const now = Date.now();
  for (const role of SYSTEM_ROLE_DEFINITIONS) {
    await execute(
      `INSERT INTO ${table("roles")} (id, name, description, permissions, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         permissions = VALUES(permissions)`,
      [role.id, role.name, role.description, JSON.stringify(role.permissions), now]
    );
  }

  await execute(
    `INSERT IGNORE INTO ${table("user_roles")} (user_id, role_id)
     SELECT user_id, ? FROM ${table("user_roles")} WHERE role_id = ?`,
    [ROLE_DEVELOPER, LEGACY_ROLE_OPS]
  );
  await execute(`DELETE FROM ${table("user_roles")} WHERE role_id = ?`, [LEGACY_ROLE_OPS]);
  await execute(`DELETE FROM ${table("roles")} WHERE id = ?`, [LEGACY_ROLE_OPS]);
};

const seedIfEmpty = async () => {
  const existing = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("users")}`);
  if ((existing?.c || 0) > 0) return;

  const now = Date.now();

  await execute(
    `INSERT INTO ${table("users")} (id, username, developer_code, password_hash, status, email, phone, department_id, remark, avatar, created_at, updated_at)
     VALUES ('u-admin','admin',? ,?,'active','admin@example.com','18800000000',NULL,'系统管理员',NULL,?,?)`,
    [createDeveloperCodeCandidate(6), hashPassword("admin123"), now, now]
  );

  await execute(`INSERT INTO ${table("user_roles")} (user_id, role_id) VALUES ('u-admin', ?)`, [ROLE_ADMIN]);

  await execute(
    `INSERT INTO ${table("projects")} (id, project_no, name, description, config, created_at, updated_at)
     VALUES ('p-1', 1, '默认项目','演示用例',?, ?, ?)`,
    [JSON.stringify({ theme: "light" }), now, now]
  );

  await execute(
    `INSERT INTO ${table("notifications")} (id, title, content, category, is_read, created_at) VALUES
      ('n-1','欢迎使用','系统已初始化完毕。','system',0,?),
      ('n-2','待办事项','请完善项目配置。','todo',0,?)
    `,
    [now, now]
  );

  await execute(
    `INSERT INTO ${table("system_config")} (id, config, updated_at) VALUES (1, ?, ?)`,
    [JSON.stringify({ siteName: "VerifySys 控制台", logo: "/uploads/logo.png", uploadLimitMb: 5, mail: { host: "smtp.example.com", port: 465 }, params: { locale: "zh-CN" } }), now]
  );
};
