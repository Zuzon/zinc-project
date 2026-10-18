// Runs the staged app in Electron; extra arguments are passed through.
// VS Code terminals inherit ELECTRON_RUN_AS_NODE=1 from the extension host,
// which would start Electron as plain Node, so it is dropped here.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const electron = createRequire(import.meta.url)('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(
  electron,
  [join(import.meta.dirname, '../dist/app'), ...process.argv.slice(2)],
  { stdio: ['inherit', 'inherit', 'pipe'], env },
);

let sandboxFailed = false;
child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
  sandboxFailed ||= chunk.toString().includes('SUID sandbox helper binary');
});

child.on('exit', (code, signal) => {
  if (sandboxFailed) {
    console.error(
      '\nChromium could not start its sandbox: this system (e.g. Ubuntu 23.10+) blocks\n' +
        'unprivileged user namespaces. Allow them for the dev Electron once with:\n\n' +
        '  sh apps/zinc-electron/scripts/setup-apparmor.sh\n',
    );
  }
  process.exitCode = code ?? (signal ? 1 : 0);
});
