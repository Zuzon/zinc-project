import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-element')
export class UiElement extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  @property() name = 'World';

  override render() {
    return html`<p>Hello, ${this.name}!</p>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-element': UiElement;
  }
}
