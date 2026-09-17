const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value))
});
