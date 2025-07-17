# main_cli.py
# -*- coding: utf-8 -*-
# Descrição: Ponto de entrada que chama a lógica e reporta o status. (v6 - com correção de import)

import sys
import os
import json
from pathlib import Path

# --- CORREÇÃO PARA O EMPACOTAMENTO ---
# Adiciona o diretório do script ao caminho do Python.
# Isto garante que o 'report_logic.py' pode ser importado quando
# o programa está a ser executado a partir do pacote de instalação.
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)
# --- FIM DA CORREÇÃO ---

import report_logic

def send_status(log_type, message, **kwargs):
    """Helper function to print status updates as JSON strings."""
    status = {"type": log_type, "message": message, **kwargs}
    print(json.dumps(status, ensure_ascii=False))
    sys.stdout.flush()

def main():
    try:
        sys.stdin.reconfigure(encoding='utf-8')
        input_data_str = sys.stdin.read()
        input_data = json.loads(input_data_str)
        
        report_logic.processar_relatorio(
            caminho_medicao=Path(input_data['medicaoPath']),
            aba_medicao=input_data['aba'],
            dir_fotos=Path(input_data['fotosPath']),
            caminho_modelo_excel=Path(input_data['modeloPath']),
            status_callback=send_status
        )

    except Exception as e:
        send_status("result", f"Uma exceção não tratada ocorreu no executor: {e}", success=False)

if __name__ == '__main__':
    main()
