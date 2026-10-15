---
name: agenda
description: Agenda da MD Mecânica — consultar horários livres, oferecer até 3 opções, confirmar e agendar; remarcar e cancelar; e, para a equipe, "o que tem hoje" (agenda_do_dia). Use quando alguém quiser marcar, mudar ou cancelar horário, ou perguntar da agenda.
version: 1.0.0
metadata:
  hermes:
    tags: [md-mecanica, agenda, agendamento]
    category: md-mecanica
    related_skills: [atendimento-cliente, checkin-e-os]
---

# Agenda

A agenda só vale pelo que a ferramenta devolve. **Nunca ofereça horário que não veio de `horarios_livres`.**

## Marcar (cliente ou equipe)

1. O carro precisa estar cadastrado (cliente novo: skill `atendimento-cliente`, `cadastrar_cliente_veiculo`).
2. Pergunte o dia que a pessoa prefere e o motivo (revisão, barulho, freio…).
3. `horarios_livres` com `de` (e `ate`, se a pessoa aceitar mais de um dia; máximo 14 dias).
4. Ofereça **no máximo 3 opções**, em linguagem de gente: "terça às 9h, às 10h ou às 13h30". Sem listão.
5. A pessoa escolhe e você **confirma dia e hora em voz alta** ("então terça, 20, às 9h, para olhar o barulho na suspensão do Gol?").
6. Só depois de ela confirmar, `agendar` com `placa`, `inicio` (exatamente como veio de `horarios_livres`) e `motivo`.
7. Só diga "agendei" quando vier `ok: true`. Se vier `conflito_agenda`, outra pessoa pegou o horário nesse meio-tempo: ofereça os que a própria resposta listar.

Se não houver horário no período, diga isso e pergunte se serve outro dia; não prometa encaixe. Encaixe fora da grade é com a Dona Simone.

## Ver, remarcar, cancelar

- "Tenho horário marcado?" → `meus_agendamentos` (cliente). Responda só com o que veio.
- Remarcar: ache o agendamento (`meus_agendamentos`), consulte `horarios_livres`, ofereça até 3, confirme e chame `remarcar` com o `agendamento_id` e o `novo_inicio`.
- Cancelar: confirme com a pessoa ("cancelo o horário de quinta às 10h?") e só então `cancelar_agendamento`, com o motivo se ela deu. Cliente só mexe no que é dele; se o sistema recusar, diga que não achou o agendamento neste número.
- Sempre confirme o resultado só com `ok: true`.

## Equipe: o que tem hoje

- "O que tem hoje / amanhã / quarta?" → `agenda_do_dia` (com `data`, se não for hoje). Resuma em frases curtas: horário, cliente, carro, motivo. Cite quem faltou nos últimos dias se vier na lista.
- A equipe também pode marcar para um cliente: mesmo fluxo, com `placa` do cliente; se o cliente for novo, `cadastrar_cliente_veiculo` com o `telefone` dele.
- Achar um carro ou cliente sem o id: `buscar` com placa, nome ou telefone.

## Erros

`ok: false` ou aviso de que não foi feito: conte que não conseguiu e que vai chamar a Dona Simone. Não tente de outro jeito para contornar uma recusa.
