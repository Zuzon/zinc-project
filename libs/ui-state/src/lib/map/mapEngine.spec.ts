import { MapEngine } from './mapEngine.js';

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
});
