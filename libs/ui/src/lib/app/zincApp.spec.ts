import { MainMapView } from '../map/mainMapView.js';
import { SideBar } from '../sideBar/sideBar.js';
import { ZincApp } from './zincApp.js';

describe('ZincApp', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the main map view with the side bar on its right', async () => {
    const app = document.createElement('zinc-app');
    document.body.append(app);
    await app.updateComplete;

    const mapView = app.shadowRoot?.querySelector('main-map-view');
    expect(app).toBeInstanceOf(ZincApp);
    expect(mapView).toBeInstanceOf(MainMapView);
    expect(mapView?.nextElementSibling).toBeInstanceOf(SideBar);
  });

  it('zooms the map when the side bar asks', async () => {
    const app = document.createElement('zinc-app');
    document.body.append(app);
    await app.updateComplete;
    const mapView = app.shadowRoot?.querySelector('main-map-view');
    const zoomBy = vi.spyOn(mapView as MainMapView, 'zoomBy');

    app.shadowRoot
      ?.querySelector('side-bar')
      ?.dispatchEvent(
        new CustomEvent('map-zoom', {
          detail: -1,
          bubbles: true,
          composed: true,
        }),
      );

    expect(zoomBy).toHaveBeenCalledWith(-1);
  });
});
