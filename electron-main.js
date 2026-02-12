// This file lives OUTSIDE the desktop/ folder so require('electron')
// resolves to the built-in Electron module, not the npm package.
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Set AppUserModelId so Windows taskbar pinning works correctly
app.setAppUserModelId('com.orionvoice.app');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const isDev = !app.isPackaged;
const BACKEND_PORT = 8432;

function createWindow() {
  const iconPath = path.join(__dirname, 'desktop', 'assets', 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1100, height: 720, minWidth: 860, minHeight: 560,
    frame: false,
    backgroundColor: '#0f0f13', show: false,
    icon: iconPath,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  mainWindow.loadFile(path.join(__dirname, 'desktop', 'dist', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) { e.preventDefault(); mainWindow.hide(); }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'desktop', 'assets', 'icon.ico');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('Orion Notes');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Orion Notes', click: () => { mainWindow?.show(); mainWindow?.focus(); }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; stopBackend(); app.quit(); }},
  ]));
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function findPython() {
  if (process.platform === 'win32') {
    // Try common Windows Python locations
    const fs = require('node:fs');
    const candidates = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
      'python',
    ];
    for (const candidate of candidates) {
      if (candidate === 'python') return candidate;
      try { if (fs.existsSync(candidate)) return candidate; } catch {}
    }
    return 'python';
  }
  return 'python3';
}

function startBackend() {
  const http = require('node:http');
  http.get(`http://127.0.0.1:${BACKEND_PORT}/api/config`, () => {}).on('error', () => {
    const py = findPython();
    backendProcess = spawn(py, ['-m', 'orion_voice', '--mode', 'server', '--port', String(BACKEND_PORT)], {
      cwd: __dirname, stdio: 'pipe',
    });
    backendProcess.on('error', (err) => console.error('Backend:', err.message));
  });
}

function stopBackend() {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
}

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

app.whenReady().then(() => { createWindow(); createTray(); startBackend(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') { stopBackend(); app.quit(); }});
app.on('before-quit', () => { app.isQuiting = true; stopBackend(); });
