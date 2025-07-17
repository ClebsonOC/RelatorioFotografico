// preload.js - Expõe APIs seguras para a interface (v2)

const { contextBridge, ipcRenderer } = require('electron');

// Expõe um objeto 'electronAPI' para a janela da interface (window.electronAPI)
contextBridge.exposeInMainWorld('electronAPI', {
  // Função para enviar dados do formulário para o processo principal do Electron
  generateReport: (data) => ipcRenderer.send('generate-report', data),
  
  // Função para receber as atualizações de status do processo principal
  onPythonStatusUpdate: (callback) => ipcRenderer.on('python-status-update', (_event, value) => callback(value))
});
