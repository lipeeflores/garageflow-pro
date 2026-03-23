
-- Update RLS policies for PATIO role
DROP POLICY IF EXISTS work_orders_update ON public.work_orders;
CREATE POLICY work_orders_update ON public.work_orders
FOR UPDATE TO authenticated
USING (
  can_access_tenant(auth.uid(), tenant_id) 
  AND (
    is_admin_or_manager(auth.uid()) 
    OR (
      (is_mechanic(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'PATIO'))
      AND (
        current_mechanic_id = auth.uid() 
        OR workflow_step = 'AGUARDANDO_CHECKIN'::workflow_step
        OR workflow_step = 'CHECKIN_CONCLUIDO'::workflow_step
      )
    )
  )
);

DROP POLICY IF EXISTS work_orders_insert ON public.work_orders;
CREATE POLICY work_orders_insert ON public.work_orders
FOR INSERT TO authenticated
WITH CHECK (
  can_access_tenant(auth.uid(), tenant_id) 
  AND (
    is_admin_or_manager(auth.uid()) 
    OR is_mechanic(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'PATIO')
  )
);

-- Purge operational data for clean testing
DELETE FROM public.work_order_returns;
DELETE FROM public.work_order_quality;
DELETE FROM public.work_order_events;
DELETE FROM public.work_order_diagnostics;
DELETE FROM public.time_entries;
DELETE FROM public.payments;
DELETE FROM public.financial_entries;
DELETE FROM public.notifications;
DELETE FROM public.attachments;
DELETE FROM public.work_order_pricing;
DELETE FROM public.work_order_items;
DELETE FROM public.work_order_checkins;
DELETE FROM public.work_orders;
DELETE FROM public.appointments;
DELETE FROM public.ranking_penalties;
DELETE FROM public.ranking_scores;
