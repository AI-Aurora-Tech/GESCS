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
