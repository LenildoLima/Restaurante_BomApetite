import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Search, Eye, Ban, Wallet, DollarSign, ShoppingBag, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineOrders } from "@/hooks/useOnlineOrders";

interface PagamentoVenda {
  id: string;
  valor: number;
  formas_pagamento?: { nome: string };
  criado_em: string;
}

interface Venda {
  id: string;
  criado_em: string;
  forma_pagamento_id: string;
  formas_pagamento?: { nome: string };
  nome_cliente: string | null;
  cliente_id: string | null;
  clientes?: { nome: string; telefone: string | null } | null;
  observacoes: string | null;
  total: number;
  situacao: string;
  entregas?: {
    taxa: number;
    endereco: string;
    telefone: string;
  }[];
  pagamentos_venda?: PagamentoVenda[];
}

interface ItemVenda {
  id: string;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
}

interface VendaComContagem extends Venda {
  itemCount: number;
  total_pago: number;
}

export default function Vendas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [vendas, setVendas] = useState<VendaComContagem[]>([]);
  const [search, setSearch] = useState("");
  const [detalheVenda, setDetalheVenda] = useState<Venda | null>(null);
  const [detalheItens, setDetalheItens] = useState<ItemVenda[]>([]);
  const [filterRange, setFilterRange] = useState<"hoje" | "semana" | "mes" | "todos">("todos");
  const [activeTab, setActiveTab] = useState<"todas" | "abertas" | "online">("todas");
  const { pedidosPendentes, pendingCount, refresh: refreshOnline } = useOnlineOrders();

  // Parcial Payment states
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [vendaPagamento, setVendaPagamento] = useState<VendaComContagem | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVendas();
    supabase.from("formas_pagamento").select("*").order("nome").then((res) => setPaymentMethods(res.data || []));
  }, []);

  async function fetchVendas() {
    // Note: this query expects the new pagamentos_venda table and RPC to exist
    const { data } = await supabase
      .from("vendas")
      .select(`
        *,
        formas_pagamento(nome),
        clientes(nome, telefone),
        entregas(*),
        pagamentos_venda(id, valor, formas_pagamento(nome), criado_em)
      `)
      .order("criado_em", { ascending: false });
      
    const vendasData = (data as any[]) || [];

    const withCounts: VendaComContagem[] = [];
    for (const venda of vendasData) {
      const { count } = await supabase
        .from("itens_venda")
        .select("*", { count: "exact", head: true })
        .eq("venda_id", venda.id);
        
      const total_pago = (venda.pagamentos_venda || []).reduce((acc: number, p: any) => acc + Number(p.valor), 0);
      withCounts.push({ ...venda, itemCount: count || 0, total_pago });
    }
    setVendas(withCounts);
  }

  async function viewDetails(venda: Venda) {
    const { data } = await supabase.from("itens_venda").select("*").eq("venda_id", venda.id);
    setDetalheItens((data as ItemVenda[]) || []);
    setDetalheVenda(venda);
  }

  async function cancelVenda(id: string) {
    if (!confirm("Deseja cancelar esta venda? O estoque será ESTORNADO automaticamente.")) return;
    const { error } = await (supabase as any).rpc("cancelar_venda", { p_venda_id: id });
    if (error) {
      toast.error("Erro ao cancelar venda");
      return;
    }

    const v = vendas.find(x => x.id === id);
    if (usuario && v) {
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "venda",
        acao: "Venda cancelada",
        detalhes: { venda_id: id, total: v.total }
      });

      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "estoque",
        acao: "Estorno de estoque (cancelamento de venda)",
        detalhes: { venda_id: id }
      });
    }

    toast.success("Venda cancelada e estoque estornado!");
    fetchVendas();
  }

  const filtered = vendas.filter((v) => {
    if (activeTab === "abertas" && v.situacao !== "Em Aberto") return false;

    const term = search.toLowerCase();
    const formaPgto = v.formas_pagamento?.nome?.toLowerCase() || "";
    const matchesSearch = (
      v.nome_cliente?.toLowerCase().includes(term) ||
      formaPgto.includes(term) ||
      formatDateTime(v.criado_em).includes(term)
    );

    if (!matchesSearch) return false;

    const dataVenda = new Date(v.criado_em);
    const agora = new Date();
    
    if (filterRange === "hoje") {
      return dataVenda.toDateString() === agora.toDateString();
    }
    
    if (filterRange === "semana") {
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(agora.getDate() - 7);
      return dataVenda >= umaSemanaAtras;
    }

    if (filterRange === "mes") {
      return dataVenda.getMonth() === agora.getMonth() && dataVenda.getFullYear() === agora.getFullYear();
    }

    return true;
  });

  async function submitPartialPayment() {
    if (!vendaPagamento || !paymentMethodId || !paymentAmount) {
      toast.error("Preencha o valor e a forma de pagamento"); return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("registrar_pagamento_venda", {
        p_venda_id: vendaPagamento.id,
        p_forma_pagamento_id: paymentMethodId,
        p_valor: parseFloat(paymentAmount)
      });
      if (error) { toast.error("Erro ao registrar pagamento"); }
      else { 
        toast.success("Pagamento parcial registrado!"); 
        setPaymentModalOpen(false); 
        fetchVendas(); 
        if (usuario) {
          await registrarAuditoria({
            usuario_id: usuario.id,
            usuario_nome: usuario.nome,
            tipo: "venda",
            acao: "Pagamento parcial registrado",
            detalhes: { venda_id: vendaPagamento.id, valor: parseFloat(paymentAmount), forma_pagamento_id: paymentMethodId }
          });
        }
      }
    } catch {
      toast.error("Erro inesperado");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totals = filtered.reduce((acc, v) => {
    const taxa = Number(v.entregas?.[0]?.taxa || 0);
    const subtotalItens = Number(v.total);
    
    return {
      venda: acc.venda + subtotalItens,
      taxa: acc.taxa + taxa,
      total: acc.total + subtotalItens + taxa
    };
  }, { venda: 0, taxa: 0, total: 0 });

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
        <p className="text-sm text-muted-foreground">Histórico de vendas realizadas</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center bg-muted p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("todas")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === "todas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Histórico (Todas)
          </button>
          <button
            onClick={() => setActiveTab("abertas")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === "abertas" ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Mesas em Aberto
          </button>
          <button
            onClick={() => setActiveTab("online")}
            className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === "online" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Pedidos Online
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar vendas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex bg-muted p-1 rounded-lg self-end sm:self-auto">
          {(["hoje", "semana", "mes", "todos"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                filterRange === r 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pedidos Online Panel ── */}
      {activeTab === "online" && (
        <div className="space-y-4">
          {pedidosPendentes.length === 0 ? (
            <div className="card-metric flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingBag className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-semibold">Nenhum pedido online aguardando</p>
              <p className="text-xs mt-1">Os pedidos do catálogo aparecerão aqui em tempo real</p>
            </div>
          ) : (
            pedidosPendentes.map((pedido) => {
              const minutos = Math.floor((Date.now() - new Date(pedido.criado_em).getTime()) / 60000);
              const isDelivery = pedido.entregas && pedido.entregas.length > 0;
              return (
                <div key={pedido.id} className="card-metric border-l-4 border-orange-500">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-lg text-foreground">{pedido.nome_cliente || "Cliente"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isDelivery ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"}`}>
                          {isDelivery ? "🛵 Delivery" : "🍽️ Retirada"}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">
                          ⏱ {minutos < 1 ? "Agora" : `${minutos} min atrás`}
                        </span>
                      </div>
                      {isDelivery && pedido.entregas?.[0]?.endereco && (
                        <p className="text-sm text-muted-foreground mt-1">📍 {pedido.entregas[0].endereco}</p>
                      )}
                      {isDelivery && pedido.entregas?.[0]?.telefone && (
                        <p className="text-sm text-muted-foreground">📞 {pedido.entregas[0].telefone}</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {(pedido.itens || []).map((item: any, idx: number) => (
                          <div key={idx} className="text-sm flex justify-between">
                            <span>{item.quantidade}x {item.nome_produto}</span>
                            <span className="text-muted-foreground">{formatCurrency(item.quantidade * item.preco_unitario)}</span>
                          </div>
                        ))}
                      </div>
                      {pedido.observacoes && (
                        <p className="text-xs text-muted-foreground mt-2 italic">Obs: {pedido.observacoes}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <span className="font-black text-xl text-primary">{formatCurrency(Number(pedido.total))}</span>
                      <span className="text-xs text-muted-foreground">{pedido.formas_pagamento?.nome || "-"}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const { error } = await (supabase as any).rpc("processar_confirmacao_online", { p_venda_id: pedido.id });
                            if (error) {
                              toast.error("Erro ao confirmar pedido");
                            } else {
                              toast.success("Pedido confirmado!");
                              refreshOnline();
                              fetchVendas();
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                          <Check size={14} /> Confirmar
                        </button>
                        <button
                          onClick={async () => {
                            const { error } = await (supabase as any).rpc("processar_recusa_online", { p_venda_id: pedido.id });
                            if (error) {
                              toast.error("Erro ao recusar pedido");
                            } else {
                              toast.success("Pedido recusado");
                              refreshOnline();
                              fetchVendas();
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 border border-destructive/30 hover:bg-destructive hover:text-white text-destructive text-xs font-bold rounded-lg transition-all"
                        >
                          <X size={14} /> Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab !== "online" && (
      <div className="card-metric p-0 overflow-hidden relative">
        <div className="max-h-[60vh] overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur shadow-sm">
              <tr className="border-b border-border">
              <th className="text-left p-3 font-medium text-muted-foreground">DATA</th>
              <th className="text-left p-3 font-medium text-muted-foreground">ITENS</th>
              <th className="text-left p-3 font-medium text-muted-foreground">PAGAMENTO</th>
              <th className="text-left p-3 font-medium text-muted-foreground">CLIENTE</th>
              <th className="text-left p-3 font-medium text-muted-foreground">VALOR VENDA</th>
              <th className="text-left p-3 font-medium text-muted-foreground">TAXA</th>
              <th className="text-left p-3 font-medium text-muted-foreground">TOTAL</th>
              <th className="text-left p-3 font-medium text-muted-foreground">STATUS</th>
              <th className="text-right p-3 font-medium text-muted-foreground">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const taxa = v.entregas?.[0]?.taxa || 0;
              return (
              <tr key={v.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="p-3">{formatDateTime(v.criado_em)}</td>
                <td className="p-3 text-muted-foreground">{v.itemCount} itens</td>
                <td className="p-3">{v.formas_pagamento?.nome || '-'}</td>
                <td className="p-3 text-muted-foreground">{v.clientes?.nome || v.nome_cliente || "-"}</td>
                <td className="p-3">{formatCurrency(Number(v.total))}</td>
                <td className="p-3 text-muted-foreground">
                  {taxa > 0 ? formatCurrency(taxa) : "-"}
                </td>
                <td className="p-3 font-bold text-primary">{formatCurrency(Number(v.total) + taxa)}</td>
                <td className="p-3">
                  <span className={v.situacao === "Concluída" ? "badge-completed" : v.situacao === "Cancelada" ? "badge-cancelled" : "px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full"}>
                    {v.situacao}
                  </span>
                </td>
                <td className="p-3 text-right flex items-center justify-end gap-2">
                  <button onClick={() => viewDetails(v)} className="px-3 py-1.5 text-xs font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md transition-colors">
                    Ver Detalhes
                  </button>
                  {v.situacao === "Em Aberto" && (
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/nova-venda?vendaId=${v.id}&cliente=${v.clientes?.nome || v.nome_cliente || ""}`)} className="px-3 py-1.5 text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors shadow-sm">
                        Adicionar Itens
                      </button>
                      <button onClick={() => { setVendaPagamento(v); setPaymentAmount((Number(v.total) + taxa - v.total_pago).toFixed(2)); setPaymentMethodId(""); setPaymentModalOpen(true); }} className="px-3 py-1.5 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors shadow-sm">
                        Receber Caixa
                      </button>
                    </div>
                  )}
                  {(v.situacao === "Concluída" || v.situacao === "Em Aberto") && (
                    <button onClick={() => cancelVenda(v.id)} className="px-3 py-1.5 text-xs font-semibold border border-destructive/30 hover:bg-destructive hover:text-white text-destructive rounded-md transition-all">
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada
                </td>
              </tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t-2 border-border font-bold">
              <tr>
                <td colSpan={4} className="p-3 text-right text-muted-foreground uppercase text-xs">Totais do Período</td>
                <td className="p-3 text-foreground">{formatCurrency(totals.venda)}</td>
                <td className="p-3 text-muted-foreground font-medium">{formatCurrency(totals.taxa)}</td>
                <td className="p-3 text-primary text-base">{formatCurrency(totals.total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
      )}

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" />
              Receber Pagamento
            </DialogTitle>
          </DialogHeader>
          {vendaPagamento && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted/50 p-3 rounded-lg border border-border text-sm">
                <p><span className="text-muted-foreground">Mesa/Comanda:</span> <strong>{vendaPagamento.clientes?.nome || vendaPagamento.nome_cliente || "-"}</strong></p>
                <div className="flex justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-muted-foreground">Total da Conta:</span>
                  <span className="font-bold">{formatCurrency(Number(vendaPagamento.total) + (vendaPagamento.entregas?.[0]?.taxa || 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Já Pago:</span>
                  <span className="font-bold text-green-600">{formatCurrency(vendaPagamento.total_pago)}</span>
                </div>
                <div className="flex justify-between text-lg mt-1 pt-1 border-t border-border">
                  <span className="font-bold text-destructive">Falta Receber:</span>
                  <span className="font-extrabold text-destructive">{formatCurrency(Number(vendaPagamento.total) + (vendaPagamento.entregas?.[0]?.taxa || 0) - vendaPagamento.total_pago)}</span>
                </div>
              </div>

              <div>
                <Label>Valor a Receber (R$)</Label>
                <input type="number" step="0.01" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mt-1" />
              </div>

              <div>
                <Label className="mb-2 block">Forma de Pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((m) => (
                    <button key={m.id} onClick={() => setPaymentMethodId(m.id)}
                      className={`p-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${paymentMethodId === m.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>Cancelar</Button>
                <Button onClick={submitPartialPayment} disabled={isSubmitting} className="bg-primary text-primary-foreground">
                  {isSubmitting ? "Salvando..." : "Confirmar Recebimento"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detalheVenda} onOpenChange={() => setDetalheVenda(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {detalheVenda && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Data:</span> {formatDateTime(detalheVenda.criado_em)}</p>
                <p><span className="text-muted-foreground">Pagamento:</span> {detalheVenda.formas_pagamento?.nome || '-'}</p>
                <p><span className="text-muted-foreground">Cliente:</span> {detalheVenda.clientes?.nome || detalheVenda.nome_cliente || "-"}</p>
                {detalheVenda.clientes?.telefone && <p><span className="text-muted-foreground">Telefone:</span> {detalheVenda.clientes.telefone}</p>}
                {detalheVenda.entregas?.[0]?.endereco && <p><span className="text-muted-foreground">Endereço:</span> {detalheVenda.entregas[0].endereco}</p>}
                {detalheVenda.observacoes && <p><span className="text-muted-foreground">Obs:</span> {detalheVenda.observacoes}</p>}
              </div>
              <div className="border-t border-border pt-3 space-y-2">
                {detalheItens.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span>{i.quantidade}x {i.nome_produto}</span>
                    <span>{formatCurrency(i.quantidade * i.preco_unitario)}</span>
                  </div>
                ))}
                  {detalheVenda.entregas?.[0]?.taxa && detalheVenda.entregas[0].taxa > 0 ? (
                    <div className="flex justify-between text-sm text-primary">
                      <span>Taxa de Entrega</span>
                      <span>+ {formatCurrency(detalheVenda.entregas[0].taxa)}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-border pt-2 flex justify-between font-bold text-lg">
                    <span>Total Geral</span>
                    <span className="text-primary">{formatCurrency(Number(detalheVenda.total) + (detalheVenda.entregas?.[0]?.taxa || 0))}</span>
                  </div>

                  {detalheVenda.pagamentos_venda && detalheVenda.pagamentos_venda.length > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-border/50">
                      <p className="font-bold mb-2 flex items-center gap-1"><Wallet className="w-4 h-4"/> Histórico de Pagamentos Partciais</p>
                      {detalheVenda.pagamentos_venda.map((pg, idx) => (
                        <div key={pg.id || idx} className="flex justify-between text-sm py-1 bg-muted/40 px-2 rounded mb-1">
                          <span>{pg.formas_pagamento?.nome} <span className="text-xs text-muted-foreground ml-1">({formatDateTime(pg.criado_em)})</span></span>
                          <span className="font-medium text-green-600">{formatCurrency(pg.valor)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                        <span>Restante pendente:</span>
                        <span className="text-destructive font-extrabold">{formatCurrency(
                          Math.max(0, Number(detalheVenda.total) + (detalheVenda.entregas?.[0]?.taxa || 0) - (detalheVenda.pagamentos_venda.reduce((s,p)=>s+Number(p.valor),0)))
                        )}</span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
