-- ============================================================
-- CORREÇÃO DO RPC realizar_venda
-- Parâmetros corrigidos para corresponder ao frontend
-- ============================================================

-- Remover a versão anterior primeiro para evitar erro de assinatura
DROP FUNCTION IF EXISTS public.realizar_venda(uuid, text, uuid, text, jsonb, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.realizar_venda(jsonb, uuid, text, text, uuid, text, text, text, numeric);

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
  VALUES (p_pagamento_id, p_cliente, p_cliente_id, p_observacao, v_total, 'Concluída')
  RETURNING id INTO v_venda_id;

  -- Inserir itens e debitar estoque
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

    -- Verificar saldo disponível
    SELECT saldo INTO v_saldo_atual FROM public.estoque WHERE produto_id = v_produto_id;
    IF v_saldo_atual IS NULL OR v_saldo_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', COALESCE(v_nome_produto, v_produto_id::TEXT);
    END IF;

    -- Inserir item da venda
    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    VALUES (v_venda_id, v_produto_id, v_nome_produto, v_quantidade, v_preco);

    -- Debitar do estoque
    UPDATE public.estoque
    SET saldo = saldo - v_quantidade,
        atualizado_em = now()
    WHERE produto_id = v_produto_id;
  END LOOP;

  -- Criar entrega se necessário
  IF lower(p_tipo_pedido) = 'entrega' THEN
    INSERT INTO public.entregas (venda_id, endereco, telefone, taxa)
    VALUES (v_venda_id, p_endereco, p_telefone, p_taxa_entrega);
  END IF;

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
