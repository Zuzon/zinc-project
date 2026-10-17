import {
  Observable,
  VirtualTimeScheduler,
  firstValueFrom,
  of,
  throwError,
} from 'rxjs';
import type { MapViewState } from '@zinc-project/dto';
import type { KeyValueStore } from '../storage/keyValueStore.js';
import { MAP_VIEW_STORAGE_KEY, MapViewService } from './mapView.host.js';
import { DEFAULT_MAP_VIEW } from './mapViewState.js';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, unknown>();
  readonly writes: unknown[] = [];

  get<T>(key: string): Observable<T | undefined> {
    return of(this.data.get(key) as T | undefined);
  }

  set<T>(key: string, value: T): Observable<void> {
    this.data.set(key, value);
    this.writes.push(value);
    return of(undefined);
  }
}

const stored: MapViewState = {
  projection: 'EPSG:3857',
  center: [21.0059, 56.5047],
  zoom: 12,
};
const viewAt = (zoom: number): MapViewState => ({ ...stored, zoom });

describe('MapViewService', () => {
  let store: MemoryStore;
  let scheduler: VirtualTimeScheduler;
  let service: MapViewService | undefined;

  const create = () => {
    service = new MapViewService(store, { saveIntervalMs: 3000, scheduler });
    return service;
  };
  const advance = (ms: number) => {
    scheduler.maxFrames = scheduler.frame + ms;
    scheduler.flush();
  };

  beforeEach(() => {
    // The host decorator warns that there is no worker scope in Node.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    store = new MemoryStore();
    scheduler = new VirtualTimeScheduler();
  });

  afterEach(() => {
    service?.destroy();
    vi.restoreAllMocks();
  });

  it('restores the stored view', async () => {
    store.data.set(MAP_VIEW_STORAGE_KEY, stored);
    expect(await firstValueFrom(create().view$)).toEqual(stored);
  });

  it('falls back to the default view when nothing is stored', async () => {
    expect(await firstValueFrom(create().view$)).toEqual(DEFAULT_MAP_VIEW);
  });

  it('falls back to the default view when the stored value is invalid', async () => {
    store.data.set(MAP_VIEW_STORAGE_KEY, {
      projection: 'EPSG:3857',
      center: [0, 999],
      zoom: 3,
    });
    expect(await firstValueFrom(create().view$)).toEqual(DEFAULT_MAP_VIEW);
  });

  it('falls back to the default view when the store fails', async () => {
    vi.spyOn(store, 'get').mockReturnValue(
      throwError(() => new Error('blocked')),
    );
    expect(await firstValueFrom(create().view$)).toEqual(DEFAULT_MAP_VIEW);
  });

  it('saves the latest view once per interval while it changes', async () => {
    const mapView = create();
    await firstValueFrom(mapView.setView(viewAt(11)));
    await firstValueFrom(mapView.setView(viewAt(12)));
    await firstValueFrom(mapView.setView(viewAt(13)));
    expect(store.writes).toEqual([]);

    advance(3000);
    expect(store.writes).toEqual([viewAt(13)]);

    await firstValueFrom(mapView.setView(viewAt(14)));
    advance(3000);
    expect(store.writes).toEqual([viewAt(13), viewAt(14)]);
  });

  it('does not write while the view is idle or unchanged', async () => {
    store.data.set(MAP_VIEW_STORAGE_KEY, stored);
    const mapView = create();
    advance(9000);
    // The map reports the restored view back with projection round-trip noise.
    await firstValueFrom(
      mapView.setView({
        ...stored,
        center: [stored.center[0], stored.center[1] + 4e-15],
      }),
    );
    advance(9000);
    expect(store.writes).toEqual([]);
  });

  it('keeps a view reported before the restore finished', async () => {
    store.data.set(MAP_VIEW_STORAGE_KEY, stored);
    let release!: () => void;
    vi.spyOn(store, 'get').mockReturnValue(
      new Observable((subscriber) => {
        release = () => {
          subscriber.next(stored);
          subscriber.complete();
        };
      }),
    );
    const mapView = create();
    await firstValueFrom(mapView.setView(viewAt(5)));
    release();

    expect(await firstValueFrom(mapView.view$)).toEqual(viewAt(5));
  });

  it('rejects an invalid view', async () => {
    const invalid = { projection: '', center: [0, 0], zoom: 1 } as MapViewState;
    await expect(firstValueFrom(create().setView(invalid))).rejects.toThrow(
      'Invalid map view',
    );
  });

  it('stops saving after destroy', async () => {
    const mapView = create();
    await firstValueFrom(mapView.setView(viewAt(11)));
    mapView.destroy();
    advance(3000);
    expect(store.writes).toEqual([]);
  });
});
