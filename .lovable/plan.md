
# Plano de Redesign: Oficina com Kanban Completo

## Resumo da Mudança
Transformar a página Oficina de uma interface baseada em abas (Em Andamento, Aguardando, Qualidade) para um quadro Kanban visual completo com 10 colunas representando cada etapa do workflow, onde a primeira coluna "Check-in (Dia)" exibe os agendamentos do dia ao invés de ordens de serviço.

## Arquitetura do Novo Layout

```text
+----------------+----------------+----------------+----------------+----------------+
| CHECK-IN (DIA) | AGUARD. MECÂN. | EM DIAGNÓSTICO | AGUARD. ORÇAM. | AGUARD. APROV. |
|   (agenda)     |  (check-in ok) |                |                |                |
+----------------+----------------+----------------+----------------+----------------+
|   APROVADO     |  EM EXECUÇÃO   |   QUALIDADE    |   A ENTREGAR   |   FINALIZADO   |
|                |                |                |                |                |
+----------------+----------------+----------------+----------------+----------------+
```

## Detalhes Técnicos

### 1. Reestruturação das Colunas do Kanban

As colunas serão mapeadas da seguinte forma:

| Coluna | Fonte de Dados | workflow_step |
|--------|----------------|---------------|
| CHECK-IN (DIA) | Appointments do dia com status `AGENDADO` | N/A - usa appointments |
| AGUARD. MECÂNICO | Work Orders | `AGUARDANDO_CHECKIN` |
| EM DIAGNÓSTICO | Work Orders | `EM_DIAGNOSTICO` |
| AGUARD. ORÇAMENTO | Work Orders | `AGUARDANDO_ORCAMENTO` |
| AGUARD. APROVAÇÃO | Work Orders | `AGUARDANDO_APROVACAO` |
| APROVADO | Work Orders | `APROVADO` |
| EM EXECUÇÃO | Work Orders | `EM_EXECUCAO` |
| QUALIDADE | Work Orders | `EM_QUALIDADE` ou `AJUSTES` |
| A ENTREGAR | Work Orders | `PRONTO_PARA_RETIRADA` |
| FINALIZADO | Work Orders (hoje) | `FINALIZADO` |

### 2. Novos Componentes a Criar

**a) `src/components/oficina/KanbanColumn.tsx`**
- Componente reutilizável para cada coluna do Kanban
- Exibe ícone, título com cor específica e contagem de itens
- Área scrollável para os cards
- Estado vazio estilizado com ícone e texto "Coluna Vazia"

**b) `src/components/oficina/KanbanCard.tsx`**  
- Card compacto estilo referência: nome do cliente, modelo do veículo, placa em destaque
- Ícone de menu (três pontos) para ações rápidas
- Status visual e tempo de espera
- Botão de ação contextual único (ex: "Diagnóstico", "Pegar Serviço")

**c) `src/components/oficina/AppointmentKanbanCard.tsx`**
- Card específico para agendamentos na primeira coluna
- Exibe: nome do cliente, veículo, placa, horário agendado
- Botão "Chegou" para converter agendamento em OS
- Ao clicar, cria a OS automaticamente com status `AGUARDANDO_CHECKIN` e move para próxima coluna

### 3. Modificações em Arquivos Existentes

**a) `src/pages/Oficina.tsx`**
- Remover layout baseado em abas (Tabs)
- Remover seção de status dos boxes (será movida ou removida)
- Implementar grid horizontal scrollável para as colunas do Kanban
- Usar `useTodayAppointments()` para a primeira coluna
- Usar `useWorkOrders()` para as demais colunas

**b) `src/components/oficina/index.ts`**
- Exportar os novos componentes: `KanbanColumn`, `KanbanCard`, `AppointmentKanbanCard`

**c) `src/hooks/useAppointments.ts`**
- Adicionar função para converter appointment em work order
- Criar `useConvertAppointmentToWorkOrder()` que:
  1. Atualiza status do appointment para `CHEGOU`
  2. Cria nova work_order vinculada ao appointment_id
  3. Retorna o ID da OS criada

### 4. Fluxo de Criação de OS a partir da Agenda

```text
[Agendamento no dia] 
     |
     v
[Cliente chega → Clica "Chegou"]
     |
     v
[Sistema cria OS automaticamente]
  - customer_id: do appointment
  - vehicle_id: do appointment  
  - appointment_id: vincula à OS
  - workflow_step: AGUARDANDO_CHECKIN
  - initial_complaint: reason do appointment
     |
     v
[Card move para coluna "Aguard. Mecânico"]
     |
     v
[Mecânico clica "Pegar Serviço" → Abre Check-in]
```

### 5. Estilização Visual

- **Cores por coluna** (conforme imagem de referência):
  - Check-in: Branco/Neutro
  - Aguard. Mecânico: Amarelo (#EAB308)
  - Em Diagnóstico: Roxo (#8B5CF6)
  - Aguard. Orçamento: Laranja (#F97316)
  - Aguard. Aprovação: Verde (#22C55E)
  - Aprovado: Verde (#22C55E)
  - Em Execução: Laranja (#F97316)
  - Qualidade: Ciano (#06B6D4)
  - A Entregar: Rosa (#EC4899)
  - Finalizado: Roxo (#8B5CF6)

- **Cards**: Fundo escuro semi-transparente, borda sutil, hover com sombra
- **Colunas vazias**: Ícone centralizado com opacidade reduzida e texto "Coluna Vazia"

### 6. Layout Responsivo

- **Desktop**: Scroll horizontal para todas as 10 colunas, largura fixa por coluna (~200-240px)
- **Mobile**: Mesma estrutura, scroll lateral mais evidente
- **Altura**: Colunas ocupam altura disponível, cards em área scrollável

### 7. Botões de Ação por Etapa

| Coluna | Ação do Botão |
|--------|---------------|
| CHECK-IN (DIA) | "Chegou" → Cria OS |
| AGUARD. MECÂNICO | "Pegar Serviço" → Abre CheckinDialog |
| EM DIAGNÓSTICO | "Diagnóstico" → Navega para detalhes |
| AGUARD. ORÇAMENTO | "Orçamento" → Navega para detalhes |
| AGUARD. APROVAÇÃO | Sem botão (aguardando cliente) |
| APROVADO | "Iniciar" → Muda para EM_EXECUCAO |
| EM EXECUÇÃO | "Concluir" → Muda para EM_QUALIDADE |
| QUALIDADE | Sem botão (aguardando inspeção) |
| A ENTREGAR | "Entregar" → Navega para detalhes |
| FINALIZADO | "Ver" → Navega para detalhes |

## Arquivos a Serem Criados

1. `src/components/oficina/KanbanColumn.tsx`
2. `src/components/oficina/KanbanCard.tsx`  
3. `src/components/oficina/AppointmentKanbanCard.tsx`

## Arquivos a Serem Modificados

1. `src/pages/Oficina.tsx` (reescrita significativa)
2. `src/components/oficina/index.ts` (novos exports)
3. `src/hooks/useAppointments.ts` (novo hook de conversão)

## Benefícios da Nova Abordagem

1. **Visão completa do fluxo**: Todas as etapas visíveis simultaneamente
2. **Integração com agenda**: Primeiro passo é a chegada do cliente agendado
3. **Ações simplificadas**: Um botão por card, ação contextual clara
4. **Identificação por placa**: Placa em destaque como identificador principal
5. **Menos cliques**: Não precisa alternar entre abas
