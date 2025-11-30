-- CPS230 Critical Operations Ecosystem Database Schema
-- This schema supports the management of processes, systems, critical operations, and controls
-- for APRA CPS230 compliance visualization and management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('user', 'business_analyst', 'promaster');

-- =====================================================
-- User Profiles Table
-- Extends Supabase auth.users with application-specific data
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Processes Table
-- Stores processes synced from Nintex Process Manager
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_name TEXT NOT NULL,
    process_unique_id TEXT NOT NULL UNIQUE, -- From Nintex Process Manager
    owner_username TEXT,
    input_processes TEXT[], -- Array of process IDs that feed into this process
    output_processes TEXT[], -- Array of process IDs that this process feeds into
    canvas_position JSONB, -- Stores x, y coordinates for BPMN canvas
    metadata JSONB, -- Additional metadata from Nintex
    regions TEXT[], -- Array of region identifiers (e.g., ['AU', 'UK', 'US'])
    modified_by TEXT NOT NULL,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Systems Table
-- Stores systems/applications used in processes
-- =====================================================
CREATE TABLE IF NOT EXISTS public.systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    system_name TEXT NOT NULL,
    system_id TEXT NOT NULL UNIQUE, -- From Nintex Process Manager
    description TEXT,
    metadata JSONB, -- Additional metadata
    modified_by TEXT NOT NULL,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Process-System Mapping Table
-- Many-to-many relationship between processes and systems
-- =====================================================
CREATE TABLE IF NOT EXISTS public.process_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
    system_id UUID NOT NULL REFERENCES public.systems(id) ON DELETE CASCADE,
    process_step TEXT, -- Which step in the process uses this system
    activity_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(process_id, system_id, process_step)
);

-- =====================================================
-- Critical Operations Table
-- Defines critical operations for CPS230 compliance
-- =====================================================
CREATE TABLE IF NOT EXISTS public.critical_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_name TEXT NOT NULL UNIQUE,
    description TEXT,
    system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
    process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
    color_code TEXT, -- For visual identification in the ecosystem
    modified_by TEXT NOT NULL,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Controls Table
-- Defines controls that manage/govern critical operations
-- =====================================================
CREATE TABLE IF NOT EXISTS public.controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_name TEXT NOT NULL,
    description TEXT,
    critical_operation_id UUID REFERENCES public.critical_operations(id) ON DELETE SET NULL,
    process_id UUID REFERENCES public.processes(id) ON DELETE SET NULL,
    system_id UUID REFERENCES public.systems(id) ON DELETE SET NULL,
    regions TEXT[], -- Multi-select: ['AU', 'UK', 'US', etc.]
    control_type TEXT, -- Type of control
    modified_by TEXT NOT NULL,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Settings Table
-- Application-wide settings (Nintex API credentials, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    modified_by TEXT NOT NULL,
    modified_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================
-- Sync History Table
-- Tracks synchronization events with Nintex Process Manager
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL, -- 'full', 'incremental', 'processes', 'systems'
    status TEXT NOT NULL, -- 'success', 'failed', 'in_progress'
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    initiated_by TEXT NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critical_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Promasters can view all profiles"
    ON public.user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can update all profiles"
    ON public.user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

CREATE POLICY "Promasters can insert profiles"
    ON public.user_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Processes Policies (All authenticated users can view)
CREATE POLICY "Authenticated users can view processes"
    ON public.processes FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Business Analysts and Promasters can modify processes"
    ON public.processes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
            AND role IN ('business_analyst', 'promaster')
        )
    );

-- Systems Policies
CREATE POLICY "Authenticated users can view systems"
    ON public.systems FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can modify systems"
    ON public.systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Process-Systems Policies
CREATE POLICY "Authenticated users can view process-systems"
    ON public.process_systems FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can modify process-systems"
    ON public.process_systems FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Critical Operations Policies
CREATE POLICY "Authenticated users can view critical operations"
    ON public.critical_operations FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can modify critical operations"
    ON public.critical_operations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Controls Policies
CREATE POLICY "Authenticated users can view controls"
    ON public.controls FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can modify controls"
    ON public.controls FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Settings Policies
CREATE POLICY "Authenticated users can view settings"
    ON public.settings FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can modify settings"
    ON public.settings FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- Sync History Policies
CREATE POLICY "Authenticated users can view sync history"
    ON public.sync_history FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Promasters can insert sync history"
    ON public.sync_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid() AND role = 'promaster'
        )
    );

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, role)
    VALUES (NEW.id, NEW.email, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX idx_processes_unique_id ON public.processes(process_unique_id);
CREATE INDEX idx_processes_owner ON public.processes(owner_username);
CREATE INDEX idx_systems_system_id ON public.systems(system_id);
CREATE INDEX idx_critical_operations_name ON public.critical_operations(operation_name);
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_process_systems_process ON public.process_systems(process_id);
CREATE INDEX idx_process_systems_system ON public.process_systems(system_id);
CREATE INDEX idx_controls_critical_operation ON public.controls(critical_operation_id);
CREATE INDEX idx_sync_history_status ON public.sync_history(status);

-- =====================================================
-- Initial Data / Seed
-- =====================================================

-- Insert default settings
INSERT INTO public.settings (key, value, description, modified_by) VALUES
    ('nintex_api_url', '""', 'Nintex Process Manager API base URL', 'system'),
    ('nintex_api_credentials', '{"username": "", "password": ""}', 'Nintex Process Manager API credentials (encrypted)', 'system'),
    ('regions', '[{"name": "AU", "label": "Australia"}, {"name": "UK", "label": "United Kingdom"}, {"name": "US", "label": "United States"}, {"name": "NZ", "label": "New Zealand"}, {"name": "SG", "label": "Singapore"}]', 'Available regions for assignment to processes and controls', 'system'),
    ('sync_frequency', '"manual"', 'How often to sync with Nintex (manual, daily, weekly)', 'system'),
    ('last_sync_timestamp', 'null', 'Timestamp of last successful sync', 'system')
ON CONFLICT (key) DO NOTHING;
