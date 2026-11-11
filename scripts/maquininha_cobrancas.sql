-- ============================================================================
-- MAQUININHA (Moderninha Smart 2) — fila de cobranças
-- Rode este script no SQL Editor do Supabase (uma vez).
-- É idempotente: pode ser executado novamente sem quebrar nada.
--
-- Como funciona:
--   1. A vendedora confirma a venda no GESCS (Lojinha/Cantina) → o GESCS grava
--      uma linha aqui com status 'pendente' (valor, método, parcelas).
--   2. A maquininha, com a página /maquininha aberta no app "Lojinha GESCS",
--      pega a cobrança (status 'processando') e pede o cartão/PIX ao cliente.
--   3. A maquininha grava o resultado ('aprovado', 'recusado', 'cancelado'...).
--   4. O GESCS vê o resultado e só então registra a venda.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cobrancas_maquininha (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  modulo                  text NOT NULL DEFAULT 'lojinha'
                            CHECK (modulo IN ('lojinha', 'cantina')),
  referencia              text NOT NULL,          -- Ref da venda no GESCS (ex.: LJ-121025-134530-A1B2)
  descricao               text,                   -- itens, aparece na tela da maquininha
  valor_centavos          integer NOT NULL CHECK (valor_centavos >= 100),  -- mínimo R$ 1,00
  metodo                  text NOT NULL CHECK (metodo IN ('credito', 'debito', 'pix', 'voucher')),
  parcelas                integer NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 18),
  parcelamento            text NOT NULL DEFAULT 'vendedor'
                            CHECK (parcelamento IN ('vendedor', 'comprador')),
  status                  text NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'processando', 'aprovado', 'recusado',
                                              'cancelado', 'erro', 'expirado')),
  cancelamento_solicitado boolean NOT NULL DEFAULT false,  -- vendedora pediu para cancelar
  mensagem                text,                   -- última mensagem da maquininha / motivo
  terminal_serial         text,                   -- maquininha que pegou a cobrança
  codigo_transacao        text,                   -- PagBank: necessário para estorno
  id_transacao            text,                   -- PagBank: necessário para estorno
  resultado               jsonb,                  -- resposta completa da maquininha
  criado_por              uuid DEFAULT auth.uid(),
  criado_por_nome         text
);

CREATE INDEX IF NOT EXISTS idx_cobrancas_maquininha_pendentes
  ON public.cobrancas_maquininha (modulo, created_at)
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_cobrancas_maquininha_created
  ON public.cobrancas_maquininha (created_at DESC);

-- Mantém updated_at em dia.
CREATE OR REPLACE FUNCTION public.cobrancas_maquininha_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cobrancas_maquininha_touch ON public.cobrancas_maquininha;
CREATE TRIGGER trg_cobrancas_maquininha_touch
  BEFORE UPDATE ON public.cobrancas_maquininha
  FOR EACH ROW EXECUTE FUNCTION public.cobrancas_maquininha_touch();

-- RLS — mesmo padrão do restante do app (usuários autenticados).
ALTER TABLE public.cobrancas_maquininha ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cobrancas_maquininha_select" ON public.cobrancas_maquininha;
CREATE POLICY "cobrancas_maquininha_select"
  ON public.cobrancas_maquininha FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cobrancas_maquininha_insert" ON public.cobrancas_maquininha;
CREATE POLICY "cobrancas_maquininha_insert"
  ON public.cobrancas_maquininha FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "cobrancas_maquininha_update" ON public.cobrancas_maquininha;
CREATE POLICY "cobrancas_maquininha_update"
  ON public.cobrancas_maquininha FOR UPDATE
  USING (auth.role() = 'authenticated');

-- A maquininha pega a próxima cobrança pendente do seu caixa, de forma atômica
-- (duas maquininhas nunca pegam a mesma cobrança). Cobranças com mais de
-- 3 minutos são expiradas e NUNCA são cobradas — evita cobrar uma venda antiga
-- quando a maquininha volta a ficar online.
CREATE OR REPLACE FUNCTION public.maquininha_pegar_cobranca(p_caixa text, p_serial text)
RETURNS SETOF public.cobrancas_maquininha
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.cobrancas_maquininha
     SET status = 'expirado',
         mensagem = 'A maquininha não pegou a cobrança a tempo.'
   WHERE status = 'pendente'
     AND created_at < now() - interval '3 minutes';

  RETURN QUERY
  UPDATE public.cobrancas_maquininha c
     SET status = 'processando',
         terminal_serial = p_serial,
         mensagem = 'Enviado para a maquininha'
   WHERE c.id = (
     SELECT id
       FROM public.cobrancas_maquininha
      WHERE status = 'pendente'
        AND created_at >= now() - interval '3 minutes'
        AND (p_caixa = 'todos' OR modulo = p_caixa)
      ORDER BY created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING c.*;
END $$;

GRANT EXECUTE ON FUNCTION public.maquininha_pegar_cobranca(text, text) TO authenticated;

-- Realtime: avisa a maquininha e a tela da vendedora na hora.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cobrancas_maquininha;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
