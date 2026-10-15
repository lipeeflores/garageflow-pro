#!/usr/bin/env bash
# Poda das skills genericas do perfil do Arnaldo (apple, github, mlops...): so gastam token.
# MOVE (nao apaga) tudo que nao for md-mecanica para skills.removidas-<data>/ e antes gera
# skills.bak-<data>.tgz. Mesmo procedimento da Isabelle em 24/09.
#
# O Hermes pode recolocar skills de upstream a cada update: depois de qualquer `hermes update`,
# conferir a contagem (hermes/README.md) e rodar este script de novo.
set -euo pipefail

HOST="${HOST:-lipeeflores@100.67.51.23}"
KEY="${KEY:-$HOME/.ssh/servidor_lipe}"
P=/dados/hermes-agent-1/config/profiles/arnaldo-md-mecanica

ssh -i "$KEY" -o BatchMode=yes "$HOST" "sudo bash -s -- '$P'" <<'REMOTE'
set -euo pipefail
P="$1"
cd "$P"
D="$(TZ=America/Sao_Paulo date +%Y%m%d)"
echo "SKILL.md antes: $(find skills -name SKILL.md | wc -l)"
[ -e "skills.bak-$D.tgz" ] && { echo "skills.bak-$D.tgz ja existe; nada a fazer hoje (apague/renomeie para repetir)"; exit 0; }
tar czf "skills.bak-$D.tgz" skills
echo "backup: $P/skills.bak-$D.tgz"
mkdir -p "skills.removidas-$D"
# Fica: md-mecanica (as do Arnaldo) e productivity/rotinas-e-lembretes (skill propria da casa, nao e
# de upstream; ver memoria "Rotinas auto-ajustaveis"). O resto e generico.
for d in skills/*/; do
  nome="$(basename "$d")"
  [ "$nome" = "md-mecanica" ] && continue
  if [ "$nome" = "productivity" ]; then
    mkdir -p "skills.removidas-$D/productivity"
    for s in skills/productivity/*/; do
      sub="$(basename "$s")"
      [ "$sub" = "rotinas-e-lembretes" ] && continue
      mv "skills/productivity/$sub" "skills.removidas-$D/productivity/$sub"
    done
    for f in skills/productivity/*; do   # arquivos soltos da categoria (DESCRIPTION.md etc.) acompanham
      [ -f "$f" ] && mv "$f" "skills.removidas-$D/productivity/" || true
    done
    echo "podada (menos rotinas-e-lembretes): productivity"
    continue
  fi
  mv "skills/$nome" "skills.removidas-$D/$nome"
  echo "movida: $nome"
done
echo "SKILL.md depois: $(find skills -name SKILL.md | wc -l)"
ls skills
REMOTE
