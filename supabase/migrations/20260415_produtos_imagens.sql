-- Adiciona o campo imagem_url na tabela produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Cria o bucket publico para os arquivos caso não exista
INSERT INTO storage.buckets (id, name, public) 
VALUES ('produtos_imagens', 'produtos_imagens', true)
ON CONFLICT (id) DO NOTHING;

-- Configura politicas para o Bucket (Permite leitura publica a todos, e que usuarios auth/anon facam upload)
-- Drop policy se ja existir (para ser idempotente)
DROP POLICY IF EXISTS "Imagens de produtos sao visiveis publicamente" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode subir imagem de produto" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode atualizar imagem" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode apagar imagem" ON storage.objects;

-- Politicas do Storage
CREATE POLICY "Imagens de produtos sao visiveis publicamente"
ON storage.objects FOR SELECT
USING ( bucket_id = 'produtos_imagens' );

CREATE POLICY "Qualquer um pode subir imagem de produto"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'produtos_imagens' );

CREATE POLICY "Qualquer um pode atualizar imagem"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'produtos_imagens' );

CREATE POLICY "Qualquer um pode apagar imagem"
ON storage.objects FOR DELETE
USING ( bucket_id = 'produtos_imagens' );
