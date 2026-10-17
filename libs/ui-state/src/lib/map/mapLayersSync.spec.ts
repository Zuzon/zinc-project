import { Subject } from 'rxjs';
import type { MapInfo } from '@zinc-project/dto';
import { syncMapLayers } from './mapLayersSync.js';

describe('syncMapLayers', () => {
  it('shows every map the worker picks until unsubscribed', () => {
    const activeMap$ = new Subject<MapInfo | null>();
    const engine = { setBaseMap: vi.fn() };
    const sub = syncMapLayers(engine, { activeMap$ });
    const info = { id: 'osm' } as MapInfo;

    activeMap$.next(info);
    activeMap$.next(null);
    sub.unsubscribe();
    activeMap$.next(info);

    expect(engine.setBaseMap.mock.calls).toEqual([[info], [null]]);
  });
});
