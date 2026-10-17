import { Observable, Subject, of } from 'rxjs';
import type { MapViewState } from '@zinc-project/dto';
import { syncMapView } from './mapViewSync.js';

const viewAt = (zoom: number): MapViewState => ({
  projection: 'EPSG:3857',
  center: [21.0059, 56.5047],
  zoom,
});

function setup() {
  const view$ = new Subject<MapViewState>();
  const viewChange$ = new Subject<MapViewState>();
  const engine = { setView: vi.fn(), viewChange$: viewChange$.asObservable() };
  const reported: MapViewState[] = [];
  const mapView = {
    view$: view$.asObservable(),
    setView: vi.fn((view: MapViewState): Observable<void> => {
      reported.push(view);
      return of(undefined);
    }),
  };
  return { view$, viewChange$, engine, mapView, reported };
}

describe('syncMapView', () => {
  it('applies only the first view from the service', () => {
    const { view$, engine, mapView } = setup();
    const sub = syncMapView(engine, mapView);

    view$.next(viewAt(12));
    view$.next(viewAt(13));

    expect(engine.setView).toHaveBeenCalledTimes(1);
    expect(engine.setView).toHaveBeenCalledWith(viewAt(12));
    sub.unsubscribe();
  });

  it('reports camera changes only after the view was restored', () => {
    const { view$, viewChange$, engine, mapView, reported } = setup();
    const sub = syncMapView(engine, mapView);

    viewChange$.next(viewAt(5));
    view$.next(viewAt(12));
    viewChange$.next(viewAt(14));
    viewChange$.next(viewAt(15));

    expect(reported).toEqual([viewAt(14), viewAt(15)]);
    sub.unsubscribe();
  });

  it('stops reporting after unsubscribe', () => {
    const { view$, viewChange$, engine, mapView, reported } = setup();
    const sub = syncMapView(engine, mapView);
    view$.next(viewAt(12));

    sub.unsubscribe();
    viewChange$.next(viewAt(14));

    expect(reported).toEqual([]);
  });
});
