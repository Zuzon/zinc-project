// Sandboxed preload: the only bridge between the renderer and the main process.
import { contextBridge, ipcRenderer } from 'electron';
import { BACKEND_PORT, CONNECT_BACKEND } from './ipc.js';

contextBridge.exposeInMainWorld('zincHost', {
  connectBackend: () => ipcRenderer.send(CONNECT_BACKEND),
});

// Ports cannot cross contextBridge; hand them to the main world by postMessage.
ipcRenderer.on(BACKEND_PORT, (event) => {
  window.postMessage(BACKEND_PORT, '*', event.ports);
});
