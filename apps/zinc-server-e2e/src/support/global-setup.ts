import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { connect, createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { workspaceRoot } from '@nx/devkit';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    /** The server's ZINC_DATA_DIR. */
    dataDir: string;
  }
}

// Ask the OS for a free port so e2e never collides with a running dev server.
function freePort(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, host, () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForPortOpen(port: number, host: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect(port, host);
      socket.once('connect', () => (socket.end(), resolve(true)));
      socket.once('error', () => (socket.destroy(), resolve(false)));
    });
    if (open) return;
    await sleep(100);
  }
  throw new Error(`zinc-server did not open ${host}:${port} in ${timeoutMs}ms`);
}

export default async function setup(project: TestProject) {
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT
    ? Number(process.env.PORT)
    : await freePort(host);

  // Run the built server directly (e2e depends on zinc-server:build), so this
  // process owns it and teardown can stop it. No watch mode, no restarts.
  const main = join(workspaceRoot, 'apps/zinc-server/dist/src/main.js');
  // A fresh data dir per run, so map databases never leak between runs.
  const dataDir = mkdtempSync(join(tmpdir(), 'zinc-e2e-'));
  const server = spawn(process.execPath, [main], {
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      ZINC_DATA_DIR: dataDir,
    },
    stdio: 'inherit',
  });
  const exited = new Promise<void>((resolve) =>
    server.once('exit', () => resolve()),
  );

  await Promise.race([
    waitForPortOpen(port, host),
    exited.then(() => {
      throw new Error(`zinc-server exited early (code ${server.exitCode})`);
    }),
  ]);

  project.provide('baseUrl', `http://${host}:${port}`);
  project.provide('dataDir', dataDir);

  return async () => {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    rmSync(dataDir, { recursive: true, force: true });
  };
}
