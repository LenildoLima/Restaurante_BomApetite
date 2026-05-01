import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { 
  Clock, 
  ChefHat, 
  CheckCircle2, 
  Play, 
  Check, 
  Flame,
  User,
  Hash,
  ShoppingBag
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { registrarAuditoria } from "@/lib/auditoria";

interface ItemPedido {
  id: string;
  nome_produto: string;
  quantidade: number;
  status_cozinha: 'pendente' | 'preparando' | 'pronto' | 'entregue';
  venda_id: string;
  vendas?: {
    id: string;
    criado_em: string;
    nome_cliente: string | null;
    tipo_pedido: string;
    clientes?: { nome: string };
  };
}

interface PedidoAgrupado {
  id_grupo: string; // venda_id + status
  venda_id: string;
  status_cozinha: 'pendente' | 'preparando' | 'pronto';
  nome_cliente: string;
  tipo_pedido: string;
  criado_em: string;
  itens: { id: string; nome_produto: string; quantidade: number }[];
}

export default function KDS() {
  const { usuario } = useAuth();
  const [pedidos, setPedidos] = useState<PedidoAgrupado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPedidos();

    // Inscrição em Tempo Real para atualizações instantâneas
    const channel = (supabase as any)
      .channel('kds-changes')
      .on(
        'postgres_changes', 
        { event: '*', table: 'vendas', schema: 'public' }, 
        () => fetchPedidos()
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, []);

  async function fetchPedidos() {
    try {
      const { data: itensRaw, error } = await (supabase as any)
        .from("itens_venda")
        .select(`
          id,
          nome_produto,
          quantidade,
          status_cozinha,
          venda_id
        `)
        .in("status_cozinha", ["pendente", "preparando", "pronto"]);

      if (error) throw error;
      if (!itensRaw || itensRaw.length === 0) {
        setPedidos([]);
        return;
      }

      // Buscar as vendas únicas que JÁ FORAM CONFIRMADAS
      const vendaIdsRaw = [...new Set(itensRaw.map((i: any) => i.venda_id))];
      const { data: vendas, error: vError } = await (supabase as any)
        .from("vendas")
        .select(`
          id,
          criado_em,
          nome_cliente,
          situacao,
          tipo_pedido,
          clientes (nome),
          entregas (endereco, telefone, taxa)
        `)
        .in("id", vendaIdsRaw)
        .neq("situacao", "Aguardando confirmação") // TRAVA: Ignora se não confirmado
        .or('tipo_pedido.in.("Retirada","Delivery"),tipo_pedido.is.null');

      if (vError) throw vError;

      const validVendaIds = new Set((vendas || []).map((v: any) => v.id));
      const itens = (itensRaw as any[]).filter(i => validVendaIds.has(i.venda_id));
      const vendasMap = Object.fromEntries((vendas || []).map((v: any) => [v.id, v]));

      if (itens.length === 0) {
        setPedidos([]);
        return;
      }

      // Agrupar itens por (venda_id + status)
      const grupos: Record<string, PedidoAgrupado> = {};
      
      (itens as any[]).forEach(item => {
        const v = vendasMap[item.venda_id];
        if (!v) return; // Venda não encontrada

        const key = `${item.venda_id}-${item.status_cozinha}`;
        if (!grupos[key]) {
          grupos[key] = {
            id_grupo: key,
            venda_id: item.venda_id,
            status_cozinha: item.status_cozinha,
            nome_cliente: v.clientes?.nome || v.nome_cliente || "Balcão",
            tipo_pedido: v.tipo_pedido || "Presencial",
            criado_em: v.criado_em,
            itens: [],
            // Adicionando dados extras para quando precisar criar entrega
            endereco: v.entregas?.[0]?.endereco,
            telefone: v.entregas?.[0]?.telefone,
            taxa: v.entregas?.[0]?.taxa
          } as any;
        }
        grupos[key].itens.push({
          id: item.id,
          nome_produto: item.nome_produto,
          quantidade: item.quantidade
        });
      });

      // Ordenar por data da venda em memória
      const sortedGrupos = Object.values(grupos).sort((a, b) => 
        new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime()
      );

      setPedidos(sortedGrupos);
    } catch (error: any) {
      console.error("Erro ao buscar pedidos:", error?.message || error);
      toast.error(error?.message || "Erro ao carregar pedidos da cozinha");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(grupo: PedidoAgrupado, novoStatus: string) {
    try {
      const itemIds = grupo.itens.map(i => i.id);

      const { error } = await (supabase as any)
        .from("itens_venda")
        .update({ status_cozinha: novoStatus })
        .in("id", itemIds);

      if (error) throw error;

      // 1. Quando todos os itens ficam PRONTOS
      if (novoStatus === 'pronto') {
        const { data: faltantes } = await supabase
          .from("itens_venda")
          .select("id")
          .eq("venda_id", grupo.venda_id)
          .not("status_cozinha", "in", `(pronto,entregue,cancelado,concluído)`);

        if (!faltantes || faltantes.length === 0) {
          // Só cria registro de entrega se for Delivery
          if (grupo.tipo_pedido === 'Delivery') {
            const { data: entregaExistente } = await supabase
              .from("entregas")
              .select("id")
              .eq("venda_id", grupo.venda_id)
              .limit(1);

            if (entregaExistente && entregaExistente.length > 0) {
              await supabase
                .from("entregas")
                .update({ status: 'pendente' } as any)
                .eq("venda_id", grupo.venda_id);
            } else {
              await supabase
                .from("entregas")
                .insert({ 
                  venda_id: grupo.venda_id, 
                  status: 'pendente',
                  endereco: (grupo as any).endereco || '',
                  telefone: (grupo as any).telefone || '',
                  taxa: (grupo as any).taxa || 0
                } as any);
            }
          }
        }
      }

      // 2. Mantém comportamento para quando o status é ENTREGUE (balão/finalização)
      if (novoStatus === 'entregue') {
        const { data: faltantes } = await (supabase as any)
          .from("itens_venda")
          .select("id")
          .eq("venda_id", grupo.venda_id)
          .not("status_cozinha", "in", '("entregue", "cancelado", "concluído")');

        if (!faltantes || faltantes.length === 0) {
          if (grupo.tipo_pedido === 'Delivery') {
            await supabase
              .from("entregas")
              .update({ status: 'pendente' } as any)
              .eq("venda_id", grupo.venda_id);
          }
        }
      }

      // Registrar Auditoria
      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "venda",
          acao: `Cozinha: Pedido ${novoStatus}`,
          detalhes: { item_ids: itemIds, status: novoStatus }
        });
      }

      toast.success(`Itens atualizados para: ${novoStatus}`);
      fetchPedidos();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar status dos itens");
    }
  }

  function getTimer(dateStr: string) {
    const start = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 60000); // minutos
    return diff;
  }

  const pendentes = pedidos.filter(p => p.status_cozinha === 'pendente');
  const preparando = pedidos.filter(p => p.status_cozinha === 'preparando');
  const prontos = pedidos.filter(p => p.status_cozinha === 'pronto');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen md:h-[calc(100vh-80px)] md:overflow-hidden flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-black flex items-center gap-2 md:gap-3">
            <ChefHat className="text-primary md:w-9 md:h-9 md:grow-0" size={24} /> Visão de Cozinha (KDS)
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Gerenciamento em tempo real</p>
        </div>
        <div className="flex flex-row gap-2 md:gap-4">
          <Badge variant="outline" className="px-2 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-md font-bold text-orange-600 bg-orange-50 border-orange-200">
            {pendentes.length} Pendentes
          </Badge>
          <Badge variant="outline" className="px-2 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-md font-bold text-blue-600 bg-blue-50 border-blue-200">
            {preparando.length} Preparando
          </Badge>
          <Badge variant="outline" className="px-2 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-md font-bold text-green-600 bg-green-50 border-green-200">
            {pedidos.length} Total
          </Badge>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-2 md:p-4 -m-2 md:-m-4 overflow-y-auto md:overflow-x-auto">
        {/* COLUNA: PENDENTES */}
        <div className="flex flex-col gap-4 bg-muted/30 p-4 rounded-3xl border border-border/40">
          <h2 className="text-lg font-black flex items-center gap-2 px-2">
            <Clock className="text-orange-500" size={20} /> FILA DE ESPERA
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
            {pendentes.map(p => (
              <PedidoCard key={p.id_grupo} pedido={p} onAction={() => updateStatus(p, 'preparando')} actionLabel="INICIAR" actionIcon={<Play size={16} />} color="orange" timer={getTimer(p.criado_em)} />
            ))}
            {pendentes.length === 0 && <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhum pedido pendente</p>}
          </div>
        </div>

        {/* COLUNA: EM PREPARO */}
        <div className="flex flex-col gap-4 bg-blue-50/30 p-4 rounded-3xl border border-blue-100">
          <h2 className="text-lg font-black flex items-center gap-2 px-2 text-blue-800">
            <Flame className="text-blue-500 animate-pulse" size={20} /> EM PREPARO
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
            {preparando.map(p => (
              <PedidoCard key={p.id_grupo} pedido={p} onAction={() => updateStatus(p, 'pronto')} actionLabel="PRONTO" actionIcon={<CheckCircle2 size={16} />} color="blue" timer={getTimer(p.criado_em)} />
            ))}
            {preparando.length === 0 && <p className="text-center py-10 text-muted-foreground text-sm italic">Nada sendo preparado agora</p>}
          </div>
        </div>

        {/* COLUNA: PRONTOS */}
        <div className="flex flex-col gap-4 bg-green-50/30 p-4 rounded-3xl border border-green-100">
          <h2 className="text-lg font-black flex items-center gap-2 px-2 text-green-800">
            <CheckCircle2 className="text-green-500" size={20} /> PRONTO / AGUARDANDO
          </h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
            {prontos.map(p => (
              <PedidoCard key={p.id_grupo} pedido={p} onAction={() => updateStatus(p, 'entregue')} actionLabel="ENTREGUE" actionIcon={<Check size={16} />} color="green" timer={getTimer(p.criado_em)} />
            ))}
            {prontos.length === 0 && <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhum pedido finalizado</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PedidoCard({ pedido, onAction, actionLabel, actionIcon, color, timer }: { 
  pedido: PedidoAgrupado, 
  onAction: () => void, 
  actionLabel: string, 
  actionIcon: React.ReactNode,
  color: 'orange' | 'blue' | 'green',
  timer: number
}) {
  const getTimerColor = () => {
    if (timer > 20) return "text-red-600 bg-red-50 border-red-200 animate-pulse";
    if (timer > 10) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-muted-foreground bg-muted border-border/50";
  };

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all hover:scale-[1.02] ${
      color === 'orange' ? "border-orange-200" : color === 'blue' ? "border-blue-200" : "border-green-200"
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            color === 'orange' ? "bg-orange-100 text-orange-600" : color === 'blue' ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
          }`}>
            <ShoppingBag size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm leading-none">{pedido.nome_cliente}</h4>
              <Badge variant="outline" className={`text-[8px] h-4 px-1 font-black uppercase ${
                pedido.tipo_pedido === 'Delivery' ? "border-orange-500 text-orange-600 bg-orange-50" : 
                pedido.tipo_pedido === 'Retirada' ? "border-blue-500 text-blue-600 bg-blue-50" : 
                "border-gray-500 text-gray-600 bg-gray-50"
              }`}>
                {pedido.tipo_pedido}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
              Pedido de {new Date(pedido.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <Badge className={`font-black text-[10px] uppercase ${getTimerColor()}`}>
          {timer}m
        </Badge>
      </div>

      <div className="space-y-2 mb-4 bg-muted/20 p-2 rounded-xl border border-dashed border-border/60">
        {pedido.itens.map(item => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center bg-background rounded-md border border-border text-[10px] font-black">{item.quantidade}x</span>
              <span className="font-bold text-foreground/80">{item.nome_produto}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onAction}
        className={`w-full py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${
          color === 'orange' ? "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20" : 
          color === 'blue' ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20" : 
          "bg-green-600 text-white hover:bg-green-700 shadow-green-500/20"
        }`}
      >
        {actionIcon} {actionLabel}
      </button>
    </div>
  );
}
