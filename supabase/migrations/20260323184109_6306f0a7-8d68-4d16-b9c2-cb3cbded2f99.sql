
-- Create bill category enum
CREATE TYPE public.bill_category AS ENUM ('FIXA', 'FLUTUANTE');

-- Create bill status enum  
CREATE TYPE public.bill_status AS ENUM ('PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO');

-- Create bills table
CREATE TABLE public.bills (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    category bill_category NOT NULL,
    status bill_status NOT NULL DEFAULT 'PENDENTE',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    paid_amount NUMERIC,
    supplier TEXT,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_day INTEGER,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admin/manager can manage bills
CREATE POLICY "bills_select" ON public.bills
    FOR SELECT TO authenticated
    USING (can_access_tenant(auth.uid(), tenant_id) AND is_admin_or_manager(auth.uid()));

CREATE POLICY "bills_insert" ON public.bills
    FOR INSERT TO authenticated
    WITH CHECK (can_access_tenant(auth.uid(), tenant_id) AND is_admin_or_manager(auth.uid()));

CREATE POLICY "bills_update" ON public.bills
    FOR UPDATE TO authenticated
    USING (can_access_tenant(auth.uid(), tenant_id) AND is_admin_or_manager(auth.uid()));

CREATE POLICY "bills_delete" ON public.bills
    FOR DELETE TO authenticated
    USING (can_access_tenant(auth.uid(), tenant_id) AND is_admin(auth.uid()));
