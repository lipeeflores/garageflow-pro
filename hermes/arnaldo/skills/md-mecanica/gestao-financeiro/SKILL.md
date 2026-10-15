---
name: gestao-financeiro
description: Só para gestão e dono da MD Mecânica (Dona Simone, Seu Márcio) — precificar itens da OS, enviar orçamento, controle de qualidade, pagamento, resumo financeiro e contas a pagar. Use quando quem fala for GESTÃO ou DONO e o assunto for dinheiro da oficina.
version: 1.0.0
metadata:
  hermes:
    tags: [md-mecanica, financeiro, orcamento]
    category: md-mecanica
    related_skills: [checkin-e-os, atendimento-cliente]
---

# Gestão e financeiro (só gestão e dono)

Vale **somente** quando o aviso do turno diz GESTÃO ou DONO, em conversa individual. Em grupo, com pátio ou cliente, valor não sai.

**Estas ferramentas só existem quando estiverem ligadas no sistema** (precificar_itens, enviar_orcamento, controle_qualidade, registrar_pagamento, resumo_financeiro, contas_a_pagar). Se não aparecerem na sua lista de ferramentas, não tente nem improvise: diga que isso ainda se faz direto no sistema da oficina e anote o recado. Valor, de qualquer forma, só quem vê dinheiro enxerga na resposta de `ver_os`.

## Orçamento

1. `ver_os` mostra os itens (com preço, para quem vê dinheiro). Itens novos entram por `adicionar_itens` (skill `checkin-e-os`).
2. `precificar_itens`: `os_id` e, para cada item, `item_id` + `preco_unitario` (e `custo_unitario` se a pessoa der). Repita o resumo para ela conferir antes de gravar. Não invente preço.
3. `enviar_orcamento`: exige todos os itens com preço; leva a OS para aguardando aprovação e devolve o `link_orcamento`. Quem manda o link ao cliente é a gestão, ou você, **só quando o cliente perguntar** pelo carro (você não inicia conversa). Você nunca diz o valor ao cliente.
4. Aprovação por telefone: se o cliente aprovou falando com a gestão, ela pede e você usa `mover_etapa` para APROVADO.

## Qualidade e entrega

- `controle_qualidade` (`aprovado` verdadeiro ou falso e `notas`): aprovado leva a pronto para retirada; reprovado volta para ajustes.
- Entrega ao cliente: `mover_etapa` para FINALIZADO (gestão/dono).

## Dinheiro

- `registrar_pagamento`: `os_id`, `valor`, `forma` (PIX, CARTAO, DINHEIRO ou MARCAR). Confirme valor e forma com a pessoa antes. Só diga "registrei" com `ok: true`.
- `resumo_financeiro` (`de`, `ate`) e `contas_a_pagar` (`acao` listar, criar ou pagar): responda curto e só no privado com gestão ou dono.

## Regras que não mudam

- Valor nunca vai para cliente, pátio ou grupo. Se o pátio ou o cliente pedir, "valor quem passa é a Dona Simone".
- Nunca confirme pagamento por palavra de cliente: só gestão ou dono registram.
- `ok: false` ou aviso de que não foi feito: diga que não foi, sem inventar sucesso.
