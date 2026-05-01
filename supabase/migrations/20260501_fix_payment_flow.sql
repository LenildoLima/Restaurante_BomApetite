-- Correção do fluxo de pagamento para pedidos online com retirada/dinheiro.
--
-- PROBLEMA: "Confirmar" no painel de vendas marcava direto como "Concluída"
--           (somando ao caixa) antes do cliente pagar/retirar.
--
-- SOLUÇÃO:
--   1. "Confirmar" → muda status para "Em preparo" (vai pra cozinha)
--   2. KDS "ENTREGUE" → muda status para "Concluída" e debita estoque
--
-- Importante: "processar_confirmacao_online" é a RPC chamada pelo botão 
--             "Confirmar" em Sales.tsx. Ela também possui alias antigo 
--             "confirmar_pedido_online" que é mantido para compatibilidade.

-- ── 1. Confirmar pedido online: envia para cozinha (NÃO marca como Concluída) ──
CREATE OR REPLACE FUNCTION processar_confirmacao_online(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Muda status para "Em preparo" → vai aparecer no KDS
  UPDATE vendas 
  SET situacao = 'Em preparo' 
  WHERE id = p_venda_id 
    AND situacao = 'Aguardando confirmação';
  
  -- Atualiza os itens para 'pendente' na cozinha (caso ainda não estejam)
  UPDATE itens_venda
  SET status_cozinha = 'pendente'
  WHERE venda_id = p_venda_id
    AND status_cozinha = 'pendente'; -- já pendente, garante consistência
END;
$$;

-- Mantém alias antigo caso exista código referenciando o nome original
CREATE OR REPLACE FUNCTION confirmar_pedido_online(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM processar_confirmacao_online(p_venda_id);
END;
$$;

-- ── 2. Recusar pedido online: cancela a venda ──
CREATE OR REPLACE FUNCTION processar_recusa_online(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE vendas SET situacao = 'Cancelada' WHERE id = p_venda_id;
  UPDATE itens_venda SET status_cozinha = 'cancelado' WHERE venda_id = p_venda_id;
END;
$$;

-- ── 3. Concluir entrega (chamada pelo KDS ao clicar "ENTREGUE") ──
-- Esta função debita o estoque e marca a venda como Concluída
CREATE OR REPLACE FUNCTION concluir_venda_entrega(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  v_situacao text;
BEGIN
  -- Verificar situação atual
  SELECT situacao INTO v_situacao FROM vendas WHERE id = p_venda_id;
  
  -- Só conclui se não estiver já concluída ou cancelada
  IF v_situacao IN ('Concluída', 'Cancelada') THEN
    RETURN;
  END IF;

  -- Debita estoque para cada item
  FOR item IN
    SELECT produto_id, quantidade FROM itens_venda WHERE venda_id = p_venda_id
  LOOP
    INSERT INTO movimentacoes_estoque(produto_id, tipo, quantidade, motivo)
    VALUES (item.produto_id, 'saida', item.quantidade, 'Venda concluída - entregue ao cliente - pedido ' || p_venda_id::text);

    UPDATE estoque
    SET saldo = GREATEST(0, saldo - item.quantidade)
    WHERE produto_id = item.produto_id;
  END LOOP;

  -- Marca a venda como Concluída (agora conta no caixa)
  UPDATE vendas SET situacao = 'Concluída' WHERE id = p_venda_id;
END;
$$;
