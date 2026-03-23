-- Permite que mecânicos registrem chegada do cliente e avancem a OS após check-in
DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  can_access_tenant(auth.uid(), tenant_id)
  AND (
    is_admin_or_manager(auth.uid())
    OR is_mechanic(auth.uid())
  )
);

DROP POLICY IF EXISTS work_orders_insert ON public.work_orders;
CREATE POLICY work_orders_insert
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (
  can_access_tenant(auth.uid(), tenant_id)
  AND (
    is_admin_or_manager(auth.uid())
    OR is_mechanic(auth.uid())
  )
);

DROP POLICY IF EXISTS work_orders_update ON public.work_orders;
CREATE POLICY work_orders_update
ON public.work_orders
FOR UPDATE
TO authenticated
USING (
  can_access_tenant(auth.uid(), tenant_id)
  AND (
    is_admin_or_manager(auth.uid())
    OR (
      is_mechanic(auth.uid())
      AND (
        current_mechanic_id = auth.uid()
        OR workflow_step = 'AGUARDANDO_CHECKIN'
      )
    )
  )
);