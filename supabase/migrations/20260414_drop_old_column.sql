-- ============================================================
-- REMOVER CAMPO ANTIGO DE ESTOQUE
-- ============================================================
-- Execute este comando no SQL Editor do Supabase.
-- Isso apagará a coluna antiga que está causando conflito de nome
-- com a nova tabela de estoque.

ALTER TABLE public.produtos DROP COLUMN IF EXISTS estoque;
