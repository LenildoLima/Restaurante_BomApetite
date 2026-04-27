-- ============================================================
-- ATUALIZAÇÃO DO RPC realizar_venda
-- Usar estoque.saldo ao invés de produtos.estoque
-- ============================================================

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_forma_pagamento_id UUID,
  p_nome_cliente TEXT,
  p_cliente_id UUID,
  p_observacoes TEXT,
  p_itens JSONB,
  p_tipo_pedido TEXT DEFAULT 'local',
  p_endereco TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
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
  VALUES (p_forma_pagamento_id, p_nome_cliente, p_cliente_id, p_observacoes, v_total, 'Concluída')
  RETURNING id INTO v_venda_id;

  -- Inserir itens e debitar estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_produto_id  := (v_item->>'produto_id')::UUID;
    v_quantidade  := (v_item->>'quantidade')::INTEGER;
    v_preco       := (v_item->>'preco_unitario')::NUMERIC;
    v_nome_produto := v_item->>'nome_produto';

    -- Verificar saldo disponível
    SELECT saldo INTO v_saldo_atual FROM public.estoque WHERE produto_id = v_produto_id;
    IF v_saldo_atual IS NULL OR v_saldo_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', v_nome_produto;
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
  IF p_tipo_pedido = 'entrega' THEN
    INSERT INTO public.entregas (venda_id, endereco, telefone, taxa)
    VALUES (v_venda_id, p_endereco, p_telefone, p_taxa_entrega);
  END IF;

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNÇÃO: Estornar estoque ao cancelar venda
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Estornar cada item ao estoque
  FOR v_item IN
    SELECT produto_id, quantidade FROM public.itens_venda WHERE venda_id = p_venda_id
  LOOP
    UPDATE public.estoque
    SET saldo = saldo + v_item.quantidade,
        atualizado_em = now()
    WHERE produto_id = v_item.produto_id;
  END LOOP;

  -- Marcar venda como cancelada
  UPDATE public.vendas SET situacao = 'Cancelada' WHERE id = p_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REMOVER campo estoque de produtos (após migração dos dados)
-- Execute SOMENTE após confirmar que tudo funciona!
-- ============================================================
-- ALTER TABLE public.produtos DROP COLUMN estoque;
