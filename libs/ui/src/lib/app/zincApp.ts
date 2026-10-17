import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../map/mainMapView.js';

/** Root component mounted by every shell. */
@customElement('zinc-app')
export class ZincApp extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    main-map-view {
      width: 100%;
      height: 100%;
    }
  `;

  override render() {
    return html`<main-map-view></main-map-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'zinc-app': ZincApp;
  }
}
