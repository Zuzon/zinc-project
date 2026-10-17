import type { ZncConfig } from './zncConfig.js';

/** A map as persisted in its own SQLite tile database. */
export interface StoredMap {
  id: string;
  name: string;
  config: ZncConfig;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

/** Encoded tile image. */
export interface TileData {
  data: Uint8Array;
  contentType: string;
}
