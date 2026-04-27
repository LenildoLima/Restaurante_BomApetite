import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatTime } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ShoppingCart, DollarSign, Package, AlertTriangle, Receipt, TrendingUp, ChevronLeft, ChevronRight, Bike, CheckCircle2, ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  nome: string;
  categoria_id: string;
  categorias?: { nome: string };
  ativo: boolean;
  estoque_minimo: number;
  estoque?: { saldo: number };
}

interface Sale {
  id: string;
  criado_em: string;
  forma_pagamento_id: string;
  formas_pagamento?: { nome: string };
  total: number;
  situacao: string;
  entregas?: {
    taxa_entrega: number;
    tipo_pedido: string;
  }[];
}

interface SaleWithItems extends Sale {
  itemCount: number;
}

interface ItemRanking {
  produto_id: string;
  nome: string;
  qtd: number;
  total: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [todaySales, setTodaySales] = useState<SaleWithItems[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [chartData, setChartData] = useState<{ dia: string; valor: number }[]>([]);
  const [topProducts, setTopProducts] = useState<ItemRanking[]>([]);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [mesSelecionado, setMesSelecionado] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetchData();

    // Inscrição em tempo real
    const channel = supabase
      .channel("dashboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vendas" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itens_venda" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mesSelecionado]);

  async function fetchData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const primeiroDiaMes = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), 1);
    const ultimoDiaMes = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth() + 1, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    // 1. Buscar Vendas do Período e Produtos
    const [productsRes, allNeededSalesRes, todaySalesRes] = await Promise.all([
      supabase.from("produtos").select("*, categorias(nome), estoque(saldo)"),
      supabase
        .from("vendas")
        .select("*, formas_pagamento(nome), entregas(*)")
        .gte("criado_em", primeiroDiaMes.toISOString())
        .lte("criado_em", ultimoDiaMes.toISOString())
        .eq("situacao", "Concluída"),
      supabase
        .from("vendas")
        .select("*, formas_pagamento(nome), entregas(*)")
        .gte("criado_em", today.toISOString())
        .eq("situacao", "Concluída"),
    ]);

    const salesList = (allNeededSalesRes.data as any[]) || [];
    setAllSales(salesList);
    setProducts((productsRes.data as any[]) || []);

    // 2. Calcular Ticket Médio
    if (salesList.length > 0) {
      const totalMes = salesList.reduce((s, v) => s + Number(v.total), 0);
      setTicketMedio(totalMes / salesList.length);
    } else {
      setTicketMedio(0);
    }

    // 3. Buscar Itens para o Ranking e Dashboard de Hoje
    const { data: monthItems } = await supabase
      .from("itens_venda")
      .select("produto_id, nome_produto, quantidade, preco_unitario, venda_id")
      .in("venda_id", salesList.map(s => s.id));

    const itemRanking: Record<string, ItemRanking> = {};
    (monthItems || []).forEach((item: any) => {
      if (!itemRanking[item.produto_id]) {
        itemRanking[item.produto_id] = { 
          produto_id: item.produto_id, 
          nome: item.nome_produto, 
          qtd: 0, 
          total: 0 
        };
      }
      itemRanking[item.produto_id].qtd += item.quantidade;
      itemRanking[item.produto_id].total += (item.quantidade * item.preco_unitario);
    });

    const sortedRanking = Object.values(itemRanking)
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 5);
    setTopProducts(sortedRanking);

    // 4. Hoje (Today)
    const todayData = (todaySalesRes.data as any[]) || [];
    setTodaySales(todayData.map(s => ({ ...s, itemCount: 0 }))); // Placeholder for itemCount

    // 5. Gerar dados para o gráfico
    const diasNoMes = ultimoDiaMes.getDate();
    const dadosGrafico = [];

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataInicio = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), dia, 0, 0, 0);
      const dataFim = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth(), dia, 23, 59, 59);

      const totalDoDia = salesList
        .filter((s) => {
          const dataVenda = new Date(s.criado_em);
          return dataVenda >= dataInicio && dataVenda <= dataFim;
        })
        .reduce((soma, s) => soma + Number(s.total), 0);

      dadosGrafico.push({ dia: dia.toString(), valor: totalDoDia });
    }
    setChartData(dadosGrafico);
  }

  const navegarMes = (direcao: number) => {
    const novoMes = new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth() + direcao, 1);
    const agora = new Date();
    const mesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);

    if (novoMes <= mesAtual) {
      setMesSelecionado(novoMes);
    }
  };

  const formatarMesAno = (data: Date) => {
    return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      .replace(/^\w/, (c) => c.toUpperCase());
  };

  const activeProducts = products.filter((p) => p.ativo);
  const lowStock = products.filter((p) => p.ativo && (p.estoque?.saldo ?? 0) < p.estoque_minimo);
  const todayTotal = todaySales.reduce((s, v) => s + Number(v.total), 0);
  const totalRevenue = allSales.reduce((s, v) => s + Number(v.total), 0);

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel</h1>
          <p className="text-muted-foreground text-sm">Visão geral da lanchonete</p>
        </div>

        {/* Atalhos Rápidos */}
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => navigate('/nova-venda')} 
            className="card-metric flex flex-row items-center gap-3 py-2 pl-2 pr-5 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 group cursor-pointer text-left m-0"
          >
            <div className="w-10 h-10 rounded-xl bg-[#22c55e] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm md:text-base tracking-tight">Nova Venda</span>
          </button>

          <button 
            onClick={() => navigate('/vendas')} 
            className="card-metric flex flex-row items-center gap-3 py-2 pl-2 pr-5 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 group cursor-pointer text-left m-0"
          >
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm flex-shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm md:text-base tracking-tight">Vendas</span>
          </button>

          <button 
            onClick={() => navigate('/entregas')} 
            className="card-metric flex flex-row items-center gap-3 py-2 pl-2 pr-5 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 group cursor-pointer text-left m-0"
          >
            <div className="w-10 h-10 rounded-xl bg-[#ec4899] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm flex-shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm md:text-base tracking-tight">Entregas</span>
          </button>

          <button 
            onClick={() => navigate('/cozinha')} 
            className="card-metric flex flex-row items-center gap-3 py-2 pl-2 pr-5 hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95 group cursor-pointer text-left m-0 border-orange-200 bg-orange-50/30"
          >
            <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm flex-shrink-0">
              <ChefHat className="w-5 h-5" />
            </div>
            <span className="font-bold text-[#1e3a8a] text-sm md:text-base tracking-tight">Cozinha</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Vendas Hoje</p>
            <p className="text-2xl font-bold mt-1">{todaySales.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(todayTotal)}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Receita Total Mensal</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{allSales.length} vendas no mês</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Produtos Ativos</p>
            <p className="text-2xl font-bold mt-1">{activeProducts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{products.length} cadastrados</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Estoque Baixo</p>
            <p className="text-2xl font-bold mt-1">{lowStock.length}</p>
            <p className="text-xs text-destructive mt-1 font-medium">{lowStock.length > 0 ? "Atenção" : "OK"}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Ticket Médio</p>
            <p className="text-2xl font-bold mt-1 text-primary">{formatCurrency(ticketMedio)}</p>
            <p className="text-xs text-muted-foreground mt-1">Média por venda no mês</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Produto +Vendido</p>
            <p className="text-lg font-bold mt-1 truncate max-w-[150px]" title={topProducts[0]?.nome || "Nenhum"}>
              {topProducts[0] ? topProducts[0].nome : "Nenhum"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{topProducts[0] ? `${topProducts[0].qtd} unidades vendidas` : "Sem vendas no mês"}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>

      <div className="bg-[#fff7ed] rounded-2xl shadow-[0_2px_8px_rgba(249,115,22,0.08)] border border-[#fed7aa] p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <h2 className="text-xl font-bold text-[#1e3a8a]">Vendas do Mês</h2>
          
          <div className="flex items-center gap-4 bg-[#1e3a8a]/5 p-1 rounded-xl">
            <button
              onClick={() => navegarMes(-1)}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
              {formatarMesAno(mesSelecionado)}
            </span>
            <button
              onClick={() => navegarMes(1)}
              disabled={new Date(mesSelecionado.getFullYear(), mesSelecionado.getMonth() + 1, 1) > new Date()}
              className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="dia" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#fff7ed] p-4 shadow-xl border border-[#fed7aa] rounded-xl">
                        <p className="text-xs text-gray-400 font-medium mb-1">Dia {label}</p>
                        <p className="text-sm font-bold text-orange-600">
                          {formatCurrency(payload[0].value as number)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="valor" 
                stroke="#f97316" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorValor)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-metric">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-foreground">Top 5 Produtos (Mês)</h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">RANKING</span>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center italic">Nenhuma venda registrada no período</p>
          ) : (
            <div className="space-y-5">
              {topProducts.map((p, index) => {
                const maxQtd = topProducts[0].qtd;
                const percentage = (p.qtd / maxQtd) * 100;
                return (
                  <div key={p.produto_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 flex items-center justify-center bg-muted rounded text-[10px] font-black text-muted-foreground">{index + 1}º</span>
                        <span className="font-bold text-[#1e3a8a]">{p.nome}</span>
                      </div>
                      <span className="font-black text-primary">{p.qtd} <span className="text-[10px] text-muted-foreground font-normal">un.</span></span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full transition-all duration-1000" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-metric">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-foreground">Atenção ao Estoque</h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-destructive tracking-widest">ALERTA</span>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-500 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm italic">Tudo sob controle no estoque</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-auto pr-2 scrollbar-thin">
              {lowStock.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-border hover:bg-muted/50 transition-all">
                  <div>
                    <p className="text-sm font-bold text-foreground/80">{p.nome}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">{p.categorias?.nome || 'Geral'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-destructive">{p.estoque?.saldo ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Mínimo: {p.estoque_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
