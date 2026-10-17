import { LitElement, html, css, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { MapEngine, mapEngineCss } from '@zinc-project/ui-state';

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

  override connectedCallback(): void {
    super.connectedCallback();
    // Re-attach after the element was moved in the DOM.
    if (this.mapRef.value) {
      this.engine.mount(this.mapRef.value);
    }
  }

  override disconnectedCallback(): void {
    this.engine.unmount();
    super.disconnectedCallback();
  }

  protected override firstUpdated(): void {
    if (this.mapRef.value) {
      this.engine.mount(this.mapRef.value);
    }
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
