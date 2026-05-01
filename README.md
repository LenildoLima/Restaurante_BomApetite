# 🍽️ Bom Apetite - Sistema de Gestão de Marmitaria

O **Bom Apetite** é um sistema completo de gestão para restaurantes e marmitarias, desenvolvido com foco em praticidade operacional. Integra PDV interno, catálogo online para clientes, cozinha digital (KDS), controle de entregas e gestão financeira em uma única plataforma moderna.

## 🚀 Funcionalidades

### 🛒 Catálogo Online (Público)
- Cardápio digital acessível pelo cliente via link
- Fluxo de pedido em 3 passos: tipo de entrega → dados pessoais → pagamento
- **Pagar agora com PIX** (QR Code gerado automaticamente via Mercado Pago)
- **Pagar na Retirada/Entrega** (Dinheiro, Cartão) — status fica pendente até o pagamento físico
- Opção "Fiado" removida do catálogo (disponível apenas no PDV interno)
- Compartilhamento do pedido via WhatsApp
- Histórico de pedidos por cliente (armazenado localmente)

### 🖥️ PDV Interno (Nova Venda)
- Lançamento rápido de vendas para atendentes
- Suporte a produtos com variações de tamanho (P, M, G)
- Modalidades: Balcão, Mesa, Delivery e Retirada
- Taxa de entrega automática via configuração global
- Gestão de mesas em aberto com adição de itens
- Impressão de recibos para impressoras térmicas 80mm

### 👨‍🍳 Cozinha Digital (KDS)
- Visão em tempo real dos pedidos por status: Fila de Espera → Em Preparo → Pronto/Aguardando
- Fluxo de finalização: ao clicar **"Entregue"**, a venda é marcada como **Concluída** e o estoque é debitado automaticamente
- Alertas visuais de tempo de espera por pedido
- Suporte a pedidos de Delivery e Retirada com badge distintivo

### 🛵 Gestão de Entregas
- Painel de entregas com filtro por status
- Atribuição de entregadores por pedido
- Confirmação de entrega e cálculo de acerto com entregadores

### 💰 Financeiro e Caixa
- Abertura e fechamento de caixa com saldo inicial/final
- Movimentações de entrada e saída
- Dashboard com métricas de faturamento diário/mensal
- Gráficos de vendas com Recharts

### 📦 Estoque
- Controle via ledger de movimentações (entradas e saídas)
- Registro de entradas com fornecedor e custo unitário
- Estorno automático de estoque em cancelamentos
- Alertas de estoque baixo no dashboard

### 👥 Gestão de Usuários
- Perfis de acesso: `admin` e `atendente`
- Administradores gerenciam usuários, produtos, relatórios e configurações
- Auditoria de ações críticas (vendas canceladas, alterações de produto, etc.)

### ⚙️ Configurações
- Taxa de entrega global (aplicada automaticamente no PDV e no Catálogo)
- Backup e restauração de dados

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| UI/UX | Tailwind CSS, Shadcn UI, Lucide Icons |
| Gráficos | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Pagamentos | Mercado Pago (PIX via Edge Functions) |

---

## 📦 Como Rodar Localmente

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/LenildoLima/Restaurante_BomApetite.git
   cd Restaurante_BomApetite
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente** (crie um arquivo `.env`):
   ```env
   VITE_SUPABASE_URL=sua_url_aqui
   VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui
   ```

4. **Execute as migrations no Supabase:**
   - Acesse o **Supabase SQL Editor**
   - Execute os arquivos da pasta `supabase/migrations/` em ordem cronológica

5. **Inicie o servidor:**
   ```bash
   npm run dev
   ```
   Acesse em `http://localhost:8080`

---

## 🗄️ Estrutura do Banco de Dados

### Principais Tabelas

| Tabela | Descrição |
|---|---|
| `usuarios` | Perfis de acesso (admin/atendente) |
| `clientes` | Cadastro de clientes com telefone e endereço |
| `produtos` | Catálogo com preço, custo e categoria |
| `categorias` | Agrupamento de produtos |
| `estoque` | Saldo atual por produto |
| `movimentacoes_estoque` | Ledger de entradas e saídas |
| `vendas` | Registro de vendas com status do ciclo de vida |
| `itens_venda` | Itens de cada venda com `status_cozinha` |
| `formas_pagamento` | PIX, Dinheiro, Cartão, etc. |
| `entregas` | Pedidos de delivery com endereço e taxa |
| `entregadores` | Cadastro de entregadores com taxa fixa |
| `caixas` | Controle de abertura/fechamento de caixa |
| `configuracoes` | Chave-valor para configurações globais (ex: `taxa_entrega`) |
| `auditoria` | Log de ações críticas por usuário |

### RPCs Principais (Supabase Functions)

| Função | Descrição |
|---|---|
| `realizar_venda` | Cria venda, itens e debita estoque atomicamente |
| `processar_confirmacao_online` | Confirma pedido online → muda status para "Em preparo" |
| `processar_recusa_online` | Recusa e cancela um pedido online |
| `concluir_venda_entrega` | Finaliza venda como "Concluída" e debita estoque |

---

## 📋 Ciclo de Vida dos Pedidos Online

```
Cliente faz pedido (Catálogo)
        ↓
  "Aguardando confirmação"
        ↓ (Atendente clica "Confirmar" em Vendas)
     "Em preparo" → aparece no KDS
        ↓ (Cozinha avança: Pendente → Preparando → Pronto)
  "Pronto / Aguardando"
        ↓ (KDS clica "Entregue")
      "Concluída" → conta no caixa ✅
```

---

*Desenvolvido com ❤️ para o Restaurante Bom Apetite.*
