import { MainMapView } from '../map/mainMapView.js';
import { ZincApp } from './zincApp.js';

describe('ZincApp', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the main map view', async () => {
    const app = document.createElement('zinc-app');
    document.body.append(app);
    await app.updateComplete;

    const mapView = app.shadowRoot?.querySelector('main-map-view');
    expect(app).toBeInstanceOf(ZincApp);
    expect(mapView).toBeInstanceOf(MainMapView);
  });
});
