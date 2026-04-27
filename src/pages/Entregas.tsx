import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Bike,
  Clock,
  MapPin,
  Phone,
  Package,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Loader2,
  ChevronRight,
  Filter,
  User,
  ShoppingBag
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Entrega {
  id: string;
  venda_id: string;
  endereco: string;
  telefone: string;
  taxa: number;
  status: 'pendente' | 'saiu_para_entrega' | 'entregue';
  criado_em: string;
  entregador_id: string | null;
  entregador?: { id: string; nome: string; telefone: string | null };
  venda?: {
    id: string;
    nome_cliente: string;
    total: number;
    criado_em: string;
    observacoes: string | null;
    forma_pagamento_id: string;
  };
  itens?: { nome_produto: string; quantidade: number; preco_unitario: number }[];
}

interface FormaPagamento {
  id: string;
  nome: string;
}

export default function Entregas() {
  const { usuario } = useAuth();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [entregadoresAtivos, setEntregadoresAtivos] = useState<{ id: string, nome: string }[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "pendente" | "saiu_para_entrega" | "entregue">("todas");
  const [modalDesignar, setModalDesignar] = useState<{ aberto: boolean, entrega_id: string | null }>({ aberto: false, entrega_id: null });
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<string>("");

  useEffect(() => {
    fetchInitialData();

    // Sincronia em Tempo Real
    const channel = (supabase as any)
      .channel('entregas-realtime')
      .on('postgres_changes', { event: '*', table: 'entregas', schema: 'public' }, () => fetchEntregas())
      .on('postgres_changes', { event: '*', table: 'itens_venda', schema: 'public' }, () => fetchEntregas())
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchEntregas();
  }, [filtroStatus]);

  async function fetchInitialData() {
    setCarregando(true);
    await Promise.all([
      fetchEntregadoresAtivos(),
      fetchFormasPagamento()
    ]);
    setCarregando(false);
  }

  async function fetchFormasPagamento() {
    try {
      const { data } = await supabase.from("formas_pagamento").select("id, nome");
      setFormasPagamento(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchEntregas() {
    // Não setamos carregando global para evitar piscar o header e filtros
    // Apenas se for a primeira carga via fetchInitialData
    try {
      // 1. Query simplificada para evitar erros de join aninhado
      let query = (supabase as any)
        .from("entregas")
        .select(`
          *,
          vendas (*),
          entregadores (*)
        `);

      if (filtroStatus !== "todas") {
        query = query.eq("status", filtroStatus);
      }

      const { data, error } = await query.order("criado_em", { ascending: false });

      if (error) {
        console.error("Erro Supabase:", error);
        throw error;
      }

      // 2. Buscar itens separadamente se necessário para garantir estabilidade
      const formatado = await Promise.all((data || []).map(async (e: any) => {
        const { data: itens } = await (supabase as any)
          .from("itens_venda")
          .select("nome_produto, quantidade, preco_unitario, status_cozinha")
          .eq("venda_id", e.venda_id);

        return {
          ...e,
          entregador: e.entregadores,
          venda: e.vendas,
          itens: itens || []
        };
      }));

      // Filtrar apenas pedidos que já foram finalizados na cozinha (ou não têm itens)
      const liberadas = formatado.filter(e => {
        if (!e.itens || e.itens.length === 0) return true;
        // Só mostra se TODOS os itens estiverem 'entregue' ou 'cancelado' (case-insensitive)
        return e.itens.every((i: any) => {
          const s = (i.status_cozinha || "").toLowerCase();
          return s === 'entregue' || s === 'cancelado' || s === 'concluído';
        });
      });

      setEntregas(liberadas);
    } catch (err) {
      console.error("Erro ao carregar entregas:", err);
      toast.error("Erro ao carregar entregas");
    }
  }

  async function fetchEntregadoresAtivos() {
    try {
      const { data } = await (supabase as any).from("entregadores").select("id, nome").eq("ativo", true);
      setEntregadoresAtivos(data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDesignar() {
    if (!modalDesignar.entrega_id || !entregadorSelecionado) return;

    try {
      const entregador = entregadoresAtivos.find(e => e.id === entregadorSelecionado);
      const entrega = entregas.find(e => e.id === modalDesignar.entrega_id);

      if (!entregador || !entrega) return;

      // 1. Atualizar entrega
      const { error: entErr } = await (supabase as any)
        .from("entregas")
        .update({
          entregador_id: entregador.id,
          status: 'saiu_para_entrega'
        })
        .eq("id", entrega.id);
      if (entErr) throw entErr;

      // 2. Atualizar saldo do entregador
      const { data: entData } = await (supabase as any).from("entregadores").select("saldo_a_receber").eq("id", entregador.id).single();
      const novoSaldo = (Number(entData?.saldo_a_receber) || 0) + (Number(entrega.taxa) || 0);

      const { error: updErr } = await (supabase as any)
        .from("entregadores")
        .update({ saldo_a_receber: novoSaldo })
        .eq("id", entregador.id);
      if (updErr) throw updErr;

      // 3. Auditoria
      await registrarAuditoria({
        usuario_id: usuario?.id || "",
        usuario_nome: usuario?.nome || "",
        tipo: "entrega",
        acao: "Entregador designado",
        detalhes: {
          entregador_nome: entregador.nome,
          cliente: entrega.venda?.nome_cliente,
          taxa: entrega.taxa
        }
      });

      toast.success(`Entregador ${entregador.nome} designado!`);
      setModalDesignar({ aberto: false, entrega_id: null });
      setEntregadorSelecionado("");
      fetchEntregas();
    } catch (err) {
      toast.error("Erro ao designar entregador");
    }
  }

  async function handleConfirmarEntrega(entrega: Entrega) {
    try {
      const { error } = await (supabase as any)
        .from("entregas")
        .update({ status: 'entregue' })
        .eq("id", entrega.id);

      if (error) throw error;

      await registrarAuditoria({
        usuario_id: usuario?.id || "",
        usuario_nome: usuario?.nome || "",
        tipo: "entrega",
        acao: "Entrega confirmada",
        detalhes: {
          entregador_nome: entrega.entregador?.nome,
          cliente: entrega.venda?.nome_cliente,
          endereco: entrega.endereco,
          taxa: entrega.taxa
        }
      });

      toast.success("Entrega finalizada com sucesso!");
      fetchEntregas();
    } catch (err) {
      toast.error("Erro ao confirmar entrega");
    }
  }

  // 1. Priorizar e ordenar as entregas globalmente para numeração consistente
  const entregasOrdenadas = [...entregas].sort((a, b) => {
    // Ordem de Status: pendente (0) < saiu_para_entrega (1) < entregue (2)
    const statusOrder = { pendente: 0, saiu_para_entrega: 1, entregue: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }

    // Dentro do mesmo status:
    if (a.status === 'entregue') {
      // Entregues: Mais recentes primeiro (DESC)
      return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
    }
    // Pendentes e Em Rota: Mais antigos primeiro (ASC) para prioridade de fila
    return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
  });

  const entregasFiltradas = entregasOrdenadas.filter(e => {
    if (filtroStatus === "todas") return true;
    return e.status === filtroStatus;
  });

  const stats = {
    pendentes: entregas.filter(e => e.status === 'pendente').length,
    em_rota: entregas.filter(e => e.status === 'saiu_para_entrega').length,
    entregues_hoje: entregas.filter(e => {
      const hoje = new Date().toLocaleDateString();
      const dataEntrega = new Date(e.criado_em).toLocaleDateString();
      return e.status === 'entregue' && hoje === dataEntrega;
    }).length
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-muted-foreground font-medium">Carregando entregas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight">
            <Bike size={32} className="text-primary" /> Painel de Entregas
          </h1>
          <p className="text-muted-foreground font-medium">Acompanhe as saídas e status das entregas</p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="bg-red-50 border border-red-100 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-black text-red-600 uppercase">Pendentes</span>
            <span className="text-xl font-black text-red-600">{stats.pendentes}</span>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-black text-yellow-600 uppercase">Em Rota</span>
            <span className="text-xl font-black text-yellow-600">{stats.em_rota}</span>
          </div>
          <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-2xl flex flex-col items-center min-w-[100px]">
            <span className="text-[10px] font-black text-green-600 uppercase">Entregues</span>
            <span className="text-xl font-black text-green-600">{stats.entregues_hoje}</span>
          </div>
        </div>
      </div>

      <div className="flex bg-muted/40 p-1.5 rounded-2xl w-fit border border-border/20 self-start">
        {(["todas", "pendente", "saiu_para_entrega", "entregue"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-5 py-2.5 text-xs font-black rounded-xl capitalize transition-all ${filtroStatus === s
                ? "bg-white text-primary shadow-sm shadow-[#1e3a8a]/5 scale-[1.02]"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {s === "saiu_para_entrega" ? "Em Rota" : s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entregasFiltradas.map(e => {
          const posicaoGlobal = entregasOrdenadas.findIndex(item => item.id === e.id) + 1;

          return (
            <div
              key={e.id}
              className={`group bg-white rounded-[2rem] border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${e.status === 'entregue' ? "opacity-75 border-border/30 grayscale-[50%]" : "border-border/60"
                }`}
            >
              <div className={`p-4 flex justify-between items-center ${e.status === 'pendente' ? "bg-red-50/50" :
                  e.status === 'saiu_para_entrega' ? "bg-yellow-50/50" : "bg-muted/30"
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-sm ${e.status === 'entregue' ? "bg-muted-foreground/40" : "bg-[#f97316]"
                    }`}>
                    {posicaoGlobal}º
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Pedido</span>
                  <span className="text-sm font-black text-foreground">#{e.venda_id.substring(0, 6)}</span>
                </div>
                <Badge variant="outline" className={`font-black text-[9px] uppercase tracking-tighter rounded-lg border-2 shadow-sm ${e.status === 'pendente' ? "bg-white text-red-600 border-red-200" :
                    e.status === 'saiu_para_entrega' ? "bg-white text-yellow-600 border-yellow-200" : "bg-white text-green-600 border-green-200"
                  }`}>
                  {e.status === 'pendente' ? "🔴 Pendente" :
                    e.status === 'saiu_para_entrega' ? "🟡 Em Rota" : "🟢 Entregue"}
                </Badge>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground font-black">
                    <User size={16} className="text-primary" /> {e.venda?.nome_cliente || "Consumidor"}
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground text-sm font-medium">
                    <MapPin size={16} className="text-muted-foreground/60 shrink-0 mt-0.5" />
                    <span className="leading-tight">{e.endereco}</span>
                  </div>
                  {e.telefone && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold pt-1">
                      <Phone size={14} className="text-muted-foreground/40" /> {e.telefone}
                    </div>
                  )}
                </div>

                <div className="bg-muted/10 rounded-2xl p-4 border border-border/10 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/20 pb-2">
                    <ShoppingBag size={12} /> Itens do Pedido
                  </div>
                  <div className="space-y-2">
                    {e.itens?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold text-foreground/80">
                        <span>{item.quantidade}x {item.nome_produto}</span>
                      </div>
                    ))}
                    {!e.itens?.length && <p className="text-xs text-muted-foreground italic">Nenhum item encontrado</p>}
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-dashed border-border/40">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Taxa</span>
                    <span className="text-lg font-black text-orange-600">{formatCurrency(e.taxa)}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Pagamento</span>
                    <span className="text-xs font-black text-foreground">
                      {formasPagamento.find(f => f.id === e.venda?.forma_pagamento_id)?.nome || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/60 uppercase">
                  <Clock size={12} /> {formatDateTime(e.criado_em)}
                </div>

                <div className="pt-2">
                  {e.status === 'pendente' && (
                    <Button
                      className="w-full py-6 rounded-2xl font-black text-white shadow-lg shadow-orange-500/10 hover:shadow-orange-500/30 gap-2 text-xs"
                      onClick={() => setModalDesignar({ aberto: true, entrega_id: e.id })}
                    >
                      <Bike size={18} /> DESIGNAR ENTREGADOR
                    </Button>
                  )}
                  {e.status === 'saiu_para_entrega' && (
                    <div className="space-y-3">
                      <div className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-2xl flex items-center justify-center gap-2">
                        <User size={14} className="text-yellow-600" />
                        <span className="text-[10px] font-black text-yellow-700 uppercase tracking-wider">Com: <span className="text-xs">{e.entregador?.nome}</span></span>
                      </div>
                      <Button
                        className="w-full py-6 rounded-2xl font-black bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/10 hover:shadow-green-500/30 gap-2 text-xs"
                        onClick={() => handleConfirmarEntrega(e)}
                      >
                        <CheckCircle2 size={18} /> CONFIRMAR ENTREGA
                      </Button>
                    </div>
                  )}
                  {e.status === 'entregue' && (
                    <div className="flex items-center justify-center gap-2 text-green-600/60 font-black text-[10px] uppercase p-3">
                      <CheckCircle2 size={14} /> Entregue com sucesso
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {entregasFiltradas.length === 0 && (
          <div className="col-span-full py-20 bg-muted/5 border-2 border-dashed border-border/20 rounded-[3rem] flex flex-col items-center justify-center gap-4">
            <Package size={48} className="text-muted-foreground opacity-20" />
            <p className="text-muted-foreground font-medium italic">Nenhuma entrega encontrada para este filtro.</p>
          </div>
        )}
      </div>

      {modalDesignar.aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black mb-6 flex items-center gap-3">
              <Navigation className="text-primary" /> Designar Entregador
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Selecione o Entregador Ativo</label>
                <select
                  className="w-full h-14 rounded-2xl border-2 border-border/40 px-4 font-black text-foreground focus:border-primary focus:outline-none bg-muted/20"
                  value={entregadorSelecionado}
                  onChange={e => setEntregadorSelecionado(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {entregadoresAtivos.map(ent => (
                    <option key={ent.id} value={ent.id}>{ent.nome}</option>
                  ))}
                </select>
                {entregadoresAtivos.length === 0 && (
                  <p className="text-[10px] text-red-500 font-bold px-1 italic">Nenhum entregador ativo disponível.</p>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold" onClick={() => setModalDesignar({ aberto: false, entrega_id: null })}>Cancelar</Button>
                <Button className="flex-1 py-6 rounded-2xl font-black text-white" disabled={!entregadorSelecionado} onClick={handleDesignar}>CONFIRMAR</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
