import mysql, { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { devEnv, getEnvValue, rootEnv } from "../env";

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const MYSQL_CONFIG: MysqlConfig = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "dbs",
};

let pool: Pool | null = null;
let resolvedConfig: MysqlConfig | null = null;
let shouldCreateDatabase = false;

const normalizeConfig = (config: Partial<MysqlConfig>, fallback: MysqlConfig): MysqlConfig => ({
  host: config.host || fallback.host,
  port: Number(config.port || fallback.port),
  user: config.user || fallback.user,
  password: typeof config.password === "string" ? config.password : fallback.password,
  database: config.database || fallback.database,
});

const explicitConfig = (): MysqlConfig | null => {
  const host = getEnvValue("VERIFYSYS_MYSQL_HOST", "DB_HOST");
  const database = getEnvValue("VERIFYSYS_MYSQL_DB", "DB_NAME");
  const user = getEnvValue("VERIFYSYS_MYSQL_USER", "DB_USER");
  if (!host || !database || !user) return null;

  return normalizeConfig(
    {
      host,
      port: Number(getEnvValue("VERIFYSYS_MYSQL_PORT", "DB_PORT") || 3306),
      user,
      password: getEnvValue("VERIFYSYS_MYSQL_PASSWORD", "DB_PASSWORD") || "",
      database,
    },
    MYSQL_CONFIG
  );
};

const rootEnvConfig = (): MysqlConfig | null => {
  if (!rootEnv.DB_HOST || !rootEnv.DB_NAME || !rootEnv.DB_USER) return null;
  return normalizeConfig(
    {
      host: rootEnv.DB_HOST,
      port: Number(rootEnv.DB_PORT || 3306),
      user: rootEnv.DB_USER,
      password: rootEnv.DB_PASSWORD || "",
      database: rootEnv.DB_NAME,
    },
    MYSQL_CONFIG
  );
};

const devEnvConfig = (): MysqlConfig => {
  return normalizeConfig(
    {
      host: devEnv.DB_HOST || "127.0.0.1",
      port: Number(devEnv.DB_PORT || 3306),
      user: devEnv.DB_USER || "root",
      password: devEnv.DB_PASSWORD || "",
      database: devEnv.DB_NAME || "dbs",
    },
    MYSQL_CONFIG
  );
};

const configKey = (config: MysqlConfig) =>
  `${config.host}:${config.port}/${config.database}|${config.user}|${config.password}`;

const getConfigCandidates = () => {
  const fallback = devEnvConfig();
  const preferDev = process.env.NODE_ENV !== "production";
  const ordered = preferDev
    ? [explicitConfig(), fallback, rootEnvConfig(), MYSQL_CONFIG]
    : [explicitConfig(), rootEnvConfig(), fallback, MYSQL_CONFIG];

  const candidates = [
    ...ordered,
  ].filter((item): item is MysqlConfig => Boolean(item));

  const unique = new Map<string, MysqlConfig>();
  for (const candidate of candidates) {
    unique.set(configKey(candidate), candidate);
  }
  return [...unique.values()];
};

const applyResolvedConfig = (config: MysqlConfig) => {
  MYSQL_CONFIG.host = config.host;
  MYSQL_CONFIG.port = config.port;
  MYSQL_CONFIG.user = config.user;
  MYSQL_CONFIG.password = config.password;
  MYSQL_CONFIG.database = config.database;
  resolvedConfig = config;
};

const canReachMysql = async (config: MysqlConfig) => {
  try {
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 3000,
      charset: "utf8mb4",
    });
    await conn.end();
    return { ok: true as const, needsCreate: false };
  } catch (err: any) {
    if (err?.code === "ER_BAD_DB_ERROR") {
      try {
        const conn = await mysql.createConnection({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          connectTimeout: 3000,
          charset: "utf8mb4",
        });
        await conn.end();
        return { ok: true as const, needsCreate: true };
      } catch (innerErr) {
        return { ok: false as const, error: innerErr };
      }
    }
    return { ok: false as const, error: err };
  }
};

const resolveMysqlConfig = async () => {
  if (resolvedConfig) return resolvedConfig;

  const errors: string[] = [];
  for (const candidate of getConfigCandidates()) {
    const result = await canReachMysql(candidate);
    if (result.ok) {
      applyResolvedConfig(candidate);
      shouldCreateDatabase = result.needsCreate;
      return candidate;
    }

    const code = result.error?.code || "UNKNOWN";
    errors.push(`${candidate.user}@${candidate.host}:${candidate.port}/${candidate.database} => ${code}`);
  }

  throw new Error(`无法连接任何 MySQL 配置。已尝试：${errors.join("; ")}`);
};

export const getPool = async (): Promise<Pool> => {
  if (pool) return pool;
  const config = await resolveMysqlConfig();
  await ensureDatabase();
  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    decimalNumbers: true,
  });
  return pool;
};

export const ensureDatabase = async () => {
  const config = await resolveMysqlConfig();
  if (!shouldCreateDatabase) return;

  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    shouldCreateDatabase = false;
  } finally {
    await connection.end();
  }
};

export const query = async <T extends Record<string, any> = any>(sql: string, params: any[] = []) => {
  const p = await getPool();
  const [rows] = await p.query(sql, params);
  return rows as T[];
};

export const queryOne = async <T extends Record<string, any> = any>(sql: string, params: any[] = []) => {
  const rows = await query<T>(sql, params);
  return rows[0];
};

export const execute = async (sql: string, params: any[] = []) => {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result as ResultSetHeader;
};

export const withTransaction = async <T>(fn: (conn: PoolConnection) => Promise<T>) => {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const value = await fn(conn);
    await conn.commit();
    return value;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
