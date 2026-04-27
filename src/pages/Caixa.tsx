import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  Plus,
  Minus,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Loader2,
  Calendar,
  User,
  MoreVertical,
  Scale,
  Activity,
  ShoppingBag
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Caixa {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  status: 'aberto' | 'fechado';
  valor_abertura: number;
  valor_fechamento: number | null;
  total_vendas: number;
  total_sangrias: number;
  total_suprimentos: number;
  diferenca: number | null;
  observacoes: string | null;
  aberto_em: string;
  fechado_em: string | null;
}

interface Movimentacao {
  id: string;
  tipo: 'sangria' | 'suprimento' | 'venda';
  valor: number;
  descricao: string | null;
  usuario_nome?: string;
  criado_em: string;
}

export default function Caixa() {
  const { usuario, isAdmin } = useAuth();
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null);
  const [ultimoCaixa, setUltimoCaixa] = useState<Caixa | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [historia, setHistoria] = useState<Caixa[]>([]);

  // Modais
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [modalMov, setModalMov] = useState<{ aberto: boolean, tipo: 'sangria' | 'suprimento' | null }>({ aberto: false, tipo: null });

  // Form Abertura
  const [valorAbertura, setValorAbertura] = useState<number>(0);
  const [obsAbertura, setObsAbertura] = useState("");

  // Form Movimentação
  const [valorMov, setValorMov] = useState<number>(0);
  const [descMov, setDescMov] = useState("");

  // Form Fechamento
  const [valorFechamento, setValorFechamento] = useState<number>(0);
  const [obsFechamento, setObsFechamento] = useState("");

  useEffect(() => {
    carregarDados();
  }, [usuario]);

  async function carregarDados() {
    if (!usuario) return;
    setCarregando(true);
    try {
      // 1. Buscar caixa aberto
      const { data: aberto } = await (supabase as any)
        .from("caixas")
        .select("*")
        .eq("status", "aberto")
        .maybeSingle();

      if (aberto) {
        setCaixaAberto(aberto as any);

        // Buscar todas as movimentações
        const { data: movs } = await (supabase as any)
          .from("caixa_movimentacoes")
          .select("*")
          .eq("caixa_id", aberto.id)
          .order("criado_em", { ascending: false });
        setMovimentacoes((movs as any[]) || []);

        // Buscar TODAS as vendas concluídas desde a abertura
        const { data: vendasDetalhadas } = await (supabase as any)
          .from("vendas")
          .select("id, criado_em, total, nome_cliente, clientes(nome), entregas(taxa), formas_pagamento(nome)")
          .eq("situacao", "Concluída")
          .gte("criado_em", (aberto as any).aberto_em);

        const vData = (vendasDetalhadas as any[]) || [];
        
        // Total de todas as vendas (Dinheiro + Pix + Cartão)
        const totalGeralVendas = vData.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

        // Mapear vendas para o formato de movimentação
        const vendasMapeadas: Movimentacao[] = vData.map(v => ({
          id: v.id,
          tipo: 'venda',
          valor: Number(v.total) || 0,
          descricao: `Venda (${v.formas_pagamento?.nome || '—'}) para ${v.clientes?.nome || v.nome_cliente || 'Cliente'}`,
          criado_em: v.criado_em
        }));

        // Mesclar e ordenar por data decrescente
        const todasMovs = [...(movs as any[] || []), ...vendasMapeadas].sort((a, b) => 
          new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
        );

        setMovimentacoes(todasMovs);
        setCaixaAberto(prev => prev ? { ...prev, total_vendas: totalGeralVendas } : null);
      } else {
        setCaixaAberto(null);
        // Buscar último caixa fechado para sugestão de valor
        const { data: ultimo } = await (supabase as any)
          .from("caixas")
          .select("*")
          .eq("status", "fechado")
          .order("fechado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        setUltimoCaixa(ultimo as any);
        if (ultimo) setValorAbertura((ultimo as any).valor_fechamento || 0);
      }

      const { data: h } = await (supabase as any)
        .from("caixas")
        .select("*")
        .order("aberto_em", { ascending: false })
        .limit(20);
      setHistoria((h as any[]) || []);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados do caixa");
    } finally {
      setCarregando(false);
    }
  }

  async function handleAbrirCaixa() {
    if (!usuario) return;
    try {
      const { data, error } = await (supabase as any).from("caixas").insert({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        status: "aberto",
        valor_abertura: valorAbertura,
        observacoes: obsAbertura,
        total_vendas: 0,
        total_sangrias: 0,
        total_suprimentos: 0,
        aberto_em: new Date().toISOString()
      }).select().single();

      if (error) throw error;

      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "caixa",
        acao: "Caixa aberto",
        detalhes: { valor_abertura: valorAbertura }
      });

      toast.success("Caixa aberto com sucesso!");
      setModalAbrir(false);
      carregarDados();
    } catch (err) {
      toast.error("Erro ao abrir caixa");
    }
  }

  async function handleMovimentacao() {
    if (!usuario || !caixaAberto || !modalMov.tipo) return;
    try {
      const { error: movErr } = await (supabase as any).from("caixa_movimentacoes").insert({
        caixa_id: caixaAberto.id,
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: modalMov.tipo,
        valor: valorMov,
        descricao: descMov
      });

      if (movErr) throw movErr;

      // Atualizar totais no caixa
      const updates = modalMov.tipo === 'suprimento'
        ? { total_suprimentos: caixaAberto.total_suprimentos + valorMov }
        : { total_sangrias: caixaAberto.total_sangrias + valorMov };

      await (supabase as any).from("caixas").update(updates).eq("id", caixaAberto.id);

      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "caixa",
        acao: modalMov.tipo === 'suprimento' ? "Suprimento registrado" : "Sangria registrada",
        detalhes: { valor: valorMov, descricao: descMov }
      });

      toast.success(`${modalMov.tipo === 'suprimento' ? 'Suprimento' : 'Sangria'} realizado!`);
      setModalMov({ aberto: false, tipo: null });
      setValorMov(0);
      setDescMov("");
      carregarDados();
    } catch (err) {
      toast.error("Erro ao registrar movimentação");
    }
  }

  async function handleFecharCaixa() {
    if (!usuario || !caixaAberto) return;
    try {
      const saldoEsperado = caixaAberto.valor_abertura + caixaAberto.total_suprimentos + caixaAberto.total_vendas - caixaAberto.total_sangrias;
      const diferenca = valorFechamento - saldoEsperado;

      const { error } = await (supabase as any).from("caixas").update({
        status: "fechado",
        valor_fechamento: valorFechamento,
        diferenca: diferenca,
        fechado_em: new Date().toISOString(),
        observacoes: obsFechamento ? `${caixaAberto.observacoes || ""}\nFechamento: ${obsFechamento}` : caixaAberto.observacoes
      }).eq("id", caixaAberto.id);

      if (error) throw error;

      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "caixa",
        acao: "Caixa fechado",
        detalhes: {
          valor_abertura: caixaAberto.valor_abertura,
          valor_fechamento: valorFechamento,
          total_vendas: caixaAberto.total_vendas,
          diferenca
        }
      });

      toast.success("Caixa fechado com sucesso!");
      setModalFechar(false);
      carregarDados();
    } catch (err) {
      toast.error("Erro ao fechar caixa");
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-muted-foreground font-medium">Carregando informações do caixa...</p>
      </div>
    );
  }

  // ESTADO: SEM CAIXA ABERTO
  if (!caixaAberto) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="max-w-xl mx-auto py-12">
          <div className="bg-white rounded-3xl p-10 shadow-xl border border-border/40 text-center flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-inner">
              <Wallet size={40} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground mb-2">Nenhum caixa aberto</h1>
              <p className="text-muted-foreground font-medium">Abra o caixa para começar a registrar vendas e gerenciar o fluxo de dinheiro.</p>
            </div>

            {ultimoCaixa && (
              <div className="bg-muted/50 rounded-2xl p-6 w-full space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Último fechamento:</span>
                  <span className="font-bold text-foreground">{formatDateTime(ultimoCaixa.fechado_em!)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Saldo final:</span>
                  <span className="font-bold text-foreground text-lg">{formatCurrency(ultimoCaixa.valor_fechamento || 0)}</span>
                </div>
                <div className="pt-2 border-t border-border/50 text-orange-600 font-bold flex justify-between">
                  <span>Sugestão de abertura:</span>
                  <span>{formatCurrency(ultimoCaixa.valor_fechamento || 0)}</span>
                </div>
              </div>
            )}

            <Button onClick={() => setModalAbrir(true)} className="w-full py-8 text-lg font-black rounded-2xl shadow-lg shadow-orange-500/20 gap-3">
              <Plus size={20} />
              ABRIR CAIXA AGORA
            </Button>
          </div>
        </div>

        {/* Histórico Completo para Admin */}
        {isAdmin() && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black flex items-center gap-2">
                <History className="text-primary" /> Histórico de Caixas
              </h2>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-border/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border/40">
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Abertura</th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Responsável</th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Valor Abertura</th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Vendas</th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Supr./Sang.</th>
                      <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Fechamento</th>
                      <th className="p-4 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {historia.map(c => (
                      <tr key={c.id} className="hover:bg-muted/5 transition-colors">
                        <td className="p-4 whitespace-nowrap font-medium">{formatDateTime(c.aberto_em)}</td>
                        <td className="p-4 text-muted-foreground">{c.usuario_nome}</td>
                        <td className="p-4">{formatCurrency(c.valor_abertura)}</td>
                        <td className="p-4 text-green-600 font-medium">{formatCurrency(c.total_vendas)}</td>
                        <td className="p-4 text-muted-foreground">
                          {formatCurrency(c.total_suprimentos)} / {formatCurrency(c.total_sangrias)}
                        </td>
                        <td className="p-4 font-bold">{c.valor_fechamento ? formatCurrency(c.valor_fechamento) : <span className="text-orange-500 italic">Em curso...</span>}</td>
                        <td className={`p-4 text-right font-black text-md ${c.status === 'fechado'
                            ? (c.diferenca && c.diferenca < 0 ? "text-red-500" : c.diferenca && c.diferenca > 0 ? "text-green-500" : "text-[#1e3a8a]/40")
                            : "text-[#1e3a8a]/30"
                          }`}>
                          {c.status === 'fechado' ? formatCurrency(c.diferenca || 0) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal Abrir */}
        {modalAbrir && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <Wallet size={20} />
                </div>
                <h2 className="text-xl font-black">Abrir Novo Caixa</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Valor Inicial em Dinheiro (R$)</label>
                  <Input
                    type="number"
                    value={valorAbertura}
                    onChange={e => setValorAbertura(Number(e.target.value))}
                    className="h-14 text-2xl font-black focus:ring-primary border-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Observações (Opcional)</label>
                  <textarea
                    value={obsAbertura}
                    onChange={e => setObsAbertura(e.target.value)}
                    className="w-full min-h-[100px] border-2 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-muted/30"
                    placeholder="Ex: Utilizando troco da reserva..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold" onClick={() => setModalAbrir(false)}>Cancelar</Button>
                  <Button className="flex-1 py-6 rounded-2xl font-black text-white" onClick={handleAbrirCaixa}>ABRIR CAIXA</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ESTADO: CAIXA ABERTO
  const saldoEsperado = caixaAberto.valor_abertura + caixaAberto.total_suprimentos + caixaAberto.total_vendas - caixaAberto.total_sangrias;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Administrativo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-border/40">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-green-600 animate-pulse">
            <Activity size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black">Caixa Aberto</h1>
              <span className="bg-green-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">EM OPERAÇÃO</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Iniciado por <span className="text-foreground font-bold">{caixaAberto.usuario_nome}</span> às <span className="text-foreground font-bold">{formatDateTime(caixaAberto.aberto_em)}</span>
            </p>
          </div>
        </div>
        <Button onClick={() => setModalFechar(true)} variant="destructive" className="py-7 px-8 rounded-2xl font-black text-md shadow-lg shadow-red-500/20 gap-2">
          <Clock size={20} />
          FECHAR CAIXA
        </Button>
      </div>

      {/* Grid de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Abertura", value: caixaAberto.valor_abertura, icon: Wallet, color: "blue" },
          { label: "Vendas Totais", value: caixaAberto.total_vendas, icon: DollarSign, color: "green" },
          { label: "Suprimentos", value: caixaAberto.total_suprimentos, icon: ArrowUpRight, color: "emerald" },
          { label: "Sangrias", value: caixaAberto.total_sangrias, icon: ArrowDownRight, color: "red" },
        ].map((item, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-border/40 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${item.color === 'blue' ? "bg-blue-50 text-blue-600" :
                item.color === 'green' ? "bg-green-50 text-green-600" :
                  item.color === 'emerald' ? "bg-emerald-50 text-emerald-600" :
                    "bg-red-50 text-red-600"
              }`}>
              <item.icon size={24} />
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</p>
              <p className="text-xl font-black">{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Destaque Saldo Esperado */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-8 md:p-10 text-white shadow-xl shadow-orange-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:scale-[1.01]">
        <div>
          <p className="text-orange-100 font-bold uppercase tracking-widest text-xs mb-1">Saldo Total Esperado (Gestão)</p>
          <h2 className="text-5xl font-black tracking-tighter">{formatCurrency(saldoEsperado)}</h2>
          <p className="text-orange-200/80 text-sm mt-3 font-medium">(Abertura + Vendas Totais + Suprimentos - Sangrias)</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setModalMov({ aberto: true, tipo: 'suprimento' })} className="bg-white text-orange-600 hover:bg-orange-50 font-black py-7 px-8 rounded-2xl gap-2 shadow-lg">
            <Plus size={20} /> SUPRIMENTO
          </Button>
          <Button onClick={() => setModalMov({ aberto: true, tipo: 'sangria' })} className="bg-[#1e3a8a]/10 text-white hover:bg-[#1e3a8a]/20 border border-white/20 font-black py-7 px-8 rounded-2xl gap-2 backdrop-blur-sm">
            <Minus size={20} /> SANGRIA
          </Button>
        </div>
      </div>

      {/* Lista de Movimentações */}
      <div className="bg-white rounded-3xl shadow-sm border border-border/40 overflow-hidden">
        <div className="p-6 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <h2 className="text-lg font-black flex items-center gap-2">
            <Scale className="text-primary" size={20} /> Movimentações do Turno
          </h2>
          <span className="text-xs font-bold text-muted-foreground">{movimentacoes.length} registros</span>
        </div>

        <div className="overflow-auto max-h-[45vh] scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/40">
              <tr className="border-b border-border/40 text-left">
                <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Tipo</th>
                <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Descrição</th>
                <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Responsável</th>
                <th className="p-4 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Hora</th>
                <th className="p-4 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {movimentacoes.map((m) => (
                <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      m.tipo === 'suprimento' ? "bg-green-100 text-green-700 border border-green-200" : 
                      m.tipo === 'sangria' ? "bg-red-100 text-red-700 border border-red-200" :
                      "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}>
                      {m.tipo === 'suprimento' ? <Plus size={10} /> : m.tipo === 'sangria' ? <Minus size={10} /> : <ShoppingBag size={10} />}
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground font-medium">{m.descricao || "—"}</td>
                  <td className="p-4 font-bold text-foreground/80">{m.usuario_nome || "Sistema"}</td>
                  <td className="p-4 text-muted-foreground">{new Date(m.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className={`p-4 text-right font-black text-md ${
                    m.tipo === 'sangria' ? "text-red-600" : "text-green-600"
                  }`}>
                    {m.tipo === 'sangria' ? "-" : "+"}{formatCurrency(m.valor)}
                  </td>
                </tr>
              ))}
              {movimentacoes.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground italic font-medium">Nenhuma movimentação registrada neste turno.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais Movimentação */}
      {modalMov.aberto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              {modalMov.tipo === 'suprimento' ? (
                <><Plus className="text-green-600" /> Registrar Suprimento</>
              ) : (
                <><Minus className="text-red-600" /> Registrar Sangria</>
              )}
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Valor (R$)</label>
                <Input
                  type="number"
                  autoFocus
                  value={valorMov || ""}
                  onChange={e => setValorMov(Number(e.target.value))}
                  className="h-14 text-2xl font-black focus:ring-primary border-2"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground">Motivo/Descrição</label>
                <Input
                  value={descMov}
                  onChange={e => setDescMov(e.target.value)}
                  className="h-12 border-2 rounded-xl"
                  placeholder="Ex: Reforço de troco..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold" onClick={() => setModalMov({ aberto: false, tipo: null })}>Cancelar</Button>
                <Button className={`flex-1 py-6 rounded-2xl font-black text-white ${modalMov.tipo === 'suprimento' ? "bg-green-600 hover:bg-green-700 font-white" : "bg-red-600 hover:bg-red-700"}`} onClick={handleMovimentacao}>
                  CONFIRMAR
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Fechamento */}
      {modalFechar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-black mb-2">Conferência e Fechamento</h2>
            <p className="text-muted-foreground text-sm mb-8 font-medium">Verifique os valores antes de encerrar o turno de trabalho.</p>

            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Abertura</p>
                  <p className="text-md font-bold text-foreground">{formatCurrency(caixaAberto.valor_abertura)}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Total de Vendas (Tudo)</p>
                  <p className="text-md font-bold text-foreground">{formatCurrency(caixaAberto.total_vendas)}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-2xl border border-border/20">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Total Movimentações</p>
                  <p className="text-md font-bold">
                    <span className="text-green-600">+{formatCurrency(caixaAberto.total_suprimentos)}</span> / <span className="text-red-600">-{formatCurrency(caixaAberto.total_sangrias)}</span>
                  </p>
                </div>
              </div>

              <div className="bg-primary/10 border-2 border-primary/20 p-6 rounded-3xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1">Saldo Esperado (Dinheiro + Pix + Cartão)</p>
                  <p className="text-3xl font-black text-primary">{formatCurrency(saldoEsperado)}</p>
                </div>
                <AlertCircle size={32} className="text-primary/40 opacity-50" />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-foreground">Quanto dinheiro tem fisicamente no caixa agora? *</label>
                  <Input
                    type="number"
                    value={valorFechamento || ""}
                    onChange={e => setValorFechamento(Number(e.target.value))}
                    className="h-16 text-3xl font-black focus:ring-primary border-2 pl-4 placeholder:text-muted-foreground/30"
                    placeholder="0,00"
                  />
                </div>

                {/* Cálculo do Diferença em Tempo Real */}
                {valorFechamento >= 0 && (
                  <div className={`p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${Math.abs(valorFechamento - saldoEsperado) < 0.01 ? "bg-green-50 border-green-200 text-green-700 shadow-sm" :
                      valorFechamento > saldoEsperado ? "bg-blue-50 border-blue-200 text-blue-700" :
                        "bg-red-50 border-red-200 text-red-700"
                    }`}>
                    <span className="text-sm font-bold">
                      {Math.abs(valorFechamento - saldoEsperado) < 0.01 ? "Caixa conferido ✓" :
                        valorFechamento > saldoEsperado ? "Sobra em caixa" : "Falta de dinheiro"}
                    </span>
                    <span className="text-xl font-black">
                      {formatCurrency(valorFechamento - saldoEsperado)}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground">Observações de Fechamento</label>
                  <textarea
                    value={obsFechamento}
                    onChange={e => setObsFechamento(e.target.value)}
                    className="w-full min-h-[100px] border-2 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-muted/30"
                    placeholder="Justifique qualquer diferença se necessário..."
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/40">
                <Button variant="outline" className="flex-1 py-8 rounded-2xl font-bold" onClick={() => setModalFechar(false)}>Cancelar</Button>
                <Button className="flex-1 py-8 rounded-2xl font-black text-lg shadow-lg shadow-orange-500/20 text-white" onClick={handleFecharCaixa}>FECHAR CAIXA</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
