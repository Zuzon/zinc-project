import {
  type Browser,
  type BrowserContext,
  type Page,
  chromium,
} from 'playwright';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from 'vitest';
import '../support/context.js';
import { mapCenterColor, sameColor } from '../support/mapCanvas.js';
import { BLUE, MAP_IDS, RED } from '../support/seededData.js';

const tilesOf = (mapId: string) => new RegExp(`/api/maps/${mapId}/tiles/`);

describe('zinc-web served by zinc-server', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let pageErrors: Error[];

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    // A fresh context per test: no IndexedDB view state carries over.
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
  });

  afterEach(async () => {
    await context?.close();
  });

  it('renders the first map with tiles the backend serves', async () => {
    const tile = page.waitForResponse((res) =>
      tilesOf(MAP_IDS.red).test(res.url()),
    );

    await page.goto(inject('baseUrl'));

    expect(await page.title()).toBe('Zinc');
    expect((await tile).status()).toBe(200);
    await expect
      .poll(() => mapCenterColor(page), { timeout: 30_000 })
      .toSatisfy((color) => sameColor(color, RED));
    expect(pageErrors).toEqual([]);
  });

  it('switches to the next map with the Switch map button', async () => {
    await page.goto(inject('baseUrl'));
    await expect
      .poll(() => mapCenterColor(page), { timeout: 30_000 })
      .toSatisfy((color) => sameColor(color, RED));

    const cycle = page.locator('[data-action="cycle-map"]');
    // Enabled once the worker knows there is more than one map.
    await expect.poll(() => cycle.getAttribute('disabled')).toBeNull();
    const tile = page.waitForResponse((res) =>
      tilesOf(MAP_IDS.blue).test(res.url()),
    );
    await cycle.click();

    expect((await tile).status()).toBe(200);
    await expect
      .poll(() => mapCenterColor(page), { timeout: 30_000 })
      .toSatisfy((color) => sameColor(color, BLUE));
  });
});
