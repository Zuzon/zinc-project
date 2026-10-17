import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { MainMapView } from '../map/mainMapView.js';
import type { MapZoomEvent } from '../sideBar/sideBar.js';
import '../map/mainMapView.js';
import '../sideBar/sideBar.js';

/** Root component mounted by every shell: the map with a tool bar on its right. */
@customElement('zinc-app')
export class ZincApp extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
    }

    main-map-view {
      flex: 1;
      min-width: 0;
    }
  `;

  private readonly mapViewRef = createRef<MainMapView>();

  override render() {
    return html`
      <main-map-view ${ref(this.mapViewRef)}></main-map-view>
      <side-bar @map-zoom=${this.onMapZoom}></side-bar>
    `;
  }

  private onMapZoom(event: MapZoomEvent): void {
    this.mapViewRef.value?.zoomBy(event.detail);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zinc-app': ZincApp;
  }
}
