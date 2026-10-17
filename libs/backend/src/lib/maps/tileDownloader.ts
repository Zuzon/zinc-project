import {
  BehaviorSubject,
  EMPTY,
  Observable,
  type SchedulerLike,
  Subject,
  type Subscription,
  asyncScheduler,
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  mergeMap,
  retry,
  takeUntil,
  tap,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import type { TileData } from '@zinc-project/dto';

export interface TileRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface TileDownloaderOptions {
  /** Most requests in flight at once, across every map. */
  maxConcurrent?: number;
  /** Per attempt. */
  timeoutMs?: number;
  /** Extra attempts after a retryable failure. */
  retryCount?: number;
  /** First retry delay; doubles with every further attempt. */
  retryDelayMs?: number;
  fetch?: typeof globalThis.fetch;
  scheduler?: SchedulerLike;
}

export interface TileDownloaderStats {
  active: number;
  queued: number;
}

export class TileDownloadError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'TileDownloadError';
  }
}

/**
 * Downloads tiles for every map through one queue, so no more than
 * `maxConcurrent` requests are ever in flight. A retry keeps its slot.
 * Unsubscribing drops a queued request or aborts a running one.
 */
export class TileDownloader {
  readonly stats$: Observable<TileDownloaderStats>;

  private readonly _stats$ = new BehaviorSubject<TileDownloaderStats>({
    active: 0,
    queued: 0,
  });
  private readonly jobs$ = new Subject<Observable<unknown>>();
  private readonly subscription: Subscription;
  private readonly timeoutMs: number;
  private readonly retryCount: number;
  private readonly retryDelayMs: number;
  private readonly fetch: typeof globalThis.fetch;
  private readonly scheduler: SchedulerLike;

  constructor(options: TileDownloaderOptions = {}) {
    const { maxConcurrent = 64 } = options;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retryCount = options.retryCount ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 300;
    this.fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.scheduler = options.scheduler ?? asyncScheduler;

    this.stats$ = this._stats$.pipe(
      distinctUntilChanged(
        (a, b) => a.active === b.active && a.queued === b.queued,
      ),
    );
    this.subscription = this.jobs$
      .pipe(mergeMap((job) => job, maxConcurrent))
      .subscribe();
  }

  /** Emits the tile, or `null` when the server has none (404/204), then completes. */
  download(request: TileRequest): Observable<TileData | null> {
    return new Observable<TileData | null>((subscriber) => {
      let state: 'queued' | 'active' | 'done' = 'queued';
      const cancel$ = new Subject<void>();
      this.count(0, 1);

      this.jobs$.next(
        defer(() => {
          if (state !== 'queued') {
            return EMPTY;
          }
          state = 'active';
          this.count(1, -1);
          return this.fetchWithRetry(request).pipe(
            tap(subscriber),
            catchError(() => EMPTY),
            takeUntil(cancel$),
            finalize(() => {
              state = 'done';
              this.count(-1, 0);
            }),
          );
        }),
      );

      return () => {
        if (state === 'queued') {
          state = 'done';
          this.count(0, -1);
        }
        cancel$.next();
        cancel$.complete();
      };
    });
  }

  destroy(): void {
    this.subscription.unsubscribe();
    this.jobs$.complete();
    this._stats$.complete();
  }

  private fetchWithRetry(request: TileRequest): Observable<TileData | null> {
    return this.fetchOnce(request).pipe(
      timeout({
        first: this.timeoutMs,
        with: () =>
          throwError(
            () => new TileDownloadError(`Timed out: ${request.url}`, true),
          ),
        scheduler: this.scheduler,
      }),
      retry({
        count: this.retryCount,
        delay: (err, attempt) =>
          isRetryable(err)
            ? timer(this.retryDelayMs * 2 ** (attempt - 1), this.scheduler)
            : throwError(() => err),
      }),
    );
  }

  private fetchOnce({
    url,
    headers,
  }: TileRequest): Observable<TileData | null> {
    return new Observable<TileData | null>((subscriber) => {
      const abort = new AbortController();
      let settled = false;
      this.fetch(url, { headers, signal: abort.signal })
        .then((res) => readTile(url, res))
        .then(
          (tile) => {
            settled = true;
            subscriber.next(tile);
            subscriber.complete();
          },
          (err: unknown) => {
            settled = true;
            subscriber.error(err);
          },
        );
      return () => {
        if (!settled) {
          abort.abort();
        }
      };
    });
  }

  private count(active: number, queued: number): void {
    const stats = this._stats$.value;
    this._stats$.next({
      active: stats.active + active,
      queued: stats.queued + queued,
    });
  }
}

async function readTile(url: string, res: Response): Promise<TileData | null> {
  if (res.status === 404 || res.status === 204) {
    await res.body?.cancel();
    return null;
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new TileDownloadError(
      `HTTP ${res.status}: ${url}`,
      res.status >= 500 || res.status === 408 || res.status === 429,
      res.status,
    );
  }
  const contentType = (res.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!contentType.startsWith('image/')) {
    await res.body?.cancel();
    throw new TileDownloadError(
      `Not an image (${contentType || 'no content type'}): ${url}`,
      false,
      res.status,
    );
  }
  return { data: new Uint8Array(await res.arrayBuffer()), contentType };
}

/** Network failures and timeouts are retried; definite HTTP answers only when transient. */
function isRetryable(err: unknown): boolean {
  return err instanceof TileDownloadError ? err.retryable : true;
}
