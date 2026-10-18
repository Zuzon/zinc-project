import type { Page } from 'playwright';
import type { Rgb } from './solidPng.js';

/**
 * Colour at the centre of the map, read from the first OpenLayers canvas
 * that has drawn there (they sit in nested shadow roots), or `null`.
 */
export function mapCenterColor(page: Page): Promise<Rgb | null> {
  return page.evaluate(() => {
    const canvases: HTMLCanvasElement[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el instanceof HTMLCanvasElement) {
          canvases.push(el);
        }
        if (el.shadowRoot) {
          walk(el.shadowRoot);
        }
      }
    };
    walk(document);
    for (const canvas of canvases) {
      const pixel = canvas
        .getContext('2d')
        ?.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data;
      if (pixel && pixel[3] > 0) {
        return [pixel[0], pixel[1], pixel[2]] as const;
      }
    }
    return null;
  });
}

/** Whether two colours match within a small tolerance for colour management. */
export function sameColor(
  actual: Rgb | null,
  expected: Rgb,
  tolerance = 8,
): boolean {
  return (
    actual !== null &&
    actual.every((c, i) => Math.abs(c - expected[i]) <= tolerance)
  );
}
