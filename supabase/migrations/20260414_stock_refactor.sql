-- ============================================================
-- MIGRAÇÃO: Sistema de Estoque por Movimentação
-- ============================================================

-- 1. Tabela de saldo atual por produto
CREATE TABLE IF NOT EXISTS public.estoque (
  produto_id UUID PRIMARY KEY REFERENCES public.produtos(id) ON DELETE CASCADE,
  saldo INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Cabeçalho da nota de entrada de mercadoria
CREATE TABLE IF NOT EXISTS public.entradas_nota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Itens da nota de entrada
CREATE TABLE IF NOT EXISTS public.entradas_nota_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada_id UUID NOT NULL REFERENCES public.entradas_nota(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  custo_unitario NUMERIC NOT NULL DEFAULT 0
);

-- ============================================================
-- 4. RLS nas novas tabelas
-- ============================================================
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total ao estoque" ON public.estoque FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.entradas_nota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total às entradas" ON public.entradas_nota FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.entradas_nota_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total aos itens de entrada" ON public.entradas_nota_item FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Migrar saldos existentes de produtos.estoque → estoque.saldo
-- ============================================================
INSERT INTO public.estoque (produto_id, saldo)
SELECT id, estoque FROM public.produtos
ON CONFLICT (produto_id) DO UPDATE SET saldo = EXCLUDED.saldo;

-- ============================================================
-- 6. Trigger: ao inserir item de entrada, incrementar saldo
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_entrada_atualiza_estoque()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.estoque (produto_id, saldo, atualizado_em)
  VALUES (NEW.produto_id, NEW.quantidade, now())
  ON CONFLICT (produto_id) DO UPDATE
    SET saldo = public.estoque.saldo + NEW.quantidade,
        atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entrada_atualiza_estoque ON public.entradas_nota_item;
CREATE TRIGGER trg_entrada_atualiza_estoque
  AFTER INSERT ON public.entradas_nota_item
  FOR EACH ROW EXECUTE FUNCTION public.fn_entrada_atualiza_estoque();

-- ============================================================
-- 7. Trigger: ao deletar item de entrada, decrementar saldo
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_entrada_remove_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.estoque
  SET saldo = GREATEST(0, saldo - OLD.quantidade),
      atualizado_em = now()
  WHERE produto_id = OLD.produto_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entrada_remove_estoque ON public.entradas_nota_item;
CREATE TRIGGER trg_entrada_remove_estoque
  AFTER DELETE ON public.entradas_nota_item
  FOR EACH ROW EXECUTE FUNCTION public.fn_entrada_remove_estoque();
