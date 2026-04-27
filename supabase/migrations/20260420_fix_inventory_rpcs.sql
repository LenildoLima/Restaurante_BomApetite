-- ============================================================
-- CORREÇÃO DEFINITIVA DOS RPCS DE ESTOQUE E VENDAS
-- Substitui o uso da coluna inexistente 'estoque_atual' por 'public.estoque.saldo'
-- ============================================================

-- 1. FUNÇÃO: adicionar_itens_venda
-- Responsável por adicionar novos itens a uma comanda/mesa existente
CREATE OR REPLACE FUNCTION public.adicionar_itens_venda(
  p_venda_id UUID,
  p_itens JSONB
)
RETURNS VOID AS $$
DECLARE
  v_item JSONB;
  v_produto_id UUID;
  v_quantidade INTEGER;
  v_preco NUMERIC;
  v_nome_produto TEXT;
  v_saldo_atual INTEGER;
  v_total_adicional NUMERIC := 0;
BEGIN
  -- Iterar sobre os itens para inserir e debitar estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id   := (v_item->>'produto_id')::UUID;
    v_quantidade   := (v_item->>'quantidade')::INTEGER;
    v_preco        := (v_item->>'preco_unitario')::NUMERIC;
    v_nome_produto := v_item->>'nome_produto';

    -- Se nome_produto não foi passado, busca da tabela
    IF v_nome_produto IS NULL OR v_nome_produto = '' THEN
      SELECT nome INTO v_nome_produto FROM public.produtos WHERE id = v_produto_id;
    END IF;

    -- Verificar saldo disponível na nova tabela de estoque
    SELECT saldo INTO v_saldo_atual FROM public.estoque WHERE produto_id = v_produto_id;
    
    IF v_saldo_atual IS NULL OR v_saldo_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto % (Saldo: %, Necessário: %)', 
        COALESCE(v_nome_produto, v_produto_id::TEXT), 
        COALESCE(v_saldo_atual, 0), 
        v_quantidade;
    END IF;

    -- Inserir item da venda
    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    VALUES (p_venda_id, v_produto_id, v_nome_produto, v_quantidade, v_preco);

    -- Debitar do estoque (Tabela Correta: estoque)
    UPDATE public.estoque
    SET saldo = saldo - v_quantidade,
        atualizado_em = now()
    WHERE produto_id = v_produto_id;

    -- Somar ao total adicional
    v_total_adicional := v_total_adicional + (v_quantidade * v_preco);
  END LOOP;

  -- Atualizar o total da venda principal
  UPDATE public.vendas 
  SET total = total + v_total_adicional 
  WHERE id = p_venda_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. FUNÇÃO: realizar_venda (Versão Consolidada)
-- Responsável por criar uma nova venda completa
CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_itens JSONB,
  p_pagamento_id UUID,
  p_observacao TEXT DEFAULT '',
  p_cliente TEXT DEFAULT '',
  p_cliente_id UUID DEFAULT NULL,
  p_tipo_pedido TEXT DEFAULT 'Local',
  p_endereco TEXT DEFAULT '',
  p_telefone TEXT DEFAULT '',
  p_taxa_entrega NUMERIC DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_venda_id UUID;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_produto_id UUID;
  v_quantidade INTEGER;
  v_preco NUMERIC;
  v_nome_produto TEXT;
  v_saldo_atual INTEGER;
BEGIN
  -- Calcular total
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_total := v_total + (v_item->>'quantidade')::NUMERIC * (v_item->>'preco_unitario')::NUMERIC;
  END LOOP;

  -- Criar a venda
  INSERT INTO public.vendas (forma_pagamento_id, nome_cliente, cliente_id, observacoes, total, situacao)
  VALUES (p_pagamento_id, p_cliente, p_cliente_id, p_observacao, v_total, 
          CASE WHEN lower(p_tipo_pedido) = 'local' THEN 'Em Aberto' ELSE 'Concluída' END)
  RETURNING id INTO v_venda_id;

  -- Inserir itens e debitar estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id   := (v_item->>'produto_id')::UUID;
    v_quantidade   := (v_item->>'quantidade')::INTEGER;
    v_preco        := (v_item->>'preco_unitario')::NUMERIC;
    v_nome_produto := v_item->>'nome_produto';

    IF v_nome_produto IS NULL OR v_nome_produto = '' THEN
      SELECT nome INTO v_nome_produto FROM public.produtos WHERE id = v_produto_id;
    END IF;

    -- Verificar saldo
    SELECT saldo INTO v_saldo_atual FROM public.estoque WHERE produto_id = v_produto_id;
    IF v_saldo_atual IS NULL OR v_saldo_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', COALESCE(v_nome_produto, v_produto_id::TEXT);
    END IF;

    -- Inserir item
    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    VALUES (v_venda_id, v_produto_id, v_nome_produto, v_quantidade, v_preco);

    -- Debitar estoque
    UPDATE public.estoque
    SET saldo = saldo - v_quantidade,
        atualizado_em = now()
    WHERE produto_id = v_produto_id;
  END LOOP;

  -- Entrega
  IF lower(p_tipo_pedido) = 'entrega' THEN
    INSERT INTO public.entregas (venda_id, endereco, telefone, taxa)
    VALUES (v_venda_id, p_endereco, p_telefone, p_taxa_entrega);
  END IF;

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. FUNÇÃO: cancelar_venda (Versão Consolidada)
-- Responsável por estornar estoque ao cancelar
CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Estornar cada item ao estoque
  FOR v_item IN
    SELECT produto_id, quantidade FROM public.itens_venda WHERE venda_id = p_venda_id
  LOOP
    INSERT INTO public.estoque (produto_id, saldo, atualizado_em)
    VALUES (v_item.produto_id, v_item.quantidade, now())
    ON CONFLICT (produto_id) DO UPDATE
      SET saldo = public.estoque.saldo + v_item.quantidade,
          atualizado_em = now();
  END LOOP;

  -- Marcar venda como cancelada
  UPDATE public.vendas SET situacao = 'Cancelada' WHERE id = p_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
