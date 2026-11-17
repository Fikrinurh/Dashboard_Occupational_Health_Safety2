import type { SystemStatus } from '../../src/shared/types';
import { DemoStoreRepository } from './demoStore';
import { isMysqlConfigured, testMysqlConnection } from './mysql';
import { MysqlRepository } from './mysqlRepository';
import type { OhsRepository } from './types';

let activeRepo: OhsRepository | null = null;
let systemStatus: SystemStatus = {
  mode: 'DEMO_STORE',
  mysqlConfigured: false,
  mysqlConnected: false,
  message: 'Initializing database adapter...',
};

export async function initializeDatabaseAdapter(): Promise<OhsRepository> {
  const configured = isMysqlConfigured();
  if (configured) {
    const check = await testMysqlConnection();
    if (check.ok) {
      activeRepo = new MysqlRepository();
      systemStatus = {
        mode: 'MYSQL',
        mysqlConfigured: true,
        mysqlConnected: true,
        message: 'Connected to MySQL database pool.',
      };
      return activeRepo;
    }
    activeRepo = new DemoStoreRepository();
    systemStatus = {
      mode: 'DEMO_STORE',
      mysqlConfigured: true,
      mysqlConnected: false,
      message: `MySQL configured but unreachable (${check.error}). Running in isolated Demo Store mode.`,
    };
    return activeRepo;
  }

  activeRepo = new DemoStoreRepository();
  systemStatus = {
    mode: 'DEMO_STORE',
    mysqlConfigured: false,
    mysqlConnected: false,
    message: 'MySQL credentials not configured in environment. Running with deterministic Demo Store.',
  };
  return activeRepo;
}

export function getRepository(): OhsRepository {
  if (!activeRepo) {
    activeRepo = new DemoStoreRepository();
  }
  return activeRepo;
}

export function getSystemStatus(): SystemStatus {
  return systemStatus;
}
