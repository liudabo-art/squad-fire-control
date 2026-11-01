const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('DesktopApp', {
  savePlan: content => ipcRenderer.invoke('plan:save', content),
  copyText: content => ipcRenderer.invoke('text:copy', content)
});
