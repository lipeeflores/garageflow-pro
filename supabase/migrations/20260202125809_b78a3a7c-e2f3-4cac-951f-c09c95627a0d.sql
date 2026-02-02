-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_work_order_event()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.workflow_step IS DISTINCT FROM NEW.workflow_step THEN
        INSERT INTO public.work_order_events (tenant_id, work_order_id, event_type, description, actor_id, old_data, new_data)
        VALUES (
            NEW.tenant_id,
            NEW.id,
            'WORKFLOW_STEP_CHANGE',
            'Status alterado de ' || OLD.workflow_step || ' para ' || NEW.workflow_step,
            auth.uid(),
            jsonb_build_object('workflow_step', OLD.workflow_step),
            jsonb_build_object('workflow_step', NEW.workflow_step)
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID;
BEGIN
    -- Get or create default tenant
    SELECT id INTO default_tenant_id FROM public.tenants WHERE slug = 'md-mecanica' LIMIT 1;
    
    IF default_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name, slug)
        VALUES ('MD Mecânica', 'md-mecanica')
        RETURNING id INTO default_tenant_id;
    END IF;
    
    -- Create profile
    INSERT INTO public.profiles (id, tenant_id, full_name, email)
    VALUES (
        NEW.id,
        default_tenant_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    
    -- Assign default role (MECHANIC) - first user becomes ADMIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE tenant_id = default_tenant_id) THEN
        INSERT INTO public.user_roles (user_id, tenant_id, role)
        VALUES (NEW.id, default_tenant_id, 'ADMIN');
    ELSE
        INSERT INTO public.user_roles (user_id, tenant_id, role)
        VALUES (NEW.id, default_tenant_id, 'MECHANIC');
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'attachments');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);