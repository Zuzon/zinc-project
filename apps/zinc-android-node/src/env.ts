/**
 * Startup settings the Android host (`ZincBackendPlugin`) passes to the
 * embedded Node runtime as environment variables.
 */
export interface BackendEnv {
  /** App-private data directory (maps, later tracks and routes). */
  dataDir: string;
  /** Loopback port the backend is reachable on. */
  port: number;
  /**
   * Already listening loopback socket the host opened on `port`, so no other
   * process can take the port between choosing and binding it.
   */
  listenFd?: number;
  /** Per-launch secret every WebSocket and tile request must carry. */
  token: string;
  /** better-sqlite3 addon shipped among the APK's native libraries. */
  sqliteBinding?: string;
}

export function readBackendEnv(
  env: NodeJS.ProcessEnv = process.env,
): BackendEnv {
  const dataDir = required(env, 'ZINC_DATA_DIR');
  const token = required(env, 'ZINC_TOKEN');
  const port = integer(env, 'ZINC_PORT');
  if (port === undefined || port <= 0 || port > 65535) {
    throw new Error('ZINC_PORT must be a TCP port');
  }
  return {
    dataDir,
    port,
    listenFd: integer(env, 'ZINC_LISTEN_FD'),
    token,
    sqliteBinding: env['ZINC_SQLITE_BINDING'] || undefined,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function integer(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const value = env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return Number(value);
}
