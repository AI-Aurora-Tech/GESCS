-- ============================================================================
-- LOJINHA — Doações e Fiados
-- Rode este script no SQL Editor do Supabase (uma vez).
-- É idempotente: pode ser executado novamente sem quebrar nada.
-- ============================================================================

-- 1) Marca o tipo de cada SAÍDA de estoque: 'normal' | 'donation' | 'fiado'.
--    Usado para excluir doações da receita nos relatórios e identificar fiados.
ALTER TABLE public.stock_transactions
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'normal';

-- 2) Tabela das vendas especiais (doações e fiados).
--    Doação  -> sale_type='donation', youth_name (nome do jovem), approver.
--    Fiado   -> sale_type='fiado', chefe_name, approver, due_date, paid.
CREATE TABLE IF NOT EXISTS public.lojinha_special_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text,                       -- referência da venda (ex.: LJ-123456)
  sale_type      text NOT NULL CHECK (sale_type IN ('donation','fiado')),
  total_amount   numeric(10,2) NOT NULL DEFAULT 0,
  items          jsonb,                      -- itens da venda (snapshot)
  youth_name     text,                       -- DOAÇÃO: nome do jovem beneficiado
  chefe_name     text,                       -- FIADO: nome do chefe que pegou o item
  approver       text,                       -- aprovador (Édson / Sandra)
  due_date       date,                       -- FIADO: data prevista de pagamento
  paid           boolean NOT NULL DEFAULT false,   -- FIADO: já foi pago?
  paid_at        timestamptz,               -- FIADO: quando foi pago
  payment_method text,
  notes          text,
  user_id        uuid,
  user_name      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas por tipo e por vencimento de fiados em aberto.
CREATE INDEX IF NOT EXISTS idx_lojinha_special_sales_type
  ON public.lojinha_special_sales (sale_type);

CREATE INDEX IF NOT EXISTS idx_lojinha_special_sales_due
  ON public.lojinha_special_sales (due_date)
  WHERE sale_type = 'fiado' AND paid = false;

-- 3) RLS — mesmo padrão permissivo do restante do app (usuários autenticados).
ALTER TABLE public.lojinha_special_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "special_sales_select" ON public.lojinha_special_sales;
CREATE POLICY "special_sales_select"
  ON public.lojinha_special_sales FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "special_sales_insert" ON public.lojinha_special_sales;
CREATE POLICY "special_sales_insert"
  ON public.lojinha_special_sales FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "special_sales_update" ON public.lojinha_special_sales;
CREATE POLICY "special_sales_update"
  ON public.lojinha_special_sales FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "special_sales_delete" ON public.lojinha_special_sales;
CREATE POLICY "special_sales_delete"
  ON public.lojinha_special_sales FOR DELETE
  USING (auth.role() = 'authenticated');

-- 4) (Opcional) Habilita realtime para atualizar a tela automaticamente.
--    Se a publicação já contiver a tabela, o Supabase apenas ignora.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lojinha_special_sales;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;


-- ============================================================================
-- PARTE 2 — Conferência de estoque (a cada 15 dias) + correção de permissões
-- ============================================================================

-- 5) Tabela de conferências de estoque (balanço).
CREATE TABLE IF NOT EXISTS public.lojinha_stock_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_items int NOT NULL DEFAULT 0,   -- qtde de produtos conferidos
  divergences int NOT NULL DEFAULT 0,   -- qtde de produtos com divergência
  details     jsonb,                    -- detalhes {name,size,system,physical}
  user_id     uuid,
  user_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lojinha_stock_checks_created
  ON public.lojinha_stock_checks (created_at DESC);

ALTER TABLE public.lojinha_stock_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_checks_all" ON public.lojinha_stock_checks;
CREATE POLICY "stock_checks_all"
  ON public.lojinha_stock_checks FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lojinha_stock_checks;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 6) Permissões (RLS) para ATUALIZAR estoque.
--    Corrige o caso em que a atualização de estoque "não salva": sem uma policy
--    de UPDATE, o Supabase aceita a chamada mas não altera nenhuma linha.
--    Estas policies liberam CRUD para qualquer usuário autenticado (o app sempre
--    opera logado), mantendo o comportamento atual e destravando o UPDATE.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_authenticated_all" ON public.products;
CREATE POLICY "products_authenticated_all"
  ON public.products FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_transactions_authenticated_all" ON public.stock_transactions;
CREATE POLICY "stock_transactions_authenticated_all"
  ON public.stock_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE public.lojinha_demands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lojinha_demands_authenticated_all" ON public.lojinha_demands;
CREATE POLICY "lojinha_demands_authenticated_all"
  ON public.lojinha_demands FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================================
-- PARTE 3 — Permissões (RLS) para as demais tabelas do sistema
--   CAUSA RAIZ do "nada salva no banco": tabelas com RLS ligado mas sem policy
--   de INSERT/UPDATE. O supabase-js NÃO lança erro nesse caso — a escrita
--   simplesmente não acontece. As policies abaixo liberam CRUD para usuários
--   autenticados (o app sempre opera logado).
--   Rode este bloco por inteiro; é idempotente.
-- ============================================================================

-- financial_records (receitas/despesas — vendas, pagamentos, etc.)
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_records_authenticated_all" ON public.financial_records;
CREATE POLICY "financial_records_authenticated_all"
  ON public.financial_records FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- scout_members (membros/escoteiros)
ALTER TABLE public.scout_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_members_authenticated_all" ON public.scout_members;
CREATE POLICY "scout_members_authenticated_all"
  ON public.scout_members FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- scout_events (agenda) — cria a tabela se não existir
CREATE TABLE IF NOT EXISTS public.scout_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  date        date NOT NULL,
  branch      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scout_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scout_events_authenticated_all" ON public.scout_events;
CREATE POLICY "scout_events_authenticated_all"
  ON public.scout_events FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- assets (patrimônio / ativos) — só cria policy se a tabela existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'assets') THEN
    EXECUTE 'ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "assets_authenticated_all" ON public.assets';
    EXECUTE 'CREATE POLICY "assets_authenticated_all" ON public.assets FOR ALL
             USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
  END IF;
END $$;

-- profiles (usuários) — leitura por autenticados + criação/edição
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_authenticated_select" ON public.profiles;
CREATE POLICY "profiles_authenticated_select"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "profiles_authenticated_insert" ON public.profiles;
CREATE POLICY "profiles_authenticated_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "profiles_authenticated_update" ON public.profiles;
CREATE POLICY "profiles_authenticated_update"
  ON public.profiles FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Habilita realtime para as tabelas principais (ignora se já estiverem)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','stock_transactions','lojinha_demands','financial_records',
    'scout_members','scout_events'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- DIAGNÓSTICO (opcional): rode para ver o status de RLS e nº de policies.
--   Se alguma tabela tiver rls_ativo = true e policies = 0, as escritas falham.
-- ============================================================================
-- SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativo,
--        (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'r'
-- ORDER BY tabela;
