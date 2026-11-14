-- ============================================================================
-- INSERIR ATIVOS DO RAMO ESCOTEIRO (lote encontrado)
-- ----------------------------------------------------------------------------
-- COMO USAR:
--   1) Rode ANTES o script de estrutura (lojinha_doacao_fiado.sql — PARTE 11),
--      que cria as colunas novas: category, conservation_state,
--      replacement_months, photos.
--   2) Preencha/edite a lista de VALUES abaixo (uma linha por item).
--      - category: Ferramentas | Material para amarra | Material para atividade |
--                  Equipamento | Cozinha / Campo | Mobiliário | Outros
--      - conservation_state: Novo | Bom | Regular | Ruim | Inservível
--      - replacement_months: previsão de troca em meses (ou NULL)
--      - value: valor estimado em reais (0 se não souber)
--   3) Rode este arquivo no SQL Editor do Supabase.
--
-- OBS. 1 (quantidade): a tabela controla UM item por linha (patrimônio).
--   - Se quiser cada peça numerada, duplique a linha (uma por peça).
--   - Se preferir tratar como lote, deixe uma linha e escreva a quantidade na
--     descrição (ex.: 'Lote com 6 unidades').
-- OBS. 2 (código de barras): é gerado automaticamente aqui, então as etiquetas
--   com QR/código já funcionam.
-- OBS. 3 (fotos): dá para subir as fotos depois, pela própria tela de Ativos
--   (cada item tem o botão de fotos no cadastro). Em massa por SQL fica inviável
--   (as imagens são grandes).
--
-- ⚠️ Os itens abaixo são um RASCUNHO com base nas fotos enviadas — revise nomes,
--    categorias, estado e quantidades com a pessoa responsável antes de confirmar.
-- ============================================================================

INSERT INTO public.assets
  (name, category, branch, conservation_state, replacement_months, value, description, status, date_acquired, barcode)
VALUES
  ('Bacia plástica azul',            'Cozinha / Campo',         'Escoteiro', 'Bom',     36, 0, 'Lote de bacias encontradas no depósito', 'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text),
  ('Lona / toldo verde',             'Material para atividade', 'Escoteiro', 'Regular', 24, 0, 'Lona enrolada',                           'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text),
  ('Estacas de barraca (saco)',      'Material para atividade', 'Escoteiro', 'Bom',     36, 0, 'Saco com estacas metálicas',              'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text),
  ('Varetas de barraca (fibra)',     'Material para atividade', 'Escoteiro', 'Regular', 24, 0, 'Varetas de fibra de vidro',               'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text),
  ('Barraca laranja',                'Equipamento',             'Escoteiro', 'Regular', 48, 0, 'Barraca com cobertura laranja',           'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text)
  -- , ('Nome do item', 'Categoria', 'Escoteiro', 'Estado', meses, valor, 'Descrição', 'active', CURRENT_DATE, floor(random()*9000000000000+1000000000000)::bigint::text)
;

-- Confira o que entrou:
-- SELECT name, category, conservation_state, replacement_months, branch
-- FROM public.assets WHERE branch = 'Escoteiro' ORDER BY name;
