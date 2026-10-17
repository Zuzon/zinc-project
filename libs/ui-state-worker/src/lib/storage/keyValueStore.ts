import type { Observable } from 'rxjs';

/** Small persistent key/value store for UI-state settings. */
export interface KeyValueStore {
  /** Emits the stored value, or `undefined` when the key is missing, then completes. */
  get<T>(key: string): Observable<T | undefined>;
  set<T>(key: string, value: T): Observable<void>;
}
