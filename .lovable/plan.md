

## Plano: Zerar todos os dados do sistema

Vamos limpar todas as tabelas do banco de dados, removendo todos os registros para deixar o sistema como novo. A estrutura (tabelas, RLS, funções) será mantida.

### Ordem de exclusão (respeitando dependências de chaves estrangeiras)

1. **Tabelas dependentes primeiro:**
   - `ranking_penalties`
   - `ranking_scores`
   - `work_order_returns`
   - `work_order_quality`
   - `work_order_pricing`
   - `work_order_items`
   - `work_order_diagnostics`
   - `work_order_checkins`
   - `work_order_events`
   - `time_entries`
   - `payments`
   - `financial_entries`
   - `notifications`
   - `attachments`
   - `timeclock_events`

2. **Tabelas principais:**
   - `work_orders`
   - `appointments`
   - `vehicles`
   - `customers`

3. **Tabelas de usuário/tenant:**
   - `user_roles`
   - `profiles`
   - `tenants`
   - Usuários em `auth.users` (via Supabase Admin API)

### Resultado esperado
- Banco de dados vazio, sem nenhum registro
- Ao acessar `/auth`, o primeiro usuário registrado será automaticamente ADMIN (conforme trigger `handle_new_user`)
- Todas as configurações e estrutura de tabelas preservadas

### Observação
- Os arquivos no storage (bucket `attachments`) permanecerão — apenas os registros do banco serão removidos.

