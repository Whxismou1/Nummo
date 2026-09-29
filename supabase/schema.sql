-- =============================================================================
-- NUMMO - Schema de PostgreSQL para Supabase
-- Ejecuta este script en el SQL Editor de tu panel de Supabase
-- =============================================================================

-- 1. Tabla de Categorías
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    created_at BIGINT NOT NULL
);

-- 2. Tabla de Metas de Ahorro / Huchas
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount BIGINT,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- 3. Tabla de Movimientos / Transacciones
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    savings_goal_id TEXT REFERENCES public.savings_goals(id) ON DELETE SET NULL,
    date BIGINT NOT NULL,
    note TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

-- 4. Tabla de Presupuestos / Sobres
CREATE TABLE IF NOT EXISTS public.budgets (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('global', 'category')),
    category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

-- Habilitar Row Level Security (RLS) para que cada usuario solo vea sus propios datos
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para categorías
CREATE POLICY "Users can access their own categories"
    ON public.categories FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas de seguridad para huchas
CREATE POLICY "Users can access their own savings_goals"
    ON public.savings_goals FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas de seguridad para transacciones
CREATE POLICY "Users can access their own transactions"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas de seguridad para presupuestos
CREATE POLICY "Users can access their own budgets"
    ON public.budgets FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 5. Trigger para autogenerar categorías por defecto al registrarse un usuario
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_categories()
RETURNS trigger AS $$
DECLARE
    now_ts BIGINT := (extract(epoch from now()) * 1000)::bigint;
    prefix TEXT := substr(replace(NEW.id::text, '-', ''), 1, 10);
BEGIN
    INSERT INTO public.categories (id, user_id, name, icon, color, type, created_at)
    VALUES
        ('cat_' || prefix || '_deporte', NEW.id, 'Pádel & Deporte', '🎾', '#4F46E5', 'expense', now_ts),
        ('cat_' || prefix || '_ocio', NEW.id, 'Ocio & Salidas', '🍹', '#D97706', 'expense', now_ts + 1),
        ('cat_' || prefix || '_alimentacion', NEW.id, 'Alimentación', '🛒', '#E11D48', 'expense', now_ts + 2),
        ('cat_' || prefix || '_suscripciones', NEW.id, 'Suscripciones', '📱', '#7C3AED', 'expense', now_ts + 3),
        ('cat_' || prefix || '_transporte', NEW.id, 'Transporte & Gasolina', '🚗', '#2563EB', 'expense', now_ts + 4),
        ('cat_' || prefix || '_vivienda', NEW.id, 'Vivienda & Hogar', '🏠', '#0D9488', 'expense', now_ts + 5),
        ('cat_' || prefix || '_salud', NEW.id, 'Salud & Bienestar', '💊', '#DB2777', 'expense', now_ts + 6),
        ('cat_' || prefix || '_compras', NEW.id, 'Compras & Ropa', '🛍️', '#059669', 'expense', now_ts + 7),
        ('cat_' || prefix || '_nomina', NEW.id, 'Nómina Principal', '💼', '#16A34A', 'income', now_ts + 8),
        ('cat_' || prefix || '_freelance', NEW.id, 'Freelance & Extras', '💻', '#059669', 'income', now_ts + 9),
        ('cat_' || prefix || '_inversiones', NEW.id, 'Inversiones', '📈', '#2563EB', 'income', now_ts + 10)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_categories ON auth.users;
CREATE TRIGGER on_auth_user_created_categories
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_categories();
