import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';
import { TileDownloadError, TileDownloader } from './tileDownloader.js';

const png = (bytes = [1, 2, 3]) =>
  new Response(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/png' },
  });

interface PendingFetch {
  url: string;
  signal: AbortSignal;
  resolve: (res: Response) => void;
  reject: (err: unknown) => void;
}

/** A fetch whose calls stay pending until the test settles them. */
function manualFetch() {
  const calls: PendingFetch[] = [];
  const fetch = ((url: string, init: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      calls.push({ url, signal: init.signal as AbortSignal, resolve, reject });
    })) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TileDownloader', () => {
  let downloader: TileDownloader | undefined;
  afterEach(() => downloader?.destroy());

  it('returns the tile bytes and content type', async () => {
    downloader = new TileDownloader({ fetch: async () => png([9, 8]) });
    expect(await firstValueFrom(downloader.download({ url: 'u' }))).toEqual({
      data: new Uint8Array([9, 8]),
      contentType: 'image/png',
    });
  });

  it('sends the request headers', async () => {
    const seen: unknown[] = [];
    downloader = new TileDownloader({
      fetch: async (_url, init) => {
        seen.push(init?.headers ?? {});
        return png();
      },
    });
    await firstValueFrom(
      downloader.download({ url: 'u', headers: { 'User-Agent': 'zinc' } }),
    );
    expect(seen).toEqual([{ 'User-Agent': 'zinc' }]);
  });

  it('never runs more than maxConcurrent requests', async () => {
    const { calls, fetch } = manualFetch();
    const limited = new TileDownloader({ fetch, maxConcurrent: 64 });
    downloader = limited;
    let peak = 0;
    const stats = limited.stats$.subscribe((s) => {
      peak = Math.max(peak, s.active);
    });

    const all = Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        firstValueFrom(limited.download({ url: `u${i}` })),
      ),
    );
    await tick();
    expect(calls).toHaveLength(64);
    expect(await firstValueFrom(downloader.stats$)).toEqual({
      active: 64,
      queued: 36,
    });

    // Each finished request lets exactly one queued request start.
    for (let i = 0; i < 100; i++) {
      calls[i].resolve(png());
      await tick();
    }

    expect(await all).toHaveLength(100);
    expect(calls).toHaveLength(100);
    expect(peak).toBe(64);
    expect(await firstValueFrom(downloader.stats$)).toEqual({
      active: 0,
      queued: 0,
    });
    stats.unsubscribe();
  });

  it.each([
    ['a 503', () => Promise.resolve(new Response('', { status: 503 }))],
    ['a network error', () => Promise.reject(new TypeError('fetch failed'))],
  ])('retries after %s', async (_, fail) => {
    let attempts = 0;
    downloader = new TileDownloader({
      retryDelayMs: 1,
      fetch: () => (++attempts < 3 ? fail() : Promise.resolve(png())),
    });
    expect(
      await firstValueFrom(downloader.download({ url: 'u' })),
    ).not.toBeNull();
    expect(attempts).toBe(3);
  });

  it('gives up after retryCount extra attempts', async () => {
    let attempts = 0;
    downloader = new TileDownloader({
      retryCount: 2,
      retryDelayMs: 1,
      fetch: async () => (attempts++, new Response('', { status: 500 })),
    });
    await expect(
      firstValueFrom(downloader.download({ url: 'u' })),
    ).rejects.toBeInstanceOf(TileDownloadError);
    expect(attempts).toBe(3);
  });

  it('returns null on 404 without retrying', async () => {
    let attempts = 0;
    downloader = new TileDownloader({
      retryDelayMs: 1,
      fetch: async () => (attempts++, new Response('', { status: 404 })),
    });
    expect(await firstValueFrom(downloader.download({ url: 'u' }))).toBeNull();
    expect(attempts).toBe(1);
  });

  it('does not retry a response that is not an image', async () => {
    let attempts = 0;
    downloader = new TileDownloader({
      retryDelayMs: 1,
      fetch: async () => (
        attempts++,
        new Response('<html>', { headers: { 'content-type': 'text/html' } })
      ),
    });
    await expect(
      firstValueFrom(downloader.download({ url: 'u' })),
    ).rejects.toThrow('Not an image');
    expect(attempts).toBe(1);
  });

  it('aborts and retries an attempt that times out', async () => {
    const { calls, fetch } = manualFetch();
    downloader = new TileDownloader({ fetch, timeoutMs: 20, retryDelayMs: 1 });

    const tile = firstValueFrom(downloader.download({ url: 'u' }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    calls[1].resolve(png());

    expect(await tile).not.toBeNull();
  });

  it('drops a queued request that is unsubscribed before it starts', async () => {
    const { calls, fetch } = manualFetch();
    downloader = new TileDownloader({ fetch, maxConcurrent: 1 });

    const first = firstValueFrom(downloader.download({ url: 'first' }));
    const dropped = downloader.download({ url: 'dropped' }).subscribe();
    const last = firstValueFrom(downloader.download({ url: 'last' }));
    await tick();
    dropped.unsubscribe();
    calls[0].resolve(png());
    await first;
    await tick();
    calls[1].resolve(png());
    await last;

    expect(calls.map((c) => c.url)).toEqual(['first', 'last']);
  });

  it('aborts a running request that is unsubscribed and frees its slot', async () => {
    const { calls, fetch } = manualFetch();
    downloader = new TileDownloader({ fetch, maxConcurrent: 1 });

    const running = downloader.download({ url: 'running' }).subscribe();
    const next = firstValueFrom(downloader.download({ url: 'next' }));
    await tick();
    running.unsubscribe();
    await tick();

    expect(calls[0].signal.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    calls[1].resolve(png());
    expect(await next).not.toBeNull();
  });

  it('completes after one value', async () => {
    downloader = new TileDownloader({ fetch: async () => png() });
    expect(
      await lastValueFrom(downloader.download({ url: 'u' }).pipe(toArray())),
    ).toHaveLength(1);
  });
});
