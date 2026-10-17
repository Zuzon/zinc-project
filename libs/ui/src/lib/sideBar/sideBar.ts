import { LitElement, html, css, type SVGTemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@material/web/divider/divider.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import { getCtx } from '@zinc-project/ui-state';
import {
  layersIcon,
  menuIcon,
  routesIcon,
  tracksIcon,
  waypointsIcon,
  zoomInIcon,
  zoomOutIcon,
} from '../icons/icons.js';
import { ObserveController } from '../rx/observeController.js';

/** Fired with the number of zoom levels to change by; the map view applies it. */
export type MapZoomEvent = CustomEvent<number>;

/** Vertical tool bar on the right edge of the screen. */
@customElement('side-bar')
export class SideBar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px;
      box-sizing: border-box;
      background: var(--md-sys-color-surface-container, #f3edf7);
      /* Large targets for use from a moving vehicle. */
      --md-icon-button-state-layer-width: 56px;
      --md-icon-button-state-layer-height: 56px;
      --md-icon-button-icon-size: 32px;
    }

    md-divider {
      width: 40px;
      margin: 4px 0;
    }

    .spacer {
      flex: 1;
    }
  `;

  private readonly canCycleMap = new ObserveController(
    this,
    getCtx().mapLayers.canCycleMap$,
    false,
  );

  override render() {
    return html`
      ${button('zoom-in', 'Zoom in', zoomInIcon, () => this.zoom(1))}
      ${button('zoom-out', 'Zoom out', zoomOutIcon, () => this.zoom(-1))}
      ${button(
        'cycle-map',
        'Switch map',
        layersIcon,
        () => this.cycleMap(),
        !this.canCycleMap.value,
      )}
      <md-divider></md-divider>
      ${button('waypoints', 'Waypoints', waypointsIcon, noop, true)}
      ${button('tracks', 'Tracks', tracksIcon, noop, true)}
      ${button('routes', 'Routes', routesIcon, noop, true)}
      <div class="spacer"></div>
      ${button('menu', 'Menu', menuIcon, noop, true)}
    `;
  }

  private zoom(delta: number): void {
    this.dispatchEvent(
      new CustomEvent('map-zoom', {
        detail: delta,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private cycleMap(): void {
    getCtx().mapLayers.cycleMap().subscribe();
  }
}

const noop = () => undefined;

function button(
  id: string,
  label: string,
  icon: SVGTemplateResult,
  onClick: () => void,
  disabled = false,
) {
  return html`<md-icon-button
    data-action=${id}
    aria-label=${label}
    title=${label}
    ?disabled=${disabled}
    @click=${onClick}
    ><md-icon>${icon}</md-icon></md-icon-button
  >`;
}

declare global {
  interface HTMLElementTagNameMap {
    'side-bar': SideBar;
  }
  interface HTMLElementEventMap {
    'map-zoom': MapZoomEvent;
  }
}
