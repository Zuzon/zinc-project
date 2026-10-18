import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The zinc-web build (`apps/zinc-web/dist`) to serve at `/`, from
 * `ZINC_WEB_DIR`; `undefined` when unset, e.g. behind browser-shell.
 */
export function webDir(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const dir = env['ZINC_WEB_DIR'];
  if (!dir) {
    return undefined;
  }
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`ZINC_WEB_DIR ${dir} has no index.html`);
  }
  return dir;
}
