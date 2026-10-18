import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type ElectronApplication, type Page, _electron } from 'playwright';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import '../support/context.js';
import { mapCenterColor, sameColor } from '../support/mapCanvas.js';
import { BLUE, RED } from '../support/seededData.js';

describe('zinc-electron', () => {
  let configHome: string;
  let app: ElectronApplication;
  let page: Page;

  beforeAll(async () => {
    // Own userData (IndexedDB, single-instance lock), apart from a running app.
    configHome = mkdtempSync(join(tmpdir(), 'zinc-ui-e2e-config-'));
    // VS Code terminals set ELECTRON_RUN_AS_NODE, which would run main.cjs as plain Node.
    const env = { ...process.env };
    delete env['ELECTRON_RUN_AS_NODE'];
    app = await _electron.launch({
      executablePath: inject('electronPath'),
      args: [inject('electronApp')],
      env: {
        ...env,
        ZINC_DATA_DIR: inject('dataDir'),
        XDG_CONFIG_HOME: configHome,
      },
    });
    page = await app.firstWindow();
  });

  afterAll(async () => {
    await app?.close();
    rmSync(configHome, { recursive: true, force: true });
  });

  it('loads the UI from the zinc:// app protocol', async () => {
    expect(page.url()).toBe('zinc://app/index.html');
    expect(await page.title()).toBe('Zinc');
  });

  it('keeps the renderer sandboxed', async () => {
    expect(
      await page.evaluate(() => ({
        require: typeof (window as { require?: unknown }).require,
        process: typeof (window as { process?: unknown }).process,
        zincHost: Object.keys(window.zincHost ?? {}),
      })),
    ).toEqual({
      require: 'undefined',
      process: 'undefined',
      zincHost: ['connectBackend'],
    });
  });

  it('renders the first map with tiles the main process serves', async () => {
    await expect
      .poll(() => mapCenterColor(page), { timeout: 30_000 })
      .toSatisfy((color) => sameColor(color, RED));
  });

  it('switches to the next map with the Switch map button', async () => {
    const cycle = page.locator('[data-action="cycle-map"]');
    await expect.poll(() => cycle.getAttribute('disabled')).toBeNull();
    await cycle.click();

    await expect
      .poll(() => mapCenterColor(page), { timeout: 30_000 })
      .toSatisfy((color) => sameColor(color, BLUE));
  });

  it('quits cleanly, stopping the backend first', async () => {
    const exited = new Promise<number | null>((resolve) =>
      app.process().once('exit', (code) => resolve(code)),
    );
    await app.close();
    expect(await exited).toBe(0);
  });
});

declare global {
  interface Window {
    zincHost?: { connectBackend(): void };
  }
}
