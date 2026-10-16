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
"${SSH[@]}" "sudo bash -s -- '$TS' '$STAGE' '$P' '${FORCE:-0}'" <<'REMOTE'
set -euo pipefail
TS="$1"; S="$2"; P="$3"; FORCE="$4"
MANIFESTO="$P/.deploy-arnaldo.sha256"
mkdir -p /dados/backups

# Trava contra pisar edicao feita direto no servidor (ja aconteceu: 15/10, o deploy quase desfez o
# responder_tudo). O manifesto guarda o hash do que o ultimo deploy instalou; se o servidor mudou
# desde entao, aborta. Traga a mudanca para o repo (copie o arquivo do servidor) e rode de novo,
# ou use FORCE=1 se tiver certeza.
if [ -f "$MANIFESTO" ]; then
  if ! (cd "$P" && sha256sum -c --quiet "$MANIFESTO" >/tmp/deploy-arnaldo-divergencia.txt 2>&1); then
    echo "ATENCAO: arquivos do servidor mudaram desde o ultimo deploy:" >&2
    sed 's/: FAILED.*//' /tmp/deploy-arnaldo-divergencia.txt | grep -v "^sha256sum" >&2 || true
    if [ "$FORCE" != "1" ]; then
      echo "Abortado. Copie essas mudancas para o repo (hermes/) e rode de novo, ou FORCE=1 bash hermes/scripts/deploy-arnaldo.sh" >&2
      exit 3
    fi
    echo "FORCE=1: seguindo mesmo assim (o backup guarda a versao do servidor)" >&2
  fi
else
  echo "aviso: sem manifesto do ultimo deploy; nao deu para conferir edicoes feitas no servidor" >&2
fi
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

# Manifesto do que foi instalado agora (so codigo e texto do Arnaldo; nao entra .env, config.yaml nem equipe.json).
(cd "$P" && sha256sum SOUL.md plugins/md_arnaldo/*.py plugins/md_arnaldo/plugin.yaml mcp/oficina-mcp/*.mjs   mcp/oficina-mcp/templates/*.mjs skills/md-mecanica/*/SKILL.md > "$MANIFESTO")
echo "manifesto: $MANIFESTO ($(wc -l < "$MANIFESTO") arquivos)"
REMOTE

echo ">> npm ci (node do Hermes, dentro do container)"
"${SSH[@]}" "sudo docker exec -w /root/.hermes/profiles/arnaldo-md-mecanica/mcp/oficina-mcp hermes-agent-1 sh -c 'PATH=/root/.hermes/node/bin:\$PATH npm ci --omit=dev'"

echo ">> config.yaml (backup + validacao; nao reinicia nada)"
"${SSH[@]}" "sudo docker exec -i hermes-agent-1 python3 - /root/.hermes/profiles/arnaldo-md-mecanica/config.yaml" < "$HERE/scripts/config_oficina.py"

echo ">> limpando staging"
"${SSH[@]}" "rm -rf '$STAGE'"
echo ">> pronto. Verificacao: veja hermes/README.md (pytest, node --test, hermes mcp test oficina)."
