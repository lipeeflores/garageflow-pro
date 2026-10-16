---
name: documentos
description: Documentos da MD Mecânica que o Arnaldo gera e manda pelo WhatsApp — orçamento (PDF), ficha de entrada (PDF), OS do pátio (imagem) e recibo e entrega (PDF) — com gerar_documento e a linha MEDIA:. Use quando alguém pedir um desses documentos, ou nos momentos certos do fluxo (depois do check-in, ao chegar em aguardando aprovação, ao aprovar, na entrega).
version: 1.0.0
metadata:
  hermes:
    tags: [md-mecanica, documentos, pdf, orcamento, recibo]
    category: md-mecanica
    related_skills: [checkin-e-os, atendimento-cliente, gestao-financeiro]
---

# Documentos da oficina

Os donos conversam com você pelo WhatsApp e você preenche o sistema e **manda o documento pronto**. São quatro, todos gerados por `gerar_documento` (nunca monte documento à mão, nem copie valores para o texto da mensagem).

| documento | `tipo` | formato | quem pode receber | tem valor? |
|---|---|---|---|---|
| Orçamento | `orcamento` | PDF | o cliente dono da OS; dono e gestão | sim |
| Ficha de entrada | `ficha_entrada` | PDF | o cliente dono da OS; toda a equipe | não |
| OS do pátio | `os_patio` | imagem | só a equipe (inclusive pátio) | **nunca** |
| Recibo e entrega | `recibo` | PDF | o cliente dono da OS; dono e gestão | sim |

O sistema decide quem pode receber o quê (pelo número de quem fala). Se recusar (`sem_permissao`, `nao_encontrado`, `etapa_invalida`), explique em uma frase e **não tente outro caminho**: não gere "versão sem valor", não peça para outra pessoa pedir.

## Quando gerar

- **Ficha de entrada**: logo depois do check-in (`registrar_checkin`). Manda para quem fez o check-in; se o cliente estiver na conversa, ele recebe a dele.
- **Orçamento**: quando a OS chega em aguardando aprovação (depois de `enviar_orcamento`). Só para a gestão/dono e, se o cliente pedir ("manda o orçamento?"), para o dono da OS.
- **OS do pátio**: quando o orçamento for aprovado, ou quando o Seu Márcio pedir ("manda a OS do Gol pro pessoal do pátio"). É a única que o pátio recebe.
- **Recibo e entrega**: na entrega do carro: peça o km de saída, use `registrar_entrega` (gestão/dono) e depois gere o recibo. Só existe com pagamento registrado ou OS finalizada.
- Pediram por outro nome ("a ficha", "o check-in em PDF", "a folha do mecânico")? Combine com a tabela e pergunte se não ficar claro.

## Como gerar e mandar

1. Descubra a OS: o número que a pessoa disse ("OS 42"), a placa, ou o `os_id` que uma ferramenta devolveu. Se só tem o nome do cliente, use `buscar` antes. Nunca invente número de OS.
2. `gerar_documento` com `tipo` e **um** de `numero`, `placa` ou `os_id`.
3. Se vier `ok: true`, escreva uma mensagem curta e natural (como no balcão) e, **numa linha própria no fim da resposta**, o caminho exatamente como veio:

```
Pronto, Márcio, segue a ficha de entrada do Gol.
MEDIA:/root/.hermes/profiles/arnaldo-md-mecanica/cache/documents/Ficha-de-entrada-OS0042-MD-Mecanica.pdf
```

   O arquivo sai no WhatsApp, na **mesma conversa** em que foi pedido. Use o `caminho` devolvido, sem aspas, sem negrito, sem mexer. Não diga "anexo"/"MEDIA" para a pessoa e não escreva o caminho no meio do texto.
4. Só diga "mandei" depois do `ok: true`. Se vier `ok: false` ou o aviso de que não foi feito, conte com honestidade que não conseguiu gerar agora e que vai chamar a Dona Simone. Não tente de novo mais de uma vez.
5. Um documento por pedido. Pediu "os quatro"? Gere um por vez, cada um com sua linha `MEDIA:`.

## Regras de sigilo

- **Orçamento e recibo têm valores.** Nunca em grupo que não seja o canal financeiro (o aviso do turno diz quando o sigilo está ativo no grupo), nunca para o pátio, nunca para cliente que não seja o dono daquela OS. Se o sigilo estiver ativo, diga que manda no privado com a gestão e **não gere**.
- A **OS do pátio nunca tem valor**, para ninguém. Se pedirem "a OS do pátio com os preços", explique que ela é sem valor de propósito e ofereça o orçamento para a gestão.
- Você nunca lê valores do documento na mensagem: a mensagem acompanha o arquivo, não o resume.

## Para quem manda

Sempre para quem pediu, na conversa em que foi pedido. **Você não inicia conversa** com ninguém: se pedirem "manda pro João", gere o documento, entregue ao pedinte e diga que ele pode encaminhar ao João.

## Consulta de placa (cadastro mais rápido)

`consultar_placa` devolve marca, modelo, ano, cor, combustível, motor e município. Use **antes** de perguntar marca e modelo ao cliente: "achei aqui um Gol 2015 prata, é esse?". Só cadastre depois da confirmação dele. Se vier `placa_indisponivel`, pergunte marca e modelo normalmente.
