import { homedir } from 'node:os';
import { join } from 'node:path';

/** Per-user data directory; `ZINC_DATA_DIR` overrides it. */
export function appDataDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (env['ZINC_DATA_DIR']) {
    return env['ZINC_DATA_DIR'];
  }
  if (platform === 'win32') {
    return join(
      env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'),
      'zinc',
    );
  }
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'zinc');
  }
  return join(
    env['XDG_DATA_HOME'] ?? join(homedir(), '.local', 'share'),
    'zinc',
  );
}
