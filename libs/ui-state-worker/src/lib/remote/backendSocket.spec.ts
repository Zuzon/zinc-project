import { firstValueFrom } from 'rxjs';
import { MessagePortHandler } from 'rxjs-bridge';
import { UI_STATE_WORKER_INIT, isUiStateWorkerInit } from '../workerInit.js';
import {
  backendSocketUrl,
  backendUrl,
  createBackendHandler,
} from './backendSocket.js';

describe('backendSocketUrl', () => {
  it('uses the page host and a matching scheme', () => {
    expect(
      backendSocketUrl({ protocol: 'http:', host: 'localhost:4200' }),
    ).toBe('ws://localhost:4200/rx');
    expect(backendSocketUrl({ protocol: 'https:', host: 'zinc.local' })).toBe(
      'wss://zinc.local/rx',
    );
  });
});

describe('backendUrl', () => {
  const page = { protocol: 'https:', host: 'localhost' };

  it("prefers the native host's backend URL", () => {
    expect(backendUrl({ backendUrl: 'ws://127.0.0.1:4100/rx?t=x' }, page)).toBe(
      'ws://127.0.0.1:4100/rx?t=x',
    );
  });

  it("falls back to the page's origin", () => {
    expect(backendUrl({}, page)).toBe('wss://localhost/rx');
  });
});

describe('isUiStateWorkerInit', () => {
  it('accepts only the init message', () => {
    expect(isUiStateWorkerInit({ type: UI_STATE_WORKER_INIT })).toBe(true);
    expect(isUiStateWorkerInit({ type: 'other' })).toBe(false);
    expect(isUiStateWorkerInit({ service: 'map-view', id: -1 })).toBe(false);
    expect(isUiStateWorkerInit(null)).toBe(false);
  });
});

describe('createBackendHandler', () => {
  it('uses the host-provided port when there is one', async () => {
    const { port1, port2 } = new MessageChannel();
    const handler = createBackendHandler(
      { type: UI_STATE_WORKER_INIT, backendPort: port1 },
      { protocol: 'zinc:', host: 'app' },
    );
    expect(handler).toBeInstanceOf(MessagePortHandler);
    expect(await firstValueFrom(handler.connected$)).toBe(true);
    port1.close();
    port2.close();
  });
});
