#!/usr/bin/env bash
# Deploy do Arnaldo (rodar do Windows, em Git Bash): copia SOUL, plugin md_arnaldo, MCP oficina e
# skills md-mecanica para o perfil arnaldo-md-mecanica no servidor, com backup antes.
#
# NAO reinicia gateway, NAO toca em .env nem em PAUSA, NUNCA faz rm -rf em skills/ (licao de 20/09).
# Idempotente. A poda das skills genericas e outro script (poda-skills-arnaldo.sh).
#
# Uso:  bash hermes/scripts/deploy-arnaldo.sh
set -euo pipefail

HOST="${HOST:-lipeeflores@100.67.51.23}"
KEY="${KEY:-$HOME/.ssh/servidor_lipe}"
P=/dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica
HERE="$(cd "$(dirname "$0")/.." && pwd)"           # .../hermes
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

# A hora do PC no Git Bash pode vir em UTC: o carimbo vem do servidor.
TS="$("${SSH[@]}" 'TZ=America/Sao_Paulo date +%Y%m%d-%H%M%S')"
STAGE="/tmp/arnaldo-deploy-$TS"
echo ">> carimbo $TS; staging $STAGE"

echo ">> enviando arquivos"
"${SSH[@]}" "mkdir -p '$STAGE'"
tar czf - -C "$HERE" \
    --exclude=__pycache__ --exclude=.pytest_cache --exclude=node_modules \
    arnaldo/SOUL.md arnaldo/skills/md-mecanica plugins/md_arnaldo mcp/oficina-mcp scripts/config_oficina.py \
  | "${SSH[@]}" "tar xzf - -C '$STAGE'"

echo ">> instalando no servidor (com backup)"
"${SSH[@]}" "sudo bash -s -- '$TS' '$STAGE' '$P'" <<'REMOTE'
set -euo pipefail
TS="$1"; S="$2"; P="$3"
mkdir -p /dados/backups
# Backup do que sera sobrescrito (so entra o que existe).
ITENS=()
for f in SOUL.md config.yaml .env plugins skills/md-mecanica mcp; do [ -e "$P/$f" ] && ITENS+=("$f"); done
tar czf "/dados/backups/arnaldo-$TS.tgz" -C "$P" "${ITENS[@]}"
echo "backup: /dados/backups/arnaldo-$TS.tgz (${ITENS[*]})"

cp "$S/arnaldo/SOUL.md" "$P/SOUL.md"
mkdir -p "$P/plugins/md_arnaldo" "$P/mcp/oficina-mcp" "$P/skills/md-mecanica"
cp -r "$S/plugins/md_arnaldo/." "$P/plugins/md_arnaldo/"
cp -r "$S/mcp/oficina-mcp/." "$P/mcp/oficina-mcp/"
cp -r "$S/arnaldo/skills/md-mecanica/." "$P/skills/md-mecanica/"
echo "arquivos copiados"
REMOTE

echo ">> npm ci (node do Hermes, dentro do container)"
"${SSH[@]}" "sudo docker exec -w /root/.hermes/profiles/arnaldo-md-mecanica/mcp/oficina-mcp hermes-agent-1 sh -c 'PATH=/root/.hermes/node/bin:\$PATH npm ci --omit=dev'"

echo ">> config.yaml (backup + validacao; nao reinicia nada)"
"${SSH[@]}" "sudo docker exec -i hermes-agent-1 python3 - /root/.hermes/profiles/arnaldo-md-mecanica/config.yaml" < "$HERE/scripts/config_oficina.py"

echo ">> limpando staging"
"${SSH[@]}" "rm -rf '$STAGE'"
echo ">> pronto. Verificacao: veja hermes/README.md (pytest, node --test, hermes mcp test oficina)."
