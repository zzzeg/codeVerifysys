import { hashPassword } from "../utils";
import { execute, queryOne } from "./mysql";
import { TABLE_PREFIX, table } from "./tables";

export const initDb = async () => {
  await migratePrefixIfNeeded();
  await createTables();
  await ensureColumns();
  await ensureIndexes();
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
      name VARCHAR(128) NOT NULL,
      summary VARCHAR(255) NULL,
      allow_anonymous TINYINT NOT NULL DEFAULT 1,
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
      buyer VARCHAR(128) NOT NULL,
      quantity INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(16) NOT NULL,
      created_at BIGINT NOT NULL
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

const ensureIndexes = async () => {
  // 一个项目只能有一条安全策略
  await ensureUniqueIndexIfNoDuplicates("security_policies", "uniq_project_id", ["project_id"]);
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

  // 若存在重复 project_id，跳过创建（避免启动时报错）；接口层仍会阻止新增/改到重复项目
  if (tableName === "security_policies") {
    const dupRow = await queryOne<{ c: number }>(
      `SELECT COUNT(*) as c FROM (
        SELECT project_id
        FROM ${table("security_policies")}
        GROUP BY project_id
        HAVING COUNT(*) > 1
      ) t`
    );
    if ((dupRow?.c || 0) > 0) return;
  }

  const cols = columns.map((c) => `\`${c}\``).join(", ");
  await execute(`ALTER TABLE ${table(tableName)} ADD UNIQUE INDEX ${indexName} (${cols})`);
};

const seedIfEmpty = async () => {
  const existing = await queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${table("users")}`);
  if ((existing?.c || 0) > 0) return;

  const now = Date.now();

  await execute(
    `INSERT INTO ${table("roles")} (id, name, description, permissions, created_at) VALUES
      ('role-admin','管理员','系统管理员',?,?),
      ('role-ops','运营','运营与客服',?,?)
    `,
    [JSON.stringify(["*"]), now, JSON.stringify(["dashboard", "users", "codes", "projects", "products"]), now]
  );

  await execute(
    `INSERT INTO ${table("users")} (id, username, password_hash, status, email, phone, department_id, remark, avatar, created_at, updated_at)
     VALUES ('u-admin','admin',?,'active','admin@example.com','18800000000',NULL,'系统管理员',NULL,?,?)`,
    [hashPassword("admin123"), now, now]
  );

  await execute(`INSERT INTO ${table("user_roles")} (user_id, role_id) VALUES ('u-admin','role-admin')`);

  await execute(
    `INSERT INTO ${table("projects")} (id, name, description, config, created_at, updated_at)
     VALUES ('p-1','默认项目','演示用例',?, ?, ?)`,
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
