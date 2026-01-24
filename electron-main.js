const { app, BrowserWindow, shell, session, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function resolveStaticPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, 'electron', 'app');
}

function loadVersionInfo() {
  try {
    const versionPath = app.isPackaged
      ? path.join(process.resourcesPath, 'version.json')
      : path.join(__dirname, 'electron', 'version.json');
    if (fs.existsSync(versionPath)) {
      const raw = fs.readFileSync(versionPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
}

function enforceCSP() {
  const csp = [
    "default-src 'self';",
    "base-uri 'self';",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' data: blob:;",
    "font-src 'self' data:;",
    "worker-src 'self' blob:;",
    "child-src 'self' blob:;",
    "connect-src 'none';",
    "object-src 'none';",
    "media-src 'none';",
    "frame-src 'none'"
  ].join(' ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = Object.assign({}, details.responseHeaders);
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url || '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('ws://') || url.startsWith('wss://')) {
      return callback({ cancel: true });
    }
    callback({});
  });
}

function setAppMenu(versionInfo) {
  const template = [
    { label: 'File', submenu: [{ role: 'quit' }] },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About CyberChef (Offline)',
          click: () => {
            const version = (versionInfo && versionInfo.version) ? `v${versionInfo.version}` : 'Unknown version';
            const message = `CyberChef ${version} (Offline)\n\n` +
              'This build is packaged as an Electron desktop app.\n' +
              "Network access is disabled via CSP (connect-src 'none').\n" +
              'All processing happens locally.';
            dialog.showMessageBox({ type: 'info', title: 'About CyberChef (Offline)', message, buttons: ['OK'] });
          }
        },
        { label: 'Check for Updates', click: () => shell.openExternal('https://github.com/gchq/CyberChef/releases') }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const basePath = resolveStaticPath();
  const versionInfo = loadVersionInfo();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#111',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  const titleVersion = (versionInfo && versionInfo.version) ? `v${versionInfo.version} ` : '';
  win.setTitle(`CyberChef ${titleVersion}(Offline)`);
  win.setMenu(null);
  win.loadFile(path.join(basePath, 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

app.disableHardwareAcceleration();

app.whenReady().then(() => {
  enforceCSP();
  const versionInfo = loadVersionInfo();
  setAppMenu(versionInfo);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
