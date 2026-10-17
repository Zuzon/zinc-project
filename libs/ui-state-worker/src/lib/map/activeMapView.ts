import type { MapInfo } from '@zinc-project/dto';

/** Map the main view shows: for now the first one the backend lists. */
export function selectActiveMap(maps: readonly MapInfo[]): MapInfo | null {
  return maps[0] ?? null;
}

export function sameMap(a: MapInfo | null, b: MapInfo | null): boolean {
  return a?.id === b?.id && a?.tileUrl === b?.tileUrl;
}
