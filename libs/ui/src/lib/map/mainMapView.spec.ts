import { MainMapView } from './mainMapView.js';

describe('MainMapView', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the OpenLayers viewport into its shadow root', async () => {
    const view = document.createElement('main-map-view');
    document.body.append(view);
    await view.updateComplete;

    expect(view).toBeInstanceOf(MainMapView);
    expect(view.shadowRoot?.querySelector('.map .ol-viewport')).not.toBeNull();
  });

  it('releases the viewport when disconnected', async () => {
    const view = document.createElement('main-map-view');
    document.body.append(view);
    await view.updateComplete;

    view.remove();

    expect(view.shadowRoot?.querySelector('.ol-viewport')).toBeNull();
  });
});
