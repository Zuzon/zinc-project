import { spawn } from 'node:child_process';
import { type AddressInfo, connect, createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { workspaceRoot } from '@nx/devkit';
import type { TestProject } from 'vitest/node';
import '../support/context.js';
import { createSeededData } from '../support/seededData.js';

const HOST = '127.0.0.1';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, HOST, () => {
      const { port } = srv.address() as AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForPortOpen(port: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = connect(port, HOST);
      socket.once('connect', () => (socket.end(), resolve(true)));
      socket.once('error', () => (socket.destroy(), resolve(false)));
    });
    if (open) return;
    await sleep(100);
  }
  throw new Error(`zinc-server did not open ${HOST}:${port} in ${timeoutMs}ms`);
}

/** Runs the built zinc-server serving the built zinc-web, on seeded data. */
export default async function setup(project: TestProject) {
  const data = await createSeededData();
  const port = await freePort();
  const server = spawn(
    process.execPath,
    [join(workspaceRoot, 'apps/zinc-server/dist/src/main.js')],
    {
      env: {
        ...process.env,
        HOST,
        PORT: String(port),
        ZINC_DATA_DIR: data.dataDir,
        ZINC_WEB_DIR: join(workspaceRoot, 'apps/zinc-web/dist'),
      },
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  const exited = new Promise<void>((resolve) =>
    server.once('exit', () => resolve()),
  );
  await Promise.race([
    waitForPortOpen(port),
    exited.then(() => {
      throw new Error(`zinc-server exited early (code ${server.exitCode})`);
    }),
  ]);

  project.provide('baseUrl', `http://${HOST}:${port}`);
  project.provide('dataDir', data.dataDir);

  return async () => {
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM');
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
      await exited;
      clearTimeout(timer);
    }
    await data.dispose();
  };
}
