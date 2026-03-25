-- ============================================================
-- Phase 1: New tables for Shared, Health, Together features
-- ============================================================

-- 1. Shared Responsibilities (who pays what % on shared accounts)
CREATE TABLE public.shared_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  percentage numeric NOT NULL DEFAULT 50 CHECK (percentage >= 0 AND percentage <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(account_id, user_id)
);

ALTER TABLE public.shared_responsibilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage shared_responsibilities" ON public.shared_responsibilities
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 2. Weight Logs (user-scoped, but both users can view)
CREATE TABLE public.weight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all weight_logs" ON public.weight_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own weight_logs" ON public.weight_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weight_logs" ON public.weight_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weight_logs" ON public.weight_logs
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Exercise Logs (same RLS pattern as weight)
CREATE TABLE public.exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  duration_minutes integer,
  distance numeric,
  calories integer,
  notes text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view all exercise_logs" ON public.exercise_logs
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own exercise_logs" ON public.exercise_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercise_logs" ON public.exercise_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercise_logs" ON public.exercise_logs
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Household Messages (shared chat, no delete)
CREATE TABLE public.household_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.household_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view messages" ON public.household_messages
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can send messages" ON public.household_messages
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = sender_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_messages;

-- 5. Shared Lists
CREATE TABLE public.shared_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text,
  color text,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage shared_lists" ON public.shared_lists
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 6. Shared List Items
CREATE TABLE public.shared_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  title text NOT NULL,
  checked boolean DEFAULT false,
  due_date date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.shared_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage shared_list_items" ON public.shared_list_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Schema changes to existing tables
-- ============================================================

-- bank_accounts: flag shared accounts
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;

-- calendar_events: life event support
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS is_life_event boolean DEFAULT false;

-- ============================================================
-- Drop Asana connections table
-- ============================================================
DROP TABLE IF EXISTS public.asana_connections;

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, date DESC);
CREATE INDEX idx_exercise_logs_user_date ON public.exercise_logs(user_id, date DESC);
CREATE INDEX idx_household_messages_created ON public.household_messages(created_at DESC);
CREATE INDEX idx_shared_list_items_list ON public.shared_list_items(list_id, position);
CREATE INDEX idx_shared_list_items_due ON public.shared_list_items(due_date) WHERE due_date IS NOT NULL;
