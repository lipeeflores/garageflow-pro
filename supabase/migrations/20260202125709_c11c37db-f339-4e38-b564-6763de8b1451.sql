-- =============================================
-- GARAGE BOX PRO - Complete Database Schema
-- =============================================

-- 1. Create custom types (ENUMs)
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('ADMIN', 'MANAGER', 'MECHANIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.appointment_status AS ENUM ('AGENDADO', 'CHEGOU', 'NAO_COMPARECEU', 'REMARCADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.workflow_step AS ENUM (
        'AGUARDANDO_CHECKIN',
        'CHECKIN_CONCLUIDO',
        'EM_DIAGNOSTICO',
        'AGUARDANDO_ORCAMENTO',
        'AGUARDANDO_APROVACAO',
        'APROVADO',
        'EM_EXECUCAO',
        'EM_QUALIDADE',
        'AJUSTES',
        'PRONTO_PARA_RETIRADA',
        'FINALIZADO',
        'CANCELADO'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.fuel_level AS ENUM ('RESERVA', 'QUARTO', 'METADE', 'TRES_QUARTOS', 'COMPLETO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.item_type AS ENUM ('SERVICE', 'PART');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.time_entry_type AS ENUM ('DIAGNOSIS', 'EXECUTION', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.work_order_type AS ENUM ('NORMAL', 'RETORNO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM ('PIX', 'CARTAO', 'DINHEIRO', 'MARCAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.financial_entry_type AS ENUM ('RECEITA', 'DESPESA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.timeclock_event_type AS ENUM ('ENTRADA', 'SAIDA_ALMOCO', 'RETORNO_ALMOCO', 'SAIDA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.notification_type AS ENUM ('ORCAMENTO_PENDENTE', 'QC_PENDENTE', 'OS_APROVADA', 'CARRO_LIBERADO', 'ATRASO_AGENDAMENTO', 'LEMBRETE_AGENDAMENTO', 'DIAGNOSTICO_INICIADO', 'NOVA_OS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.priority_level AS ENUM ('BAIXA', 'MEDIA', 'ALTA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.quality_status AS ENUM ('APROVADO', 'DEVOLVIDO_AJUSTES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.box_location AS ENUM ('BOX_1', 'BOX_2', 'BOX_3', 'BOX_4', 'PATIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.attachment_type AS ENUM ('CHECKIN_PHOTO', 'DIAGNOSIS_PHOTO', 'DIAGNOSIS_AUDIO', 'EXECUTION_PHOTO', 'TIMECLOCK_PHOTO', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create tenants table (multi-tenant base)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    phone TEXT,
    default_start_time TIME DEFAULT '08:00',
    default_lunch_start TIME DEFAULT '12:00',
    default_lunch_end TIME DEFAULT '13:00',
    default_end_time TIME DEFAULT '18:00',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create user_roles table (separate from profiles for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- 5. Create customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    cpf_cnpj TEXT,
    address TEXT,
    internal_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, phone_number)
);

-- 6. Create vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
    plate TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    color TEXT,
    chassis TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, plate)
);

-- 7. Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    status public.appointment_status NOT NULL DEFAULT 'AGENDADO',
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Create work_orders table (main entity)
CREATE TABLE IF NOT EXISTS public.work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL NOT NULL,
    workflow_step public.workflow_step NOT NULL DEFAULT 'AGUARDANDO_CHECKIN',
    order_type public.work_order_type DEFAULT 'NORMAL',
    original_work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    current_mechanic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    box_location public.box_location,
    initial_complaint TEXT,
    priority public.priority_level DEFAULT 'MEDIA',
    expected_delivery_date DATE,
    total_amount NUMERIC(10,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Create work_order_events table (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.work_order_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT,
    actor_id UUID REFERENCES auth.users(id),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Create attachments table (file metadata)
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_type TEXT,
    file_size INTEGER,
    attachment_type public.attachment_type NOT NULL DEFAULT 'OTHER',
    parent_type TEXT,
    parent_id UUID,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Create work_order_checkins table
CREATE TABLE IF NOT EXISTS public.work_order_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
    mechanic_id UUID REFERENCES auth.users(id),
    km_current INTEGER NOT NULL,
    fuel_level public.fuel_level NOT NULL,
    customer_items TEXT,
    observations TEXT,
    checked_in_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Create work_order_diagnostics table
CREATE TABLE IF NOT EXISTS public.work_order_diagnostics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    mechanic_id UUID REFERENCES auth.users(id) NOT NULL,
    technical_report TEXT NOT NULL,
    voice_memo_url TEXT,
    transcription_raw TEXT,
    transcription_refined TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Create work_order_items table (services and parts)
CREATE TABLE IF NOT EXISTS public.work_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    item_type public.item_type NOT NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    part_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Create work_order_pricing table (ONLY admin/manager can see)
CREATE TABLE IF NOT EXISTS public.work_order_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_item_id UUID REFERENCES public.work_order_items(id) ON DELETE CASCADE NOT NULL UNIQUE,
    unit_cost NUMERIC(10,2) DEFAULT 0,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Create work_order_quality table
CREATE TABLE IF NOT EXISTS public.work_order_quality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    manager_id UUID REFERENCES auth.users(id) NOT NULL,
    status public.quality_status NOT NULL,
    notes TEXT,
    inspected_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. Create time_entries table (for ranking)
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES auth.users(id) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    entry_type public.time_entry_type NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    paid_at TIMESTAMPTZ DEFAULT now(),
    processed_by UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 18. Create financial_entries table
CREATE TABLE IF NOT EXISTS public.financial_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    entry_type public.financial_entry_type NOT NULL,
    description TEXT,
    category TEXT,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. Create timeclock_events table (digital punch clock)
CREATE TABLE IF NOT EXISTS public.timeclock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES auth.users(id) NOT NULL,
    event_type public.timeclock_event_type NOT NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    photo_attachment_id UUID REFERENCES public.attachments(id) ON DELETE SET NULL,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 20. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES auth.users(id),
    notification_type public.notification_type NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    is_sound_played BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 21. Create ranking_scores table
CREATE TABLE IF NOT EXISTS public.ranking_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES auth.users(id) NOT NULL,
    month DATE NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    generated_labor_value NUMERIC(10,2) DEFAULT 0,
    completed_os_count INTEGER DEFAULT 0,
    avg_time_per_os_minutes NUMERIC(8,2) DEFAULT 0,
    total_work_time_minutes INTEGER DEFAULT 0,
    return_penalty_points INTEGER DEFAULT 0,
    punctuality_penalty_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, profile_id, month)
);

-- 22. Create ranking_penalties table
CREATE TABLE IF NOT EXISTS public.ranking_penalties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    profile_id UUID REFERENCES auth.users(id) NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    penalty_points INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 23. Create work_order_returns table
CREATE TABLE IF NOT EXISTS public.work_order_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    original_work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    return_work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    mechanic_blamed_id UUID REFERENCES auth.users(id),
    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = $1 LIMIT 1;
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, required_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = $1 AND role = $2
    );
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role($1, 'ADMIN');
$$;

-- Function to check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role($1, 'MANAGER');
$$;

-- Function to check if user is mechanic
CREATE OR REPLACE FUNCTION public.is_mechanic(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role($1, 'MECHANIC');
$$;

-- Function to check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = $1 AND role IN ('ADMIN', 'MANAGER')
    );
$$;

-- Function to check tenant access
CREATE OR REPLACE FUNCTION public.can_access_tenant(user_id UUID, resource_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = $1 AND tenant_id = $2
    );
$$;

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeclock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_returns ENABLE ROW LEVEL SECURITY;

-- TENANTS policies (only admin can manage)
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), id));

CREATE POLICY "tenants_insert" ON public.tenants FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "tenants_update" ON public.tenants FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()) AND public.can_access_tenant(auth.uid(), id));

CREATE POLICY "tenants_delete" ON public.tenants FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()) AND public.can_access_tenant(auth.uid(), id));

-- PROFILES policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- USER_ROLES policies
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated
    USING (public.is_admin(auth.uid()));

-- CUSTOMERS policies
CREATE POLICY "customers_select" ON public.customers FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "customers_insert" ON public.customers FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "customers_update" ON public.customers FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "customers_delete" ON public.customers FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin(auth.uid()));

-- VEHICLES policies
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "vehicles_insert" ON public.vehicles FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "vehicles_update" ON public.vehicles FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "vehicles_delete" ON public.vehicles FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin(auth.uid()));

-- APPOINTMENTS policies
CREATE POLICY "appointments_select" ON public.appointments FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "appointments_delete" ON public.appointments FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin(auth.uid()));

-- WORK_ORDERS policies
CREATE POLICY "work_orders_select" ON public.work_orders FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_orders_insert" ON public.work_orders FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_orders_update" ON public.work_orders FOR UPDATE TO authenticated
    USING (
        public.can_access_tenant(auth.uid(), tenant_id) AND (
            public.is_admin_or_manager(auth.uid()) OR
            (public.is_mechanic(auth.uid()) AND current_mechanic_id = auth.uid())
        )
    );

CREATE POLICY "work_orders_delete" ON public.work_orders FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin(auth.uid()));

-- WORK_ORDER_EVENTS policies (immutable - no update/delete)
CREATE POLICY "work_order_events_select" ON public.work_order_events FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_events_insert" ON public.work_order_events FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

-- ATTACHMENTS policies
CREATE POLICY "attachments_select" ON public.attachments FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "attachments_insert" ON public.attachments FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "attachments_delete" ON public.attachments FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (uploaded_by = auth.uid() OR public.is_admin_or_manager(auth.uid())));

-- WORK_ORDER_CHECKINS policies
CREATE POLICY "work_order_checkins_select" ON public.work_order_checkins FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_checkins_insert" ON public.work_order_checkins FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_checkins_update" ON public.work_order_checkins FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (mechanic_id = auth.uid() OR public.is_admin_or_manager(auth.uid())));

-- WORK_ORDER_DIAGNOSTICS policies
CREATE POLICY "work_order_diagnostics_select" ON public.work_order_diagnostics FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_diagnostics_insert" ON public.work_order_diagnostics FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_diagnostics_update" ON public.work_order_diagnostics FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (mechanic_id = auth.uid() OR public.is_admin_or_manager(auth.uid())));

-- WORK_ORDER_ITEMS policies (mechanics can see, but not prices)
CREATE POLICY "work_order_items_select" ON public.work_order_items FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_items_insert" ON public.work_order_items FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_items_update" ON public.work_order_items FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_order_items_delete" ON public.work_order_items FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- WORK_ORDER_PRICING policies (CRITICAL: mechanics cannot see!)
CREATE POLICY "work_order_pricing_select" ON public.work_order_pricing FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_order_pricing_insert" ON public.work_order_pricing FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_order_pricing_update" ON public.work_order_pricing FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_order_pricing_delete" ON public.work_order_pricing FOR DELETE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin(auth.uid()));

-- WORK_ORDER_QUALITY policies
CREATE POLICY "work_order_quality_select" ON public.work_order_quality FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_quality_insert" ON public.work_order_quality FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "work_order_quality_update" ON public.work_order_quality FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- TIME_ENTRIES policies
CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "time_entries_update" ON public.time_entries FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (profile_id = auth.uid() OR public.is_admin_or_manager(auth.uid())));

-- PAYMENTS policies (only admin/manager)
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- FINANCIAL_ENTRIES policies (only admin/manager)
CREATE POLICY "financial_entries_select" ON public.financial_entries FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "financial_entries_insert" ON public.financial_entries FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "financial_entries_update" ON public.financial_entries FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- TIMECLOCK_EVENTS policies
CREATE POLICY "timeclock_events_select" ON public.timeclock_events FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "timeclock_events_insert" ON public.timeclock_events FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

-- NOTIFICATIONS policies
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (recipient_id = auth.uid() OR recipient_id IS NULL OR public.is_admin_or_manager(auth.uid())));

CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND (recipient_id = auth.uid() OR public.is_admin_or_manager(auth.uid())));

-- RANKING_SCORES policies
CREATE POLICY "ranking_scores_select" ON public.ranking_scores FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "ranking_scores_insert" ON public.ranking_scores FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "ranking_scores_update" ON public.ranking_scores FOR UPDATE TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- RANKING_PENALTIES policies
CREATE POLICY "ranking_penalties_select" ON public.ranking_penalties FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "ranking_penalties_insert" ON public.ranking_penalties FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- WORK_ORDER_RETURNS policies
CREATE POLICY "work_order_returns_select" ON public.work_order_returns FOR SELECT TO authenticated
    USING (public.can_access_tenant(auth.uid(), tenant_id));

CREATE POLICY "work_order_returns_insert" ON public.work_order_returns FOR INSERT TO authenticated
    WITH CHECK (public.can_access_tenant(auth.uid(), tenant_id) AND public.is_admin_or_manager(auth.uid()));

-- =============================================
-- TRIGGERS FOR AUDIT AND AUTOMATION
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_order_pricing_updated_at BEFORE UPDATE ON public.work_order_pricing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ranking_scores_updated_at BEFORE UPDATE ON public.ranking_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log work order events
CREATE OR REPLACE FUNCTION public.log_work_order_event()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_work_order_changes
    AFTER UPDATE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.log_work_order_event();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;