// public/script.js (v7 - com cálculo de caminho de pasta mais robusto)
document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const form = document.getElementById('report-form');
    const medicaoFileInput = document.getElementById('medicao-file');
    const fotosFolderInput = document.getElementById('fotos-folder');
    const modeloFileInput = document.getElementById('modelo-file');
    const abaSelect = document.getElementById('aba-select');
    const submitBtn = document.getElementById('submit-btn');
    const statusSection = document.getElementById('status-section');
    const logOutput = document.getElementById('log-output');
    const statusTitle = document.getElementById('status-title');
    const resultSection = document.getElementById('result-section');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    
    // Elementos da barra de progresso
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    // Funções de UI
    const updateFileName = (input, nameElement) => {
        input.addEventListener('change', () => {
            if (input.files && input.files.length > 0) {
                nameElement.textContent = input.webkitdirectory ? `${input.files.length} fotos selecionadas` : input.files[0].name;
            }
        });
    };
    updateFileName(medicaoFileInput, document.getElementById('medicao-file-name'));
    updateFileName(fotosFolderInput, document.getElementById('fotos-folder-name'));
    updateFileName(modeloFileInput, document.getElementById('modelo-file-name'));
    medicaoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        abaSelect.disabled = true; abaSelect.innerHTML = '<option>A ler...</option>';
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                abaSelect.innerHTML = '';
                workbook.SheetNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name; option.textContent = name;
                    abaSelect.appendChild(option);
                });
                abaSelect.disabled = false;
            } catch (error) { abaSelect.innerHTML = '<option>Erro ao ler</option>'; }
        };
        reader.readAsArrayBuffer(file);
    });

    // Função para adicionar logs na tela
    const log = (message, type = 'log') => {
        const timestamp = new Date().toLocaleTimeString();
        const logLine = document.createElement('div');
        logLine.className = type === 'error' ? 'text-red-400' : 'text-gray-300';
        logLine.textContent = `[${timestamp}] ${message}`;
        logOutput.appendChild(logLine);
        logOutput.scrollTop = logOutput.scrollHeight;
    };

    // --- ENVIO DOS DADOS ---
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!medicaoFileInput.files[0] || !fotosFolderInput.files[0] || !modeloFileInput.files[0]) return;
        
        // Reset UI
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'A processar...';
        statusSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        progressContainer.classList.add('hidden');
        progressBar.style.width = '0%';
        progressText.textContent = '';
        logOutput.innerHTML = '';
        log('A iniciar processo...');

        // --- LÓGICA CORRIGIDA E MAIS ROBUSTA PARA OBTER O CAMINHO DA PASTA RAIZ ---
        const firstFile = fotosFolderInput.files[0];
        const fullPath = firstFile.path; // Ex: C:\A\B\C\D.txt
        const relativePath = firstFile.webkitRelativePath; // Ex: C/D.txt

        // Normaliza as barras do caminho relativo para corresponder ao sistema operacional (Windows)
        const relativePathSystem = relativePath.replace(/\//g, '\\');

        // Encontra o índice onde o caminho relativo começa dentro do caminho completo.
        // Usamos lastIndexOf porque o caminho relativo é sempre o final do caminho completo.
        const relativeStartIndex = fullPath.lastIndexOf(relativePathSystem);

        let rootPath = '';
        // Verifica se o caminho relativo foi encontrado dentro do caminho completo
        if (relativeStartIndex > -1) {
            // A pasta raiz é a parte do caminho completo ANTES do início do caminho relativo.
            rootPath = fullPath.substring(0, relativeStartIndex);
        } else {
            // Fallback de emergência caso a lógica falhe.
            log('AVISO: Não foi possível determinar o caminho da pasta raiz automaticamente. Verifique a seleção.', 'error');
            // Como fallback, tentaremos usar o diretório do primeiro ficheiro, embora possa não ser a raiz.
            rootPath = fullPath.substring(0, fullPath.lastIndexOf('\\'));
        }

        // Remove a barra final, se houver, para garantir um caminho limpo
        rootPath = rootPath.replace(/[\/\\]$/, '');

        const data = {
            medicaoPath: medicaoFileInput.files[0].path,
            fotosPath: rootPath,
            modeloPath: modeloFileInput.files[0].path,
            aba: abaSelect.value
        };
        
        log(`Pasta de fotos raiz identificada como: ${rootPath}`);
        window.electronAPI.generateReport(data);
    });

    // --- RECEBIMENTO DE STATUS EM TEMPO REAL ---
    window.electronAPI.onPythonStatusUpdate((status) => {
        switch (status.type) {
            case 'log':
                log(status.message);
                break;
            case 'error':
                log(status.message, 'error');
                break;
            case 'progress':
                progressContainer.classList.remove('hidden');
                const percentage = status.total > 0 ? (status.value / status.total) * 100 : 0;
                progressBar.style.width = `${percentage}%`;
                progressText.textContent = status.message;
                break;
            case 'result':
                handleFinalResult(status);
                break;
        }
    });

    function handleFinalResult(result) {
        progressContainer.classList.add('hidden');
        resultSection.classList.remove('hidden');
        resultMessage.textContent = result.message;

        if (result.success) {
            resultSection.className = 'text-center p-6 rounded-lg success';
            resultTitle.textContent = 'Relatório Gerado com Sucesso!';
            if (result.file_path) {
                resultMessage.textContent += `\n\nArquivo salvo em: ${result.file_path}`;
            }
        } else {
            resultSection.className = 'text-center p-6 rounded-lg error';
            resultTitle.textContent = 'Falha na Geração do Relatório';
        }

        // Reabilita o botão
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Gerar Relatório';
    }
});
