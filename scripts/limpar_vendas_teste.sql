-- ============================================================================
-- LIMPEZA DE VENDAS DE TESTE — mantém apenas a venda real Ref: LJ-033134
-- Rode no SQL Editor do Supabase.
--
-- ⚠️ APAGA DADOS. Recomendo rodar primeiro a seção "PRÉVIA" (SELECTs) para
--    conferir o que será removido antes de rodar os DELETEs.
-- ============================================================================

-- ------------------------------------------------------------------
-- PRÉVIA (não apaga nada) — veja o que será removido:
-- ------------------------------------------------------------------
-- Vendas especiais (fiado/doação) que serão apagadas:
SELECT 'special_sales' AS tabela, reference, sale_type, total_amount, chefe_name, youth_name, created_at
FROM public.lojinha_special_sales
WHERE reference IS DISTINCT FROM 'LJ-033134';

-- Lançamentos financeiros da lojinha que serão apagados:
SELECT 'financial_records' AS tabela, description, amount, date
FROM public.financial_records
WHERE module = 'lojinha'
  AND COALESCE(description,'') NOT LIKE '%LJ-033134%';

-- Movimentações de venda (saídas) que serão apagadas:
SELECT 'stock_transactions' AS tabela, product_id, quantity, sale_type, notes, created_at
FROM public.stock_transactions
WHERE type IN ('exit','out')
  AND sale_type IN ('normal','fiado','donation')
  AND COALESCE(notes,'') NOT LIKE '%Ajuste%'
  AND COALESCE(notes,'') NOT LIKE '%LJ-033134%';


-- ============================================================================
-- EXECUÇÃO — rode este bloco para efetivar a limpeza.
-- ============================================================================
BEGIN;

-- (OPCIONAL) Devolve ao estoque as quantidades das vendas de teste que serão
-- apagadas. Se você preferir NÃO mexer no estoque e ajustar depois pela
-- Conferência, comente/remova este UPDATE.
UPDATE public.products p
SET stock = COALESCE(p.stock,0) + agg.qty
FROM (
  SELECT product_id, SUM(quantity) AS qty
  FROM public.stock_transactions
  WHERE type IN ('exit','out')
    AND sale_type IN ('normal','fiado','donation')
    AND COALESCE(notes,'') NOT LIKE '%Ajuste%'
    AND COALESCE(notes,'') NOT LIKE '%LJ-033134%'
    AND product_id IS NOT NULL
  GROUP BY product_id
) agg
WHERE p.id = agg.product_id;

-- 1) Apaga as vendas especiais (fiado/doação) de teste
DELETE FROM public.lojinha_special_sales
WHERE reference IS DISTINCT FROM 'LJ-033134';

-- 2) Apaga os lançamentos financeiros de venda da lojinha (menos a real)
DELETE FROM public.financial_records
WHERE module = 'lojinha'
  AND COALESCE(description,'') NOT LIKE '%LJ-033134%';

-- 3) Apaga as movimentações de venda (menos a real). Mantém entradas e ajustes.
DELETE FROM public.stock_transactions
WHERE type IN ('exit','out')
  AND sale_type IN ('normal','fiado','donation')
  AND COALESCE(notes,'') NOT LIKE '%Ajuste%'
  AND COALESCE(notes,'') NOT LIKE '%LJ-033134%';

COMMIT;
-- Se algo parecer errado ANTES do COMMIT, rode ROLLBACK; em vez de COMMIT;
