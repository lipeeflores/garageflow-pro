---
name: checkin-e-os
description: Pátio e equipe da MD Mecânica — abrir a OS (abrir_os), fazer o check-in de entrada com fotos (registrar_checkin, anexar_foto), diagnóstico, itens de serviço e peças, mover a etapa, atribuir mecânico e box, e conferir o combo de peças. Use quando a equipe (dono, gestão, pátio) falar de um carro que chegou ou de uma OS.
version: 1.0.0
metadata:
  hermes:
    tags: [md-mecanica, os, checkin, patio]
    category: md-mecanica
    related_skills: [agenda, gestao-financeiro]
---

# Check-in e ordem de serviço (equipe)

Só para quem o aviso do turno diz DONO, GESTÃO ou PÁTIO. **Sem valor para o pátio**: o sistema já tira o dinheiro das respostas dele; se perguntarem preço, "valor quem passa é a Dona Simone".

Tudo é registrado por ferramenta. Só confirme algo à equipe quando a ferramenta devolver `ok: true`.

## 1. Receber o carro (check-in)

1. Identifique o carro: `buscar` (placa, nome ou telefone) ou `ver_os` com a placa. Cliente/carro novo: `cadastrar_cliente_veiculo` (com o `telefone` do cliente, que a equipe informa).
2. Se a pessoa chegou com horário marcado, ache o agendamento em `agenda_do_dia`.
3. **Abra a OS**: `abrir_os` com `placa`, `queixa` (nas palavras do cliente) e `agendamento_id` se houver (o agendamento vira "chegou"). Prioridade e previsão só se a equipe disser. Antes, confirme que não existe OS aberta do mesmo carro (`ver_os`).
4. Conduza a vistoria, **uma coisa por vez**:
   1. Nome do cliente, placa, modelo e ano.
   2. Quilometragem do painel.
   3. Nível de combustível (reserva, 1/4, meio, 3/4, cheio).
   4. Estepe, macaco e chave de roda: tem, não tem, estado.
   5. Pertences dentro do carro (documentos, som, cadeirinha, ferramenta) e o que fica.
   6. Fotos em volta (frente, traseira, duas laterais) e de perto de cada avaria já existente.
   7. O que o cliente relatou.
5. Confirme o resumo com quem faz o check-in.
6. **Registre**: `registrar_checkin` com `os_id`, `km`, `combustivel` (RESERVA, QUARTO, METADE, TRES_QUARTOS, COMPLETO), `pertences` (estepe/macaco/pertences) e `observacoes` (avarias e relato). Cada OS tem um único check-in; se o sistema disser que já existe, não tente de novo.
7. **Fotos**: cada foto que chegar no WhatsApp durante o check-in vai com `anexar_foto` (`os_id`, `tipo` CHECKIN_PHOTO, `caminho_imagem` = o caminho do arquivo que o Hermes mostrou para a imagem, exatamente como veio, e `legenda` curta, ex.: "lateral esquerda, risco na porta"). Foto de diagnóstico: DIAGNOSIS_PHOTO; de serviço feito: EXECUTION_PHOTO. Só diga "anexei" com `ok: true`.

## 2. Diagnóstico e itens

- Mecânico passou o laudo: `registrar_diagnostico` com as palavras dele, sem inventar. A OS passa a aguardar orçamento.
- Serviços e peças: `adicionar_itens` (tipo SERVICE ou PART, descrição, quantidade, código se tiver). **Sem preço**: preço é da gestão.
- **Confira o combo antes de adicionar.** Se o pedido não fecha, pergunte como colega ("o disco tá na lista, leva pastilha junto ou já trocou?"): disco sem pastilha (e vice-versa); radiador, bomba d'água ou válvula termostática sem aditivo; correia dentada sem tensor/rolamento (e sem bomba d'água quando o motor pede); amortecedor sem kit de batente e coifa; embreagem em peça avulsa em vez do kit; junta de cabeçote sem parafuso novo; óleo sem filtro. Peça que não bate com o defeito descrito: confirme o sintoma.

## 3. Andar com a OS

- `ver_os` (por `os_id` ou placa) mostra check-in, diagnósticos, itens e últimos eventos.
- `mover_etapa` com `os_id`, `etapa` e `observacao` (fica no histórico). O pátio anda só nas etapas do pátio: check-in concluído, em diagnóstico, aguardando orçamento, em execução, em qualidade, e de ajustes de volta para execução. Aprovar orçamento, finalizar e cancelar são da gestão e do dono. Se o sistema recusar a etapa, explique à equipe quem pode e não tente de outro jeito.
- `atribuir`: mecânico responsável (nome como a pessoa falou) e/ou box (BOX_1 a BOX_4, PATIO). Nome que casa com mais de um: pergunte qual.

## 4. Fala com o pátio

Resposta rápida e prática (viva-voz, mão suja). OS, checklist, peças a instalar, prazo, box e prioridade: pode tudo. Valor, orçamento, desconto, margem: nada.

## Erros

`ok: false` ou aviso de que não foi feito: diga à equipe o que não foi, sem inventar que foi. Para a pessoa errada pedindo ação que só a gestão faz: explique e indique a Dona Simone.
