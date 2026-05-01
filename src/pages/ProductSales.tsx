import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { 
  BarChart3, 
  Package, 
  Calendar, 
  Filter, 
  Search, 
  ArrowUpRight, 
  Boxes,
  TrendingUp,
  LayoutGrid
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface SalesData {
  nome_produto: string;
  categoria_id: string;
  categoria_nome: string;
  total_quantidade: number;
  total_valor: number;
  total_pedidos: number;
}

interface Category {
  id: string;
  nome: string;
}

export default function ProductSales() {
  const [data, setData] = useState<SalesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filters
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes" | "personalizado">("hoje");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [orderType, setOrderType] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchSalesData();
  }, [period, startDate, endDate, selectedCategory, orderType]);

  async function fetchInitialData() {
    const { data: catData } = await supabase.from("categorias").select("id, nome").order("nome");
    setCategories(catData || []);
  }

  async function fetchSalesData() {
    setLoading(true);
    try {
      let query = supabase
        .from("itens_venda")
        .select(`
          nome_produto,
          quantidade,
          preco_unitario,
          venda_id,
          vendas (
            situacao,
            criado_em,
            tipo_pedido
          ),
          produtos (
            categoria_id,
            categorias (
              nome
            )
          )
        `);

      // Time Filter
      const now = new Date();
      let start = new Date();
      if (period === "hoje") {
        start.setHours(0, 0, 0, 0);
      } else if (period === "semana") {
        start.setDate(now.getDate() - 7);
      } else if (period === "mes") {
        start.setMonth(now.getMonth() - 1);
      } else if (period === "personalizado" && startDate) {
        start = new Date(startDate);
      }

      query = query.gte("vendas.criado_em", start.toISOString());
      
      if (period === "personalizado" && endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("vendas.criado_em", end.toISOString());
      }

      // Execute query
      const { data: rawData, error } = await query;
      
      if (error) throw error;

      // Processing data in memory (since Supabase JS client doesn't support GROUP BY easily with aggregates)
      // Filter out canceled sales and other filters that are easier to do here
      const filtered = (rawData as any[]).filter(item => {
        const v = item.vendas;
        if (!v || v.situacao === 'Cancelada') return false;
        
        if (orderType !== "Todos" && v.tipo_pedido !== orderType) return false;
        
        const catId = item.produtos?.categoria_id;
        if (selectedCategory !== "Todas" && catId !== selectedCategory) return false;
        
        return true;
      });

      const grouped: Record<string, SalesData> = {};
      
      filtered.forEach(item => {
        const key = item.nome_produto;
        if (!grouped[key]) {
          grouped[key] = {
            nome_produto: item.nome_produto,
            categoria_id: item.produtos?.categoria_id || "",
            categoria_nome: item.produtos?.categorias?.nome || "Sem Categoria",
            total_quantidade: 0,
            total_valor: 0,
            total_pedidos: 0
          };
        }
        
        grouped[key].total_quantidade += item.quantidade;
        grouped[key].total_valor += (item.quantidade * item.preco_unitario);
        // We need a unique set of venda_ids per product to count total_pedidos correctly
      });

      // To count unique pedidos per product accurately
      const productPedidos: Record<string, Set<string>> = {};
      filtered.forEach(item => {
        if (!productPedidos[item.nome_produto]) {
          productPedidos[item.nome_produto] = new Set();
        }
        productPedidos[item.nome_produto].add(item.venda_id);
      });

      Object.keys(grouped).forEach(key => {
        grouped[key].total_pedidos = productPedidos[key].size;
      });

      const result = Object.values(grouped).sort((a, b) => b.total_quantidade - a.total_quantidade);
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados de vendas");
    } finally {
      setLoading(false);
    }
  }

  const filteredData = data.filter(item => 
    item.nome_produto.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = filteredData.reduce((acc, item) => acc + item.total_quantidade, 0);
  const totalRevenue = filteredData.reduce((acc, item) => acc + item.total_valor, 0);
  const bestSeller = filteredData.length > 0 ? filteredData[0] : null;
  const totalMarmitas = filteredData
    .filter(item => item.categoria_nome.toLowerCase().includes("marmita"))
    .reduce((acc, item) => acc + item.total_quantidade, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 border-b border-border/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos Vendidos</h1>
            <p className="text-muted-foreground text-sm">Relatório detalhado de desempenho por produto</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar produto..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Vendido</p>
            <p className="text-2xl font-bold mt-1">{totalItems} <span className="text-xs font-normal text-muted-foreground">itens</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#D4521A]/10 text-[#D4521A] flex items-center justify-center">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Marmitas</p>
            <p className="text-2xl font-bold mt-1 text-[#D4521A]">{totalMarmitas}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FACC15]/10 text-[#FACC15] flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Mais Vendido</p>
            <p className="text-lg font-bold mt-1 truncate max-w-[150px]" title={bestSeller?.nome_produto || "-"}>
              {bestSeller?.nome_produto || "-"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{bestSeller?.total_quantidade || 0} unidades</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="card-metric flex items-start justify-between border-[#D4521A]/20 bg-[#D4521A]/5">
          <div>
            <p className="text-sm text-muted-foreground">Total Arrecadado</p>
            <p className="text-2xl font-bold mt-1 text-[#D4521A]">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#D4521A] text-white flex items-center justify-center shadow-lg shadow-[#D4521A]/30">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card-metric p-4 border-[#3D1F0A]/10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Período</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(["hoje", "semana", "mes", "personalizado"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                    period === p 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p === "personalizado" ? "Custom" : p}
                </button>
              ))}
            </div>
          </div>

          {period === "personalizado" && (
            <div className="grid grid-cols-2 gap-2 md:col-span-1">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Início</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="pl-9 h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fim</Label>
                <Input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="h-9 text-xs"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Categoria</Label>
            <div className="relative">
              <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="pl-9 h-9 text-xs">
                  <SelectValue placeholder="Todas Categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas Categorias</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tipo de Pedido</Label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Select value={orderType} onValueChange={setOrderType}>
                <SelectTrigger className="pl-9 h-9 text-xs">
                  <SelectValue placeholder="Todos Tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos Tipos</SelectItem>
                  <SelectItem value="Presencial">🏠 Presencial</SelectItem>
                  <SelectItem value="Retirada">🥡 Retirada</SelectItem>
                  <SelectItem value="Delivery">🛵 Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card-metric p-0 overflow-hidden border-[#3D1F0A]/10">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-4 font-bold text-[#3D1F0A] uppercase tracking-wider text-[10px]">Produto</th>
                <th className="text-left p-4 font-bold text-[#3D1F0A] uppercase tracking-wider text-[10px]">Categoria</th>
                <th className="text-center p-4 font-bold text-[#3D1F0A] uppercase tracking-wider text-[10px]">Quantidade</th>
                <th className="text-right p-4 font-bold text-[#3D1F0A] uppercase tracking-wider text-[10px]">Total Arrecadado</th>
                <th className="text-right p-4 font-bold text-[#3D1F0A] uppercase tracking-wider text-[10px] w-48">Desempenho (% do Total)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Carregando dados...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Nenhum produto vendido no período selecionado.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const percentage = (item.total_valor / totalRevenue) * 100;
                  return (
                    <tr key={index} className="hover:bg-muted/30 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            index === 0 ? 'bg-[#D4521A] text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <span className="font-bold text-[#3D1F0A] tracking-tight">{item.nome_produto}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full bg-[#3D1F0A]/10 text-[#3D1F0A] text-[10px] font-black uppercase tracking-widest">
                          {item.categoria_nome}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="font-black text-lg text-foreground">{item.total_quantidade}</span>
                        <p className="text-[10px] text-muted-foreground uppercase">{item.total_pedidos} pedidos</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-[#D4521A]">{formatCurrency(item.total_valor)}</span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-xs font-bold text-[#3D1F0A]">{percentage.toFixed(1)}%</span>
                          <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#D4521A] to-[#FACC15] transition-all duration-1000" 
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
