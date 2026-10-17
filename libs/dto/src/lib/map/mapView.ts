/** WGS84 degrees, `[longitude, latitude]`. */
export type LonLat = [lon: number, lat: number];

/** Map camera. The center is always WGS84; `projection` is the view's projection code. */
export interface MapViewState {
  projection: string;
  center: LonLat;
  zoom: number;
}
