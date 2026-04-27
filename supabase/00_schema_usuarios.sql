-- Arquivo gerado para ajudar na migração com a CLI do Supabase ou execução via painel
-- Para aplicar via painel, vá em SQL Editor e cole este código

-- Tabela de usuários do sistema (espelho de auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  perfil text NOT NULL CHECK (perfil IN ('admin', 'atendente')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política: qualquer usuário autenticado pode ler todos os usuários (para listar na tela de usuários)
CREATE POLICY "Usuarios podem ler todos os usuarios"
  ON public.usuarios
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: somente o próprio usuário pode atualizar seus dados básicos
CREATE POLICY "Usuario pode atualizar proprios dados"
  ON public.usuarios
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS usuarios_email_idx ON public.usuarios (email);

-- OBS: Ao criar um usuário no Supabase Auth via painel manualmente,
-- não esqueça de inserir um registro correspondente na tabela "usuarios".
