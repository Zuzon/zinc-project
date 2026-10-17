import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Subscription } from 'rxjs';
import {
  MapEngine,
  getCtx,
  mapEngineCss,
  syncMapLayers,
  syncMapView,
} from '@zinc-project/ui-state';

@customElement('main-map-view')
export class MainMapView extends LitElement {
  static override styles = [
    unsafeCSS(mapEngineCss),
    css`
      :host {
        display: block;
        position: relative;
      }

      .map {
        position: absolute;
        inset: 0;
      }
    `,
  ];

  readonly engine = new MapEngine();

  private readonly mapRef = createRef<HTMLDivElement>();
  private viewSync?: Subscription;
  private layersSync?: Subscription;

  override connectedCallback(): void {
    super.connectedCallback();
    // Re-attach after the element was moved in the DOM.
    if (this.mapRef.value) {
      this.attach(this.mapRef.value);
    }
  }

  override disconnectedCallback(): void {
    this.viewSync?.unsubscribe();
    this.viewSync = undefined;
    this.layersSync?.unsubscribe();
    this.layersSync = undefined;
    this.engine.unmount();
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    if (this.mapRef.value) {
      this.attach(this.mapRef.value);
    }
  }

  private attach(target: HTMLDivElement): void {
    this.engine.mount(target);
    this.viewSync ??= syncMapView(this.engine, getCtx().mapView);
    this.layersSync ??= syncMapLayers(this.engine, getCtx().mapLayers);
  }

  override render() {
    return html`<div class="map" ${ref(this.mapRef)}></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'main-map-view': MainMapView;
  }
}
