import type { MapInfo } from '@zinc-project/dto';

/** Map the main view shows: the selected one, else the first the backend lists. */
export function selectActiveMap(
  maps: readonly MapInfo[],
  selectedId: string | null = null,
): MapInfo | null {
  return maps.find((m) => m.id === selectedId) ?? maps[0] ?? null;
}

/** Map after `currentId` in the list, wrapping around; `null` when there is none. */
export function nextMap(
  maps: readonly MapInfo[],
  currentId: string | null,
): MapInfo | null {
  if (maps.length === 0) {
    return null;
  }
  const index = maps.findIndex((m) => m.id === currentId);
  return maps[(index + 1) % maps.length];
}

export function sameMap(a: MapInfo | null, b: MapInfo | null): boolean {
  return a?.id === b?.id && a?.tileUrl === b?.tileUrl;
}
