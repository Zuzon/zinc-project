import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Native plugin of zinc-android (`ZincBackendPlugin.java`) that starts the
 * embedded Node backend on a loopback port.
 */
interface ZincBackendPlugin {
  /** Resolves once the backend is starting; the WebSocket reconnects until it listens. */
  connect(): Promise<{ url: string }>;
}

const ZincBackend = registerPlugin<ZincBackendPlugin>('ZincBackend');

/** Backend WebSocket URL inside the Android app, or `undefined` anywhere else. */
export async function connectCapacitorBackend(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }
  const { url } = await ZincBackend.connect();
  return url;
}
