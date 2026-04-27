# 🍔 LaunchApp - Gestão de Lanchonete

O **LaunchApp** é um sistema de PDV (Ponto de Venda) premium e intuitivo, desenvolvido para otimizar a operação de lanchonetes e pequenos estabelecimentos de alimentação. O sistema oferece controle avançado de estoque, gestão de clientes, autenticação baseada em funções, dashboard em tempo real, e um fluxo especializado para pedidos de entrega (Delivery) com impressão de recibos.

## 🚀 Funcionalidades Principais

- **Segurança e Autenticação (Supabase Auth)**: Sistema de login seguro com perfis de acesso (`admin` e `atendente`), garantindo que apenas administradores tenham acesso a áreas sensíveis como Entradas de Estoque e Dashboard Financeiro.
- **Painel de Controle (Dashboard)**: Métricas financeiras em tempo real, gráficos de faturamento mensal e alertas inteligentes de estoque baixo.
- **Sistema de Estoque Profissional (Ledger)**: Controle de estoque baseado em movimentações. Registre entradas de mercadorias com custos, com atualização automática do saldo real. Estorno automático de produtos em caso de cancelamento de vendas.
- **Gestão de Clientes Inteligente**: Durante o fechamento da venda, busque clientes existentes pelo nome/telefone ou cadastre novos clientes sem sair da tela.
- **PDV (Nova Venda) e Impressão Térmica**: Checkout fluido para pedidos locais e delivery (endereço, telefone, taxa de entrega automática, e cálculo de troco). Inclui módulo de **impressão para impressoras térmicas de 80mm**.
- **Auditoria de Ações**: Rastreio automático de ações críticas realizadas no sistema (ex: alterações de produtos e vendas canceladas).
- **Interface Premium**: Design moderno com paleta Navy Blue (Azul Marinho), menus em dropdown elegantes (com avatar do usuário), design totalmente responsivo e micro-interações que elevam a experiência do usuário.

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, Vite, TypeScript.
- **UI/UX**: Tailwind CSS, Shadcn UI, Lucide Icons, Gráficos com Recharts.
- **Backend & Autenticação**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions).

## 📦 Como Instalar e Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/LenildoLima/gerenciador-lanchonete.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente baseando-se no arquivo `.env.example` ou crie o `.env`:
   ```bash
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🗄️ Estrutura do Banco de Dados (Supabase)

O esquema do banco de dados evoluiu significativamente. Em vez de rodar um arquivo de SQL gigante manually, você pode (e deve) utilizar as **Subapase Migrations** presentes na pasta `supabase/migrations/` para refletir as tabelas e RPCs (como o controle atômico de vendas e os estornos automáticos de estoque).

### Visão Geral do Esquema SQL

O código abaixo representa a estrutura fundamental das principais tabelas do sistema:

```sql
-- SEGURANÇA E ACESSO
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  email text UNIQUE NOT NULL,
  perfil text NOT NULL,
  ativo boolean DEFAULT true
);

CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id),
  acao text NOT NULL,
  detalhes jsonb
);

CREATE TABLE public.solicitacoes_senha (
  id uuid PRIMARY KEY,
  usuario_id uuid REFERENCES public.usuarios(id),
  status text
);

-- CATÁLOGO DE PRODUTOS
CREATE TABLE public.categorias (
  id uuid PRIMARY KEY,
  nome text NOT NULL
);

CREATE TABLE public.produtos (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.categorias(id),
  preco numeric NOT NULL,
  custo numeric DEFAULT 0,
  estoque_minimo integer DEFAULT 5,
  ativo boolean DEFAULT true
);

-- SISTEMA DE ESTOQUE E COMPRAS
CREATE TABLE public.estoque (
  produto_id uuid PRIMARY KEY REFERENCES public.produtos(id),
  saldo integer DEFAULT 0,
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE public.entradas_nota (
  id uuid PRIMARY KEY,
  fornecedor text,
  observacoes text,
  criado_em timestamptz DEFAULT now()
);

CREATE TABLE public.entradas_nota_item (
  id uuid PRIMARY KEY,
  entrada_id uuid REFERENCES public.entradas_nota(id),
  produto_id uuid REFERENCES public.produtos(id),
  quantidade integer NOT NULL,
  custo_unitario numeric NOT NULL
);

-- CLIENTES
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  telefone text,
  endereco text,
  complemento text,
  saldo_devedor numeric
);

-- CAIXA E FINANCEIRO
CREATE TABLE public.caixas (
  id uuid PRIMARY KEY,
  status text, -- Aberto, Fechado
  aberto_em timestamptz,
  fechado_em timestamptz,
  saldo_inicial numeric,
  saldo_final numeric
);

CREATE TABLE public.caixa_movimentacoes (
  id uuid PRIMARY KEY,
  caixa_id uuid REFERENCES public.caixas(id),
  tipo text, -- Entrada, Saída
  valor numeric,
  descricao text
);

CREATE TABLE public.formas_pagamento (
  id uuid PRIMARY KEY,
  nome text NOT NULL
);

-- FLUXO DE VENDAS (PDV)
CREATE TABLE public.vendas (
  id uuid PRIMARY KEY,
  total numeric DEFAULT 0,
  forma_pagamento_id uuid REFERENCES public.formas_pagamento(id),
  nome_cliente text,
  cliente_id uuid REFERENCES public.clientes(id),
  situacao text DEFAULT 'Concluída'
);

CREATE TABLE public.itens_venda (
  id uuid PRIMARY KEY,
  venda_id uuid REFERENCES public.vendas(id),
  produto_id uuid REFERENCES public.produtos(id),
  nome_produto text,
  quantidade integer NOT NULL,
  preco_unitario numeric NOT NULL
);

-- DELIVERY E ENTREGADORES
CREATE TABLE public.entregadores (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  telefone text,
  taxa_fixa numeric
);

CREATE TABLE public.entregas (
  id uuid PRIMARY KEY,
  venda_id uuid REFERENCES public.vendas(id),
  entregador_id uuid REFERENCES public.entregadores(id),
  endereco text,
  taxa numeric
);

CREATE TABLE public.pagamentos_entregadores (
  id uuid PRIMARY KEY,
  entregador_id uuid REFERENCES public.entregadores(id),
  valor_pago numeric,
  data_pagamento timestamptz DEFAULT now()
);
```

---
*Desenvolvido com ❤️ para facilitar a gestão e escalar os negócios da sua lanchonete.*
