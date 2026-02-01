const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const isDev = !app.isPackaged;
const BACKEND_PORT = 8432;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    transparent: false,
    backgroundColor: '#0f0f13',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  // Create a simple 16x16 tray icon programmatically
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Orion Voice',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate', '/settings');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true;
        stopBackend();
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Orion Voice');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function startBackend() {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const backendDir = path.join(__dirname, '../../backend');

  try {
    backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
      cwd: backendDir,
      stdio: 'pipe',
    });

    backendProcess.stdout?.on('data', (data) => {
      console.log(`[backend] ${data}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[backend] ${data}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err.message);
    });
  } catch (err) {
    console.error('Backend spawn error:', err);
  }
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// IPC handlers for window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

// Auto-start
ipcMain.handle('get-auto-start', () => {
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('set-auto-start', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return enabled;
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  startBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopBackend();
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  stopBackend();
});
