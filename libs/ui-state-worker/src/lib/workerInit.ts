// Protocol between the UI thread and the UI-state worker; imported by both,
// so it must stay free of worker-only code.

/** First message the UI thread posts to the UI-state worker. */
export const UI_STATE_WORKER_INIT = 'zinc:ui-state-worker-init';

export interface UiStateWorkerInit {
  type: typeof UI_STATE_WORKER_INIT;
  /** Backend port handed over by a native host (Electron); absent in a browser. */
  backendPort?: MessagePort;
  /**
   * Backend WebSocket URL of a native host that runs it elsewhere (Android's
   * embedded Node on loopback); absent when the backend is the page's origin.
   */
  backendUrl?: string;
}

export function isUiStateWorkerInit(data: unknown): data is UiStateWorkerInit {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === UI_STATE_WORKER_INIT
  );
}
