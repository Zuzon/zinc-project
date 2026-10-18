// Embedded Node entry on Android: started by ZincBackendPlugin through libnode.
import { join } from 'node:path';
import { startBackend } from './backend.js';
import { readBackendEnv } from './env.js';

const backend = startBackend(
  readBackendEnv(),
  join(__dirname, 'db-worker.cjs'),
);

// Android usually just kills the process; on a desktop test run, stop cleanly.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void backend
      .destroy()
      .catch((err) => console.error('[main] backend shutdown failed', err))
      .finally(() => process.exit());
  });
}
