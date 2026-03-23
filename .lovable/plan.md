

## Problemas Identificados

### 1. Loop Infinito (Bug Principal)
`useAppointments(new Date())` e `useTodayAppointments()` criam um novo objeto `Date` a cada render. Como `new Date().toISOString()` muda a cada milissegundo, o `queryKey` muda constantemente, causando re-fetch infinito.

### 2. Agendamentos Sumindo Após o Horário
No `TodayAgenda` do WorkshopTV (linha 194-195), há um filtro `new Date(a.scheduled_at) > new Date()` que esconde agendamentos cujo horário já passou — o que está errado, pois clientes se atrasam.

### 3. Falta Lógica de "Não Compareceu" e Destaque no Dia Seguinte
Não existe lógica para marcar agendamentos expirados como "NAO_COMPARECEU" ao final do dia, nem para mostrá-los em destaque no dia seguinte.

---

## Plano de Implementação

### Passo 1 — Corrigir o loop infinito em `useAppointments`
**Arquivo:** `src/hooks/useAppointments.ts`

- Estabilizar o `queryKey` usando apenas a data no formato `YYYY-MM-DD` em vez de `date.toISOString()` (que muda a cada ms).
- Em `useTodayAppointments`, usar `useMemo` para estabilizar o objeto `Date`.

### Passo 2 — Corrigir o filtro no WorkshopTV `TodayAgenda`
**Arquivo:** `src/pages/WorkshopTV.tsx` (função `TodayAgenda`, linhas 191-237)

- Remover o filtro `new Date(a.scheduled_at) > new Date()` que esconde agendamentos passados.
- Mostrar todos os agendamentos do dia com status `AGENDADO`, independente do horário.
- Agendamentos com horário já passado exibem badge visual "Atrasado" em vermelho.

### Passo 3 — Mostrar todos os agendamentos do dia no Dashboard
**Arquivo:** `src/components/dashboard/TodaySchedule.tsx`

- Garantir que agendamentos com horário passado continuem visíveis na lista.
- Adicionar indicador visual vermelho para agendamentos atrasados (horário passou e status ainda AGENDADO).

### Passo 4 — Lógica de "Não Compareceu" + Destaque no dia seguinte
**Arquivo:** `src/hooks/useAppointments.ts`

- Criar novo hook `useTodayAndMissedAppointments` que busca:
  - Agendamentos de hoje com qualquer status
  - Agendamentos de dias anteriores com status `NAO_COMPARECEU` (para destaque)
- Na query da agenda do dia, incluir agendamentos `NAO_COMPARECEU` de ontem/dias anteriores com badge de destaque.

**Migração SQL:**
- Criar uma função de banco `mark_expired_appointments()` que roda via cron ou trigger para marcar agendamentos `AGENDADO` de dias passados como `NAO_COMPARECEU` automaticamente.

### Passo 5 — Visual de destaque para não comparecimentos
**Arquivos:** `TodaySchedule.tsx` e `WorkshopTV.tsx`

- Agendamentos `NAO_COMPARECEU` de dias anteriores aparecem com borda vermelha e badge "Não compareceu - Remarcar".
- Agendamentos atrasados (hoje, horário passou, status AGENDADO) ficam com badge "Atrasado" em amarelo/vermelho.

---

### Resumo Técnico

```text
useAppointments(date)
  queryKey: ['appointments', '2026-03-23']  ← estável (era ISO dinâmico)

TodayAgenda (WorkshopTV)
  Antes: filter(scheduled_at > now())  ← remove atrasados
  Depois: mostra todos do dia + NAO_COMPARECEU anteriores

SQL Cron/Trigger:
  UPDATE appointments SET status='NAO_COMPARECEU'
  WHERE status='AGENDADO' AND scheduled_at < início_do_dia_atual
```

