-- ==========================================
-- SUPORTE PARA MESAS E PAGAMENTOS PARCIAIS
-- ==========================================

-- 1. Criar tabela de múltiplos pagamentos por venda
CREATE TABLE IF NOT EXISTS public.pagamentos_venda (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    forma_pagamento_id UUID NOT NULL REFERENCES public.formas_pagamento(id),
    valor NUMERIC(15,2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Permitir que a venda não tenha forma de pagamento principal
ALTER TABLE public.vendas ALTER COLUMN forma_pagamento_id DROP NOT NULL;

-- 3. Nova versão do realizar_venda para aceitar status
DROP FUNCTION IF EXISTS public.realizar_venda(jsonb, uuid, text, text, uuid, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.realizar_venda(jsonb, uuid, text, text, uuid, text, text, text, numeric, text);

CREATE OR REPLACE FUNCTION public.realizar_venda(
  p_itens JSONB,
  p_pagamento_id UUID,
  p_observacao TEXT DEFAULT '',
  p_cliente TEXT DEFAULT '',
  p_cliente_id UUID DEFAULT NULL,
  p_tipo_pedido TEXT DEFAULT 'Local',
  p_endereco TEXT DEFAULT '',
  p_telefone TEXT DEFAULT '',
  p_taxa_entrega NUMERIC DEFAULT 0,
  p_status TEXT DEFAULT 'Concluída'
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

  -- Criar a venda com o status repassado
  INSERT INTO public.vendas (forma_pagamento_id, nome_cliente, cliente_id, observacoes, total, situacao)
  VALUES (p_pagamento_id, p_cliente, p_cliente_id, p_observacao, v_total, p_status)
  RETURNING id INTO v_venda_id;

  -- Se for pago integralmente na hora, já regista em pagamentos_venda
  IF p_pagamento_id IS NOT NULL THEN
    INSERT INTO public.pagamentos_venda (venda_id, forma_pagamento_id, valor)
    VALUES (v_venda_id, p_pagamento_id, v_total + p_taxa_entrega);
  END IF;

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

    SELECT saldo INTO v_saldo_atual FROM public.estoque WHERE produto_id = v_produto_id;
    IF v_saldo_atual IS NULL OR v_saldo_atual < v_quantidade THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto %', COALESCE(v_nome_produto, v_produto_id::TEXT);
    END IF;

    INSERT INTO public.itens_venda (venda_id, produto_id, nome_produto, quantidade, preco_unitario)
    VALUES (v_venda_id, v_produto_id, v_nome_produto, v_quantidade, v_preco);

    UPDATE public.estoque
    SET saldo = saldo - v_quantidade,
        atualizado_em = now()
    WHERE produto_id = v_produto_id;
  END LOOP;

  -- Criar entrega
  IF lower(p_tipo_pedido) = 'entrega' THEN
    INSERT INTO public.entregas (venda_id, endereco, telefone, taxa)
    VALUES (v_venda_id, p_endereco, p_telefone, p_taxa_entrega);
  END IF;

  RETURN v_venda_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Criar RPC para registrar pagamento parcial
CREATE OR REPLACE FUNCTION public.registrar_pagamento_venda(
  p_venda_id UUID,
  p_forma_pagamento_id UUID,
  p_valor NUMERIC
)
RETURNS VOID AS $$
DECLARE
  v_total_venda NUMERIC;
  v_total_pago NUMERIC;
BEGIN
  -- Inserir pagamento
  INSERT INTO public.pagamentos_venda (venda_id, forma_pagamento_id, valor)
  VALUES (p_venda_id, p_forma_pagamento_id, p_valor);

  -- Atualizar a forma de pagamento principal da venda pra constar a primeira ou a que o cliente usou mais
  UPDATE public.vendas SET forma_pagamento_id = p_forma_pagamento_id WHERE id = p_venda_id AND forma_pagamento_id IS NULL;

  -- Calcular total já pago
  SELECT COALESCE(SUM(valor), 0) INTO v_total_pago
  FROM public.pagamentos_venda
  WHERE venda_id = p_venda_id;

  -- Pegar total da venda + taxa de entrega
  SELECT 
    v.total + COALESCE((SELECT e.taxa FROM public.entregas e WHERE e.venda_id = v.id LIMIT 1), 0) INTO v_total_venda
  FROM public.vendas v
  WHERE v.id = p_venda_id;

  -- Se pagou tudo ou mais, atualiza status
  IF v_total_pago >= v_total_venda THEN
    UPDATE public.vendas SET situacao = 'Concluída' WHERE id = p_venda_id;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
