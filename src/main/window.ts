import { BrowserWindow } from 'electron';
import { join } from 'path';

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Always load from built files — the Vite dev server doesn't compile Tailwind v4
  // utilities. vite build --watch handles rebuilds with full CSS compilation.
  win.loadFile(join(__dirname, '../../renderer/index.html'));

  return win;
}
