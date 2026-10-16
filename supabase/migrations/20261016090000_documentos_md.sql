-- Documentos da MD (orçamento, ficha de entrada, OS do pátio, recibo): campos novos.
-- MIGRAÇÃO ADITIVA E IDEMPOTENTE: nada é apagado, renomeado nem tem o tipo alterado; pode ser aplicada duas vezes.

-- 1) OS: número sequencial por oficina, entrega, garantia e próxima revisão
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS numero integer,
  ADD COLUMN IF NOT EXISTS km_saida integer,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS garantia_ate date,
  ADD COLUMN IF NOT EXISTS proxima_revisao_km integer,
  ADD COLUMN IF NOT EXISTS proxima_revisao_data date;

-- 2) Check-in: estepe, macaco, chave de roda e avarias como campos próprios
--    (customer_items continua sendo os pertences)
ALTER TABLE public.work_order_checkins
  ADD COLUMN IF NOT EXISTS tem_estepe boolean,
  ADD COLUMN IF NOT EXISTS estado_estepe text,
  ADD COLUMN IF NOT EXISTS tem_macaco boolean,
  ADD COLUMN IF NOT EXISTS tem_chave_roda boolean,
  ADD COLUMN IF NOT EXISTS avarias text;

-- 3) Trigger do número: max(numero)+1 do tenant, sob lock por tenant (duas OS simultâneas não repetem número)
CREATE OR REPLACE FUNCTION public.set_work_order_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text));
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
      FROM public.work_orders
     WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER work_orders_set_numero
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_work_order_numero();

-- 4) Backfill das OS que já existem, por data de criação. Só preenche quem está sem número e continua
--    depois do maior número já usado no tenant (rodar de novo não renumera nada).
WITH sem_numero AS (
  SELECT id, tenant_id,
         row_number() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS rn
    FROM public.work_orders
   WHERE numero IS NULL
),
maior AS (
  SELECT tenant_id, MAX(numero) AS mx
    FROM public.work_orders
   GROUP BY tenant_id
)
UPDATE public.work_orders w
   SET numero = s.rn + COALESCE(m.mx, 0)
  FROM sem_numero s
  LEFT JOIN maior m ON m.tenant_id = s.tenant_id
 WHERE w.id = s.id;

-- 5) Um número por oficina
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_tenant_numero_key
  ON public.work_orders (tenant_id, numero);

-- 6) Faz a API REST enxergar as colunas novas sem esperar
NOTIFY pgrst, 'reload schema';
