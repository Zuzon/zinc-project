// Electron main process: hosts the backend and opens the sandboxed UI window.
import { join } from 'node:path';
import { BrowserWindow, MessageChannelMain, app, ipcMain } from 'electron';
import { appDataDir } from '@zinc-project/backend';
import {
  APP_URL,
  handleAppProtocol,
  isAppUrl,
  registerAppScheme,
} from './appProtocol.js';
import { type DesktopBackend, startBackend } from './backend.js';
import { BACKEND_PORT, CONNECT_BACKEND } from './ipc.js';

/**
 * Files the DB worker thread loads must live outside the asar archive,
 * like the native module it requires.
 */
function unpacked(file: string): string {
  return join(__dirname, file).replace(
    /app\.asar(?=[\\/])/,
    'app.asar.unpacked',
  );
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e1e1e',
    icon: join(__dirname, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
    }
  });
  void win.loadURL(APP_URL);
  return win;
}

function run(): void {
  let backend: DesktopBackend | undefined;
  let window: BrowserWindow | undefined;

  app.on('second-instance', () => {
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  });

  // Every page load asks for its own port; the previous one closes with the page.
  ipcMain.on(CONNECT_BACKEND, (event) => {
    if (!backend || !event.senderFrame || !isAppUrl(event.senderFrame.url)) {
      return;
    }
    const { port1, port2 } = new MessageChannelMain();
    backend.connect(port1, `renderer:${event.sender.id}`);
    event.sender.postMessage(BACKEND_PORT, null, [port2]);
  });

  void app.whenReady().then(() => {
    backend = startBackend({
      dataDir: appDataDir(),
      dbWorkerFile: unpacked('db-worker.cjs'),
    });
    handleAppProtocol(backend.maps, join(__dirname, 'renderer'));
    window = createWindow();
    window.on('closed', () => (window = undefined));
  });

  app.on('window-all-closed', () => app.quit());

  let stopped = false;
  app.on('before-quit', (event) => {
    if (stopped || !backend) {
      return;
    }
    // Let the DB worker finish its writes before the process exits.
    event.preventDefault();
    stopped = true;
    void backend
      .destroy()
      .catch((err) => console.error('[main] backend shutdown failed', err))
      .finally(() => app.quit());
  });
}

registerAppScheme();
if (app.requestSingleInstanceLock()) {
  run();
} else {
  console.info('[main] already running; focusing the open window instead');
  app.quit();
}
