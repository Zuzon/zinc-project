import type { MapViewState } from '@zinc-project/dto';

export const DEFAULT_MAP_VIEW: MapViewState = {
  projection: 'EPSG:3857',
  center: [24.1052, 56.9496],
  zoom: 10,
};

/** Guards values read back from storage or received over the bridge. */
export function isMapViewState(value: unknown): value is MapViewState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { projection, center, zoom } = value as Partial<MapViewState>;
  return (
    typeof projection === 'string' &&
    projection.length > 0 &&
    Array.isArray(center) &&
    center.length === 2 &&
    isInRange(center[0], -180, 180) &&
    isInRange(center[1], -90, 90) &&
    isInRange(zoom, 0, 30)
  );
}

/** ~0.1 mm; absorbs float noise from projecting to the map and back. */
const EPSILON = 1e-9;

export function sameMapView(a: MapViewState, b: MapViewState): boolean {
  return (
    a.projection === b.projection &&
    Math.abs(a.zoom - b.zoom) < EPSILON &&
    Math.abs(a.center[0] - b.center[0]) < EPSILON &&
    Math.abs(a.center[1] - b.center[1]) < EPSILON
  );
}

function isInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
