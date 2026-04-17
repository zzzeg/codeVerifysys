import mysql, { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export const MYSQL_CONFIG: MysqlConfig = {
  host: process.env.VERIFYSYS_MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.VERIFYSYS_MYSQL_PORT || 3306),
  user: process.env.VERIFYSYS_MYSQL_USER || "root",
  password: process.env.VERIFYSYS_MYSQL_PASSWORD || "",
  database: process.env.VERIFYSYS_MYSQL_DB || "dbs",
};

let pool: Pool | null = null;

export const getPool = async (): Promise<Pool> => {
  if (pool) return pool;
  await ensureDatabase();
  pool = mysql.createPool({
    ...MYSQL_CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    decimalNumbers: true,
  });
  return pool;
};

export const ensureDatabase = async () => {
  const connection = await mysql.createConnection({
    host: MYSQL_CONFIG.host,
    port: MYSQL_CONFIG.port,
    user: MYSQL_CONFIG.user,
    password: MYSQL_CONFIG.password,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${MYSQL_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
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
