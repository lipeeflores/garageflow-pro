
-- Função para marcar agendamentos expirados como NAO_COMPARECEU
CREATE OR REPLACE FUNCTION public.mark_expired_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    UPDATE public.appointments
    SET status = 'NAO_COMPARECEU',
        updated_at = now()
    WHERE status = 'AGENDADO'
      AND scheduled_at < (CURRENT_DATE::timestamp with time zone);
END;
$$;
