#!/usr/bin/env bash
# Container md-gotenberg: Chromium dedicado a converter HTML em PDF/PNG para os documentos da MD
# (orçamento, ficha de entrada, OS do pátio, recibo). Quem chama é o MCP `oficina`, de dentro do
# hermes-agent-1, em http://md-gotenberg:3000. Sem porta publicada: só a rede docker responde.
#
# Idempotente: se já estiver rodando com a imagem certa, não faz nada; se existir parado ou com
# outra configuração, recria igual. Rodar NO servidor (com sudo/docker) ou do Windows:
#   ssh -i ~/.ssh/servidor_lipe lipeeflores@100.67.51.23 'bash -s' < hermes/server/md-gotenberg.sh
set -euo pipefail

NOME=md-gotenberg
IMAGEM=gotenberg/gotenberg:8
REDE=docker-stacks_default   # a mesma do hermes-agent-1
MEMORIA=1g
D="sudo docker"

if $D inspect "$NOME" >/dev/null 2>&1; then
  em_uso="$($D inspect -f '{{.Config.Image}}|{{.State.Running}}|{{.HostConfig.Memory}}|{{.HostConfig.RestartPolicy.Name}}|{{len .HostConfig.PortBindings}}' "$NOME")"
  if [ "$em_uso" = "$IMAGEM|true|1073741824|unless-stopped|0" ] \
     && $D inspect -f '{{json .NetworkSettings.Networks}}' "$NOME" | grep -q "\"$REDE\""; then
    echo "$NOME já está no ar e igual ao esperado; nada a fazer"
    exit 0
  fi
  echo "$NOME existe mas difere ($em_uso); recriando"
  $D rm -f "$NOME" >/dev/null
fi

$D pull -q "$IMAGEM" >/dev/null
$D run -d --name "$NOME" --network "$REDE" --restart unless-stopped --memory "$MEMORIA" "$IMAGEM" >/dev/null
echo "$NOME criado; aguardando ficar saudável"
for _ in $(seq 1 30); do
  if $D exec hermes-agent-1 curl -sf http://md-gotenberg:3000/health >/dev/null 2>&1; then
    echo "ok: /health responde de dentro do hermes-agent-1"
    exit 0
  fi
  sleep 1
done
echo "ERRO: $NOME não respondeu /health em 30 s" >&2
exit 1
