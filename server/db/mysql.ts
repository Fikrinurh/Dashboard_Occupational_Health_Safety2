import mysql from 'mysql2/promise';
import { env } from '../config/env';

let pool: mysql.Pool | null = null;

export function isMysqlConfigured(): boolean {
  return Boolean(env.dbHost.trim() || env.cloudSqlConnectionName.trim());
}

export function getMysqlPool(): mysql.Pool {
  if (pool) return pool;

  const baseConfig: mysql.PoolOptions = {
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: env.dbConnectionLimit,
    queueLimit: 0,
    dateStrings: true,
  };

  if (env.cloudSqlConnectionName.trim()) {
    baseConfig.socketPath = `/cloudsql/${env.cloudSqlConnectionName.trim()}`;
  } else {
    baseConfig.host = env.dbHost;
    baseConfig.port = env.dbPort;
    if (env.dbSsl) {
      baseConfig.ssl = { rejectUnauthorized: false };
    }
  }

  pool = mysql.createPool(baseConfig);
  return pool;
}

export async function testMysqlConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isMysqlConfigured()) {
    return { ok: false, error: 'DB_HOST / CLOUD_SQL_CONNECTION_NAME not configured' };
  }
  try {
    const p = getMysqlPool();
    await p.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown MySQL error' };
  }
}
