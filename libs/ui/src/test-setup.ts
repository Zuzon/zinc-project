import { vi } from 'vitest';

// jsdom has no ResizeObserver; OpenLayers creates one in the Map constructor.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  },
);
