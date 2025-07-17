// main.js - Ponto de entrada da aplicação Electron (v3.2 - Final)
// Descrição: Gerencia a janela da aplicação e a comunicação com o script Python.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Verifica se a aplicação está a ser executada em modo de desenvolvimento ou empacotada
const isDev = !app.isPackaged;

/**
 * Cria e configura a janela principal da aplicação.
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Anexa o script de preload para comunicação segura entre o frontend e o backend
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // --- CAMINHO CORRIGIDO E SIMPLIFICADO ---
  // O caminho para o index.html é o mesmo em dev e em produção,
  // baseado na sua configuração do package.json.
  const indexPath = path.join(__dirname, 'src', 'public', 'index.html');
    
  mainWindow.loadFile(indexPath);

  // Abre as Ferramentas de Desenvolvedor automaticamente se estiver em modo de desenvolvimento
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Quando o Electron estiver pronto, cria a janela
app.whenReady().then(createWindow);

// Encerra a aplicação quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Recria a janela se o ícone da dock for clicado e não houver outras janelas abertas (macOS)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- COMUNICAÇÃO COM O PROCESSO PYTHON ---
// Ouve o evento 'generate-report' vindo da interface
ipcMain.on('generate-report', (event, data) => {
  console.log('[main.js] Recebido pedido para gerar relatório com os dados:', data);

  // Define o caminho para o executável do Python
  const pythonExecutable = isDev
    ? 'python' // Usa o Python instalado globalmente no sistema
    : path.join(process.resourcesPath, 'python-portable', 'python.exe'); // Usa o Python empacotado com a app

  // Define o caminho para o script Python principal
  const pythonScriptPath = isDev
    ? path.join(__dirname, 'src', 'python', 'main_cli.py')
    : path.join(process.resourcesPath, 'python', 'main_cli.py');
    
  // Define os argumentos para o script Python.
  // O caminho do script é o único argumento necessário.
  const args = [pythonScriptPath];

  console.log(`[main.js] A executar comando: ${pythonExecutable} ${args.join(' ')}`);

  // Inicia o processo Python de forma segura, sem usar o shell.
  // Isto evita problemas com espaços e caracteres especiais nos caminhos.
  const pyProcess = spawn(pythonExecutable, args);

  // --- GESTÃO DA SAÍDA DO PROCESSO PYTHON ---

  // Ouve a saída padrão (stdout) do Python
  let buffer = '';
  pyProcess.stdout.on('data', (dataChunk) => {
    buffer += dataChunk.toString();
    let boundary = buffer.indexOf('\n');
    while (boundary !== -1) {
        const line = buffer.substring(0, boundary).trim();
        buffer = buffer.substring(boundary + 1);
        if (line) {
            try {
                // Cada linha deve ser um JSON. Analisa e envia para a interface.
                const statusUpdate = JSON.parse(line);
                event.sender.send('python-status-update', statusUpdate);
            } catch (e) {
                console.error(`[main.js] Erro ao analisar linha JSON do Python: "${line}"`, e);
                event.sender.send('python-status-update', {type: 'error', message: `Erro ao processar saída do Python: ${line}`});
            }
        }
        boundary = buffer.indexOf('\n');
    }
  });

  // Ouve a saída de erro (stderr) do Python
  pyProcess.stderr.on('data', (dataChunk) => {
    const errorMessage = dataChunk.toString();
    console.error(`[main.js] Erro do Python (stderr): ${errorMessage}`);
    event.sender.send('python-status-update', {type: 'error', message: errorMessage});
  });

  // Lida com erros ao tentar iniciar o processo
  pyProcess.on('error', (err) => {
    console.error('[main.js] Falha ao iniciar o subprocesso Python.', err);
    event.sender.send('python-status-update', {type: 'error', message: `Falha ao iniciar o processo Python. Detalhes: ${err.message}`});
  });

  // Lida com o fecho do processo
  pyProcess.on('close', (code) => {
    console.log(`[main.js] Processo Python finalizado com código ${code}`);
    if (code !== 0 && code !== null) {
        // Envia uma mensagem de erro se o processo terminou com um código de erro.
        event.sender.send('python-status-update', {type: 'error', message: `Processo Python finalizou inesperadamente com código ${code}.`});
    }
  });

  // Envia os dados do formulário (JSON) para o stdin do processo Python
  pyProcess.stdin.write(JSON.stringify(data));
  pyProcess.stdin.end();
});
