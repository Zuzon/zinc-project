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

// jsdom has no Worker; the UI-state services never answer in component tests.
setCtx({
  mapView: { view$: NEVER, setView: () => of(undefined) },
} as unknown as Ctx);
