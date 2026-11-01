const { app, BrowserWindow, Menu, shell, dialog, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const entry = pathToFileURL(path.join(root, 'index.html')).href;
let mainWindow;

function trusted(event) {
  return event.sender === mainWindow?.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url.split('?')[0] === entry;
}
function external(url) {
  const licenseFiles = ['SquadCalc-LICENSE.txt', 'SquadMC-LICENSE.txt', 'Lucide-LICENSE.txt'];
  const license = licenseFiles.find(name => pathToFileURL(path.join(root, 'licenses', name)).href === url);
  if (license) {
    fs.readFile(path.join(root, 'licenses', license), 'utf8')
      .then(detail => dialog.showMessageBox(mainWindow, { type: 'info', title: '开源许可', message: license, detail, buttons: ['关闭'] }))
      .catch(() => dialog.showErrorBox('开源许可', '无法读取许可文件'));
    return;
  }
  try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch (_) {}
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440, height: 960, minWidth: 390, minHeight: 600, backgroundColor: '#111618',
    title: 'SQD Fire Control', icon: path.join(root, 'resources/icon.png'), show: !process.argv.includes('--smoke-test'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== entry) { event.preventDefault(); external(url); } });
  ipcMain.handle('plan:save', async (event, content) => {
    if (!trusted(event) || typeof content !== 'string' || content.length > 1024 * 1024) throw new Error('Invalid plan');
    JSON.parse(content);
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: 'sqd-fire-plan.json', filters: [{ name: 'Fire plan', extensions: ['json'] }] });
    if (result.canceled) return false;
    await fs.writeFile(result.filePath, content, 'utf8');
    return true;
  });
  ipcMain.handle('text:copy', (event, content) => {
    if (!trusted(event) || typeof content !== 'string' || content.length > 100000) throw new Error('Invalid clipboard content');
    clipboard.writeText(content);
    return true;
  });
  mainWindow.loadFile(path.join(root, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
