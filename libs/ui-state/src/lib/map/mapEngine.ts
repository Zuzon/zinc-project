import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import type TileImage from 'ol/source/TileImage.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { unByKey } from 'ol/Observable.js';
import olCss from 'ol/ol.css?inline';
import { Observable } from 'rxjs';
import type { LonLat, MapInfo, MapViewState } from '@zinc-project/dto';
import { createMapSource, resolveMapProjection } from './mapSource.js';

export type { LonLat } from '@zinc-project/dto';

export interface MapEngineOptions {
  projection?: string;
  center?: LonLat;
  zoom?: number;
}

/** OpenLayers stylesheet; components rendering a map in shadow DOM must adopt it. */
export const mapEngineCss: string = olCss;

const DEFAULT_PROJECTION = 'EPSG:3857';
const DEFAULT_CENTER: LonLat = [24.1052, 56.9496];
const DEFAULT_ZOOM = 10;
const ZOOM_DURATION_MS = 250;

/**
 * Owns the OpenLayers map. Coordinates cross this boundary as WGS84 degrees;
 * the view projection stays inside.
 */
export class MapEngine {
  private readonly map: OlMap;
  private baseLayer?: TileLayer<TileImage>;
  private baseMapId?: string;

  /** Emits the view after every pan, zoom or programmatic move. */
  readonly viewChange$: Observable<MapViewState>;

  constructor(options: MapEngineOptions = {}) {
    this.map = new OlMap({
      controls: [],
      layers: [],
      view: createView({
        projection: options.projection ?? DEFAULT_PROJECTION,
        center: options.center ?? DEFAULT_CENTER,
        zoom: options.zoom ?? DEFAULT_ZOOM,
      }),
    });
    this.viewChange$ = new Observable<MapViewState>((subscriber) => {
      const key = this.map.on('moveend', () => {
        const view = this.getView();
        if (view) {
          subscriber.next(view);
        }
      });
      return () => unByKey(key);
    });
  }

  mount(target: HTMLElement): void {
    this.map.setTarget(target);
  }

  unmount(): void {
    this.map.setTarget(undefined);
  }

  getProjection(): string {
    return this.map.getView().getProjection().getCode();
  }

  getCenter(): LonLat {
    const view = this.map.getView();
    const center = view.getCenter();
    if (!center) {
      throw new Error('Map view has no center');
    }
    const [lon, lat] = toLonLat(center, view.getProjection());
    return [lon, lat];
  }

  getZoom(): number | undefined {
    return this.map.getView().getZoom();
  }

  /** Current view, or `undefined` while the view is not fully defined. */
  getView(): MapViewState | undefined {
    const zoom = this.getZoom();
    if (zoom === undefined || !this.map.getView().getCenter()) {
      return undefined;
    }
    return { projection: this.getProjection(), center: this.getCenter(), zoom };
  }

  /** Moves the camera; a different projection replaces the OpenLayers view. */
  setView(state: MapViewState): void {
    if (state.projection !== this.getProjection()) {
      this.map.setView(createView(state));
      return;
    }
    const view = this.map.getView();
    view.setCenter(fromLonLat(state.center, view.getProjection()));
    view.setZoom(state.zoom);
  }

  /** Animates the zoom by `delta` levels, staying within the view's limits. */
  zoomBy(delta: number): void {
    const view = this.map.getView();
    const zoom = view.getZoom();
    if (zoom === undefined) {
      return;
    }
    const target = view.getConstrainedZoom(zoom + delta) ?? zoom + delta;
    // Animations only advance while the map renders into a target.
    if (!this.map.getTargetElement()) {
      view.setZoom(target);
      return;
    }
    if (view.getAnimating()) {
      view.cancelAnimations();
    }
    view.animate({ zoom: target, duration: ZOOM_DURATION_MS });
  }

  /** Shows `info` as the base layer, replacing the previous one; `null` clears it. */
  setBaseMap(info: MapInfo | null): void {
    this.clearBaseMap();
    if (!info) {
      return;
    }
    const projection = resolveMapProjection(info);
    if (!projection) {
      console.warn(`[map] unknown projection ${info.epsg} of map ${info.id}`);
      return;
    }
    this.baseLayer = new TileLayer({
      source: createMapSource(info, projection),
    });
    this.baseMapId = info.id;
    this.map.getLayers().insertAt(0, this.baseLayer);
  }

  /** Id of the map shown as the base layer. */
  getBaseMapId(): string | undefined {
    return this.baseMapId;
  }

  destroy(): void {
    this.clearBaseMap();
    this.unmount();
    this.map.dispose();
  }

  private clearBaseMap(): void {
    if (!this.baseLayer) {
      return;
    }
    this.map.removeLayer(this.baseLayer);
    this.baseLayer.getSource()?.dispose();
    this.baseLayer.dispose();
    this.baseLayer = undefined;
    this.baseMapId = undefined;
  }
}

function createView({ projection, center, zoom }: MapViewState): View {
  return new View({ projection, center: fromLonLat(center, projection), zoom });
}
