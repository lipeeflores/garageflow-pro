#!/usr/bin/env python3
"""Ajusta o config.yaml do perfil arnaldo-md-mecanica para o MCP `oficina`.

NAO reinicia nada, NAO mexe em .env nem em PAUSA. Idempotente.
  - acrescenta mcp_servers.oficina (as variaveis ${ARNALDO_*} vem do .env do perfil, Parte C);
  - compression.threshold_tokens: 140000 -> 60000 (licao da Isabelle).

Uso (dentro do container):  python3 config_oficina.py /root/.hermes/profiles/arnaldo-md-mecanica/config.yaml
Faz backup config.yaml.bak-oficina-<carimbo>, valida com yaml.safe_load antes e depois e grava de forma atomica.
"""
import copy
import os
import shutil
import sys
import time

import yaml

OFICINA = {
    "command": "/root/.hermes/node/bin/node",
    "args": ["/root/.hermes/profiles/arnaldo-md-mecanica/mcp/oficina-mcp/server.mjs"],
    "env": {
        "ARNALDO_API_URL": "${ARNALDO_API_URL}",
        "ARNALDO_API_TOKEN": "${ARNALDO_API_TOKEN}",
        "ARNALDO_SUPABASE_ANON": "${ARNALDO_SUPABASE_ANON}",
        # 15/10: liga as ferramentas da fase 1 (28 no total). Ficou só no servidor e o deploy de
        # 16/10 apagou; sem ela o Arnaldo volta a ter só as ferramentas antigas no próximo reinício.
        "ARNALDO_ENABLE_P1": "1",
    },
    "timeout": 40,
    "connect_timeout": 30,
}


def aplicar(cfg: dict) -> dict:
    novo = copy.deepcopy(cfg)
    novo.setdefault("mcp_servers", {})["oficina"] = copy.deepcopy(OFICINA)
    novo.setdefault("compression", {})["threshold_tokens"] = 60000
    return novo


def main(caminho: str) -> int:
    with open(caminho, encoding="utf-8") as fh:
        antes = yaml.safe_load(fh)
    if not isinstance(antes, dict):
        print("config.yaml nao e um mapa YAML; nada foi alterado")
        return 1
    depois = aplicar(antes)
    if depois == antes:
        print("config.yaml ja esta ajustado; nada a fazer")
        return 0

    carimbo = time.strftime("%Y%m%d-%H%M%S")
    backup = f"{caminho}.bak-oficina-{carimbo}"
    shutil.copy2(caminho, backup)

    tmp = f"{caminho}.tmp-{os.getpid()}"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        yaml.safe_dump(depois, fh, sort_keys=False, allow_unicode=True, default_flow_style=False, width=80)
    with open(tmp, encoding="utf-8") as fh:
        relido = yaml.safe_load(fh)
    if relido != depois:
        os.remove(tmp)
        print("validacao falhou: o YAML gravado difere do esperado; config.yaml intacto")
        return 1
    # Tudo o que existia continua igual, fora as duas mudancas pedidas.
    esperado = copy.deepcopy(antes)
    esperado.setdefault("mcp_servers", {})["oficina"] = copy.deepcopy(OFICINA)
    esperado.setdefault("compression", {})["threshold_tokens"] = 60000
    if relido != esperado:
        os.remove(tmp)
        print("validacao falhou: diferenca inesperada; config.yaml intacto")
        return 1
    shutil.copymode(caminho, tmp)
    os.replace(tmp, caminho)
    print(f"ok: config.yaml atualizado; backup em {backup}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
