import { Observable, defer, map, retry, shareReplay, switchMap } from 'rxjs';
import type { KeyValueStore } from './keyValueStore.js';

const STORE_NAME = 'kv';
const DB_VERSION = 1;

/** {@link KeyValueStore} on a single IndexedDB object store. Works in windows and workers. */
export class IndexedDbKeyValueStore implements KeyValueStore {
  private readonly db$: Observable<IDBDatabase>;

  constructor(
    dbName: string,
    private readonly factory: IDBFactory = indexedDB,
  ) {
    this.db$ = defer(() => this.open(dbName)).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  get<T>(key: string): Observable<T | undefined> {
    return this.db$.pipe(
      switchMap((db) =>
        fromRequest<T | undefined>(
          db
            .transaction(STORE_NAME, 'readonly')
            .objectStore(STORE_NAME)
            .get(key),
        ),
      ),
    );
  }

  set<T>(key: string, value: T): Observable<void> {
    return this.db$.pipe(
      switchMap((db) =>
        fromRequest(
          db
            .transaction(STORE_NAME, 'readwrite')
            .objectStore(STORE_NAME)
            .put(value, key),
        ),
      ),
      map(() => undefined),
      retry({ count: 3, delay: 500 }),
    );
  }

  private open(dbName: string): Observable<IDBDatabase> {
    const request = this.factory.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    return fromRequest(request);
  }
}

function fromRequest<T>(request: IDBRequest<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
    request.onsuccess = () => {
      subscriber.next(request.result);
      subscriber.complete();
    };
    request.onerror = () => subscriber.error(request.error);
  });
}
