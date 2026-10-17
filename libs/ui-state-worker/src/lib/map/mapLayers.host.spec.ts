import { BehaviorSubject, firstValueFrom, take, toArray } from 'rxjs';
import type { MapInfo } from '@zinc-project/dto';
import { selectActiveMap } from './activeMapView.js';
import { MapLayersService } from './mapLayers.host.js';

const mapInfo = (id: string): MapInfo => ({
  id,
  name: id,
  bbox: [0, 0, 1, 1],
  minResolution: 1,
  maxResolution: 1,
  epsg: 'EPSG:3857',
  format: 'png',
  grid: { resolutions: [1], origins: [[0, 1]], tileSizes: [[256, 256]] },
  tileUrl: `/api/maps/${id}/tiles/{z}/{x}/{y}`,
});

describe('selectActiveMap', () => {
  it('picks the first map, or null when there is none', () => {
    expect(selectActiveMap([mapInfo('a'), mapInfo('b')])?.id).toBe('a');
    expect(selectActiveMap([])).toBeNull();
  });
});

describe('MapLayersService', () => {
  it('follows the backend map list', async () => {
    const maps$ = new BehaviorSubject<MapInfo[]>([]);
    const service = new MapLayersService({ maps$ });
    const seen = firstValueFrom(service.activeMap$.pipe(take(2), toArray()));

    maps$.next([mapInfo('osm')]);

    expect((await seen).map((m) => m?.id ?? null)).toEqual([null, 'osm']);
  });

  it('does not re-emit when other maps are added', async () => {
    const maps$ = new BehaviorSubject<MapInfo[]>([mapInfo('osm')]);
    const service = new MapLayersService({ maps$ });
    const emitted: (string | null)[] = [];
    const sub = service.activeMap$.subscribe((m) =>
      emitted.push(m?.id ?? null),
    );

    maps$.next([mapInfo('osm'), mapInfo('topo')]);
    sub.unsubscribe();

    expect(emitted).toEqual(['osm']);
  });
});
