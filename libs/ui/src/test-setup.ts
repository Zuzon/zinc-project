import { vi } from 'vitest';
import { NEVER, of } from 'rxjs';
import { type Ctx, setCtx } from '@zinc-project/ui-state';

// jsdom has no ResizeObserver; OpenLayers creates one in the Map constructor.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);

// jsdom's ElementInternals lacks form association, which Material Web buttons use.
for (const method of ['setFormValue', 'setValidity'] as const) {
  ElementInternals.prototype[method] ??= () => undefined;
}
Object.defineProperty(ElementInternals.prototype, 'form', {
  configurable: true,
  get: () => null,
});

// jsdom has no Worker; the UI-state services never answer in component tests.
setCtx({
  mapView: { view$: NEVER, setView: () => of(undefined) },
  mapLayers: {
    activeMap$: NEVER,
    canCycleMap$: NEVER,
    cycleMap: () => of(undefined),
  },
} as unknown as Ctx);
