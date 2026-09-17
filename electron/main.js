const { app, BrowserWindow, shell, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const serve = require('electron-serve');
const { autoUpdater } = require('electron-updater');

// Setup electron-serve to serve the built Vite app
const loadURL = serve({ directory: path.join(process.resourcesPath, 'app') });

let mainWindow;
let tray = null;

// Protocol registry for OAuth (e.g. filetools://auth/callback?token=...)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('filetools', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('filetools');
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // Handle deep links in second instance (Windows)
    const url = commandLine.find(arg => arg.startsWith('filetools://'));
    if (url) {
      handleDeepLink(url);
    }
  });

  app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
    setupTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

function handleDeepLink(url) {
  if (!mainWindow) return;
  // Redirect frontend via IPC or executing script
  // e.g. filetools://auth/callback?token=123 -> /?token=123
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'auth' && (urlObj.pathname === '/callback' || urlObj.pathname === '/dashboard')) {
      const token = urlObj.searchParams.get('token');
      if (token) {
        mainWindow.webContents.executeJavaScript(`
          localStorage.setItem('token', '${token}');
          window.location.href = '/?token=${token}';
        `);
      }
    }
  } catch (error) {
    console.error('Invalid deep link:', error);
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#08080C',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // allow local files to make CORS requests if needed, though mostly handled by Vite
    }
  });

  // Hide the default menu bar for a cleaner look, or customize it
  mainWindow.setMenuBarVisibility(false);

  try {
    // Determine if we are in dev or prod
    if (process.env.NODE_ENV === 'development') {
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      // In production, load the built static files
      await loadURL(mainWindow);
    }
  } catch (error) {
    console.log('Error loading app:', error);
  }

  // Intercept links trying to open in _blank and use external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupTray() {
  // Option to add tray icon
  // tray = new Tray(path.join(__dirname, 'icon.ico'));
  // const contextMenu = Menu.buildFromTemplate([
  //   { label: 'Open FileTools Pro', click: () => { if(mainWindow) mainWindow.show(); } },
  //   { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }
  // ]);
  // tray.setToolTip('FileTools Pro');
  // tray.setContextMenu(contextMenu);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-status', 'Cập nhật có sẵn, đang tải xuống...');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-status', 'Tải xuống hoàn tất, sẽ cài đặt khi thoát ứng dụng.');
  });

  // Only check in production
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify().catch(console.error);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
