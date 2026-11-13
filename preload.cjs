const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('license', {
  status: () => ipcRenderer.invoke('license-status'),
  activate: (key) => ipcRenderer.invoke('activate-license', key),
});
