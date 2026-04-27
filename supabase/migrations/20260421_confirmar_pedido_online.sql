-- Índice de performance para busca de pedidos pendentes
CREATE INDEX IF NOT EXISTS idx_vendas_situacao ON vendas(situacao);

-- RPC para confirmar pedido online: decrementa estoque e muda status para Concluída
CREATE OR REPLACE FUNCTION confirmar_pedido_online(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Para cada item da venda, registra movimentação de saída e atualiza saldo
  FOR item IN
    SELECT produto_id, quantidade FROM itens_venda WHERE venda_id = p_venda_id
  LOOP
    -- Registra movimentação de saída
    INSERT INTO movimentacoes_estoque(produto_id, tipo, quantidade, motivo)
    VALUES (item.produto_id, 'saida', item.quantidade, 'Venda online confirmada - pedido ' || p_venda_id::text);

    -- Atualiza saldo
    UPDATE estoque
    SET saldo = GREATEST(0, saldo - item.quantidade)
    WHERE produto_id = item.produto_id;
  END LOOP;

  -- Marca a venda como Concluída
  UPDATE vendas SET situacao = 'Concluída' WHERE id = p_venda_id;
END;
$$;

-- RPC para recusar pedido online
CREATE OR REPLACE FUNCTION recusar_pedido_online(p_venda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE vendas SET situacao = 'Cancelada' WHERE id = p_venda_id;
END;
$$;
