import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import olCss from 'ol/ol.css?inline';

/** WGS84 degrees, `[longitude, latitude]`. */
export type LonLat = [lon: number, lat: number];

export interface MapEngineOptions {
  center?: LonLat;
  zoom?: number;
}

/** OpenLayers stylesheet; components rendering a map in shadow DOM must adopt it. */
export const mapEngineCss: string = olCss;

const DEFAULT_CENTER: LonLat = [24.1052, 56.9496];
const DEFAULT_ZOOM = 10;

/**
 * Owns the OpenLayers map. Coordinates cross this boundary as WGS84 degrees;
 * the EPSG:3857 projection stays inside.
 */
export class MapEngine {
  private readonly map: OlMap;

  constructor(options: MapEngineOptions = {}) {
    this.map = new OlMap({
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({
        center: fromLonLat(options.center ?? DEFAULT_CENTER),
        zoom: options.zoom ?? DEFAULT_ZOOM,
      }),
    });
  }

  mount(target: HTMLElement): void {
    this.map.setTarget(target);
  }

  unmount(): void {
    this.map.setTarget(undefined);
  }

  getCenter(): LonLat {
    const center = this.map.getView().getCenter();
    if (!center) {
      throw new Error('Map view has no center');
    }
    const [lon, lat] = toLonLat(center);
    return [lon, lat];
  }

  getZoom(): number | undefined {
    return this.map.getView().getZoom();
  }

  destroy(): void {
    this.unmount();
    this.map.dispose();
  }
}
