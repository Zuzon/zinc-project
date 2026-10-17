import type { MapInfo } from '@zinc-project/dto';
import { MapEngine } from './mapEngine.js';

const HALF = 20037508.342789244;
const mapInfo = (id: string, epsg = 'EPSG:3857'): MapInfo => ({
  id,
  name: id,
  bbox: [-HALF, -HALF, HALF, HALF],
  minResolution: 156543.03392804097,
  maxResolution: 156543.03392804097,
  epsg,
  format: 'png',
  grid: {
    resolutions: [156543.03392804097],
    origins: [[-HALF, HALF]],
    tileSizes: [[256, 256]],
  },
  tileUrl: `/api/maps/${id}/tiles/{z}/{x}/{y}`,
});

describe('MapEngine', () => {
  it('keeps the center in WGS84 degrees', () => {
    const engine = new MapEngine({ center: [21.0059, 56.5047], zoom: 12 });

    const [lon, lat] = engine.getCenter();
    expect(lon).toBeCloseTo(21.0059, 6);
    expect(lat).toBeCloseTo(56.5047, 6);
    expect(engine.getZoom()).toBe(12);

    engine.destroy();
  });

  it('falls back to the default view', () => {
    const engine = new MapEngine();

    const [lon, lat] = engine.getCenter();
    expect(lon).toBeCloseTo(24.1052, 6);
    expect(lat).toBeCloseTo(56.9496, 6);
    expect(engine.getZoom()).toBe(10);

    engine.destroy();
  });

  it('applies a view given in WGS84 degrees', () => {
    const engine = new MapEngine();

    engine.setView({
      projection: 'EPSG:3857',
      center: [21.0059, 56.5047],
      zoom: 14,
    });

    const view = engine.getView();
    expect(view?.projection).toBe('EPSG:3857');
    expect(view?.center[0]).toBeCloseTo(21.0059, 6);
    expect(view?.center[1]).toBeCloseTo(56.5047, 6);
    expect(view?.zoom).toBe(14);

    engine.destroy();
  });

  it('replaces the view when the projection changes', () => {
    const engine = new MapEngine();

    engine.setView({
      projection: 'EPSG:4326',
      center: [21.0059, 56.5047],
      zoom: 8,
    });

    expect(engine.getProjection()).toBe('EPSG:4326');
    const [lon, lat] = engine.getCenter();
    expect(lon).toBeCloseTo(21.0059, 6);
    expect(lat).toBeCloseTo(56.5047, 6);

    engine.destroy();
  });

  it('shows one base map at a time', () => {
    const engine = new MapEngine();

    engine.setBaseMap(mapInfo('osm'));
    expect(engine.getBaseMapId()).toBe('osm');

    engine.setBaseMap(mapInfo('topo'));
    expect(engine.getBaseMapId()).toBe('topo');

    engine.setBaseMap(null);
    expect(engine.getBaseMapId()).toBeUndefined();

    engine.destroy();
  });

  it('skips a map whose projection is unknown', () => {
    const engine = new MapEngine();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    engine.setBaseMap(mapInfo('osm'));
    engine.setBaseMap(mapInfo('odd', 'EPSG:999999'));

    expect(engine.getBaseMapId()).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    engine.destroy();
  });
});
