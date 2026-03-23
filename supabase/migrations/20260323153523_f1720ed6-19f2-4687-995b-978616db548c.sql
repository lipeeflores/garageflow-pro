
DROP POLICY IF EXISTS work_orders_update ON public.work_orders;
CREATE POLICY work_orders_update ON public.work_orders
FOR UPDATE TO authenticated
USING (
  can_access_tenant(auth.uid(), tenant_id) 
  AND (
    is_admin_or_manager(auth.uid()) 
    OR (
      is_mechanic(auth.uid()) 
      AND (
        current_mechanic_id = auth.uid() 
        OR workflow_step = 'AGUARDANDO_CHECKIN'::workflow_step
        OR workflow_step = 'CHECKIN_CONCLUIDO'::workflow_step
      )
    )
  )
);
