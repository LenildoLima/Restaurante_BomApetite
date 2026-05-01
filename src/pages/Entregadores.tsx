import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { 
  Bike, 
  Plus, 
  Edit, 
  ToggleLeft, 
  ToggleRight, 
  DollarSign, 
  History, 
  Loader2,
  Trash2,
  CheckCircle2,
  X,
  Smartphone,
  Calendar,
  Wallet
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Entregador {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  saldo_a_receber: number;
  criado_em: string;
}

interface Pagamento {
  id: string;
  entregador_id: string;
  usuario_nome: string;
  valor: number;
  periodo_inicio: string;
  periodo_fim: string;
  observacoes: string | null;
  criado_em: string;
}

interface EntregaDetalhada {
  id: string;
  criado_em: string;
  vendas: {
    cliente: string;
  };
  taxa_entrega: number;
}

interface ComprovanteData {
  entregador: Entregador;
  adminNome: string;
  periodoInicio: string;
  periodoFim: string;
  valorTotal: number;
  dataEmissao: string;
  entregas: EntregaDetalhada[];
}

// ======= CSS PRINT STYLE =======
const printStyle = `
@media print {
  body * { visibility: hidden !important; }
  #receipt-content, #receipt-content * { visibility: visible !important; }
  #receipt-content { position: fixed; left: 0; top: 0; width: 80mm; font-family: monospace !important; font-size: 11px !important; color: black !important; }
  @page { margin: 4mm; size: 80mm auto; }
}
`;

// ======= RECEIPT COMPONENT =======
function Receipt({ data }: { data: ComprovanteData }) {
  const sep = "=".repeat(32);
  const sepLight = "-".repeat(32);
  const totalEntregas = data.entregas.length;

  return (
    <div id="receipt-content" style={{ fontFamily: "monospace", fontSize: 11, width: "100%", maxWidth: 300, padding: "8px 0", background: "white", color: "black" }}>
      <div style={{ textAlign: "center" }}>{sep}</div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 13 }}>Bom Apetite</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>Gestão de Marmitaria</div>
      <div style={{ textAlign: "center" }}>{sep}</div>
      <div style={{ textAlign: "center", fontWeight: "bold" }}>COMPROVANTE DE PAGAMENTO</div>
      <div style={{ textAlign: "center" }}>{sepLight}</div>
      <div style={{ fontSize: 9 }}>Data: {data.dataEmissao}</div>
      <div style={{ fontSize: 9 }}>Autorizado por: {data.adminNome}</div>
      <div style={{ textAlign: "center" }}>{sepLight}</div>
      <div style={{ fontWeight: "bold" }}>ENTREGADOR:</div>
      <div>Nome: {data.entregador.nome}</div>
      {data.entregador.telefone && <div>Tel: {data.entregador.telefone}</div>}
      <div style={{ textAlign: "center" }}>{sepLight}</div>
      <div style={{ fontWeight: "bold" }}>PERÍODO:</div>
      <div>De: {new Date(data.periodoInicio).toLocaleDateString("pt-BR")}</div>
      <div>Até: {new Date(data.periodoFim).toLocaleDateString("pt-BR")}</div>
      <div style={{ textAlign: "center" }}>{sepLight}</div>
      <div style={{ fontWeight: "bold" }}>Entregas realizadas:</div>
      <div style={{ marginTop: 4 }}>
        {data.entregas.map((ent, idx) => (
          <div key={idx} style={{ marginBottom: 4, fontSize: 10 }}>
            • {new Date(ent.criado_em).toLocaleDateString("pt-BR")} | {ent.vendas?.cliente || "Consumidor"}
            <br />
            &nbsp; Taxa: {formatCurrency(ent.taxa_entrega)}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center" }}>{sepLight}</div>
      <div style={{ fontWeight: "bold" }}>TOTAL DE ENTREGAS: {totalEntregas}</div>
      <div style={{ fontWeight: "extrabold", fontSize: 12 }}>VALOR TOTAL: {formatCurrency(data.valorTotal)}</div>
      <div style={{ textAlign: "center" }}>{sep}</div>
      <div style={{ marginTop: 20, textAlign: "center" }}>
        Assinatura entregador:
        <br /><br />
        _______________________________
      </div>
      <div style={{ textAlign: "center", marginTop: 10 }}>{sep}</div>
    </div>
  );
}

export default function Entregadores() {
  const { usuario, isAdmin } = useAuth();
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [carregando, setCarregando] = useState(true);
  
  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalAcerto, setModalAcerto] = useState<{aberto: boolean, entregador: Entregador | null}>({aberto: false, entregador: null});
  const [modalComprovante, setModalComprovante] = useState(false);
  const [dadosComprovante, setDadosComprovante] = useState<ComprovanteData | null>(null);
  
  // Form Entregador
  const [editando, setEditando] = useState<Entregador | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [ativo, setAtivo] = useState(true);

  // Form Acerto
  const [valorPagar, setValorPagar] = useState<number>(0);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [obsAcerto, setObsAcerto] = useState("");

  useEffect(() => {
    fetchEntregadores();
  }, []);

  async function fetchEntregadores() {
    setCarregando(true);
    try {
      const { data } = await (supabase as any).from("entregadores").select("*").order("nome");
      setEntregadores(data || []);
    } catch (err) {
      toast.error("Erro ao carregar entregadores");
    } finally {
      setCarregando(false);
    }
  }

  async function handleSalvarEntregador() {
    if (!nome.trim()) return toast.error("Nome é obrigatório");
    
    try {
      const payload = { nome, telefone, ativo };
      let err;
      
      if (editando) {
        const { error } = await (supabase as any).from("entregadores").update(payload).eq("id", editando.id);
        err = error;
      } else {
        const { error } = await (supabase as any).from("entregadores").insert([{ ...payload, saldo_a_receber: 0 }]);
        err = error;
      }

      if (err) throw err;

      toast.success(editando ? "Entregador atualizado!" : "Entregador cadastrado!");
      fecharModalNovo();
      fetchEntregadores();
    } catch (err) {
      toast.error("Erro ao salvar entregador");
    }
  }

  function abrirEdicao(e: Entregador) {
    setEditando(e);
    setNome(e.nome);
    setTelefone(e.telefone || "");
    setAtivo(e.ativo);
    setModalNovo(true);
  }

  function fecharModalNovo() {
    setModalNovo(false);
    setEditando(null);
    setNome("");
    setTelefone("");
    setAtivo(true);
  }

  async function toggleAtivo(e: Entregador) {
    try {
      const { error } = await (supabase as any).from("entregadores").update({ ativo: !e.ativo }).eq("id", e.id);
      if (error) throw error;
      toast.success(`Entregador ${!e.ativo ? 'ativado' : 'desativado'}!`);
      fetchEntregadores();
    } catch (err) {
      toast.error("Erro ao alterar status");
    }
  }

  async function handleAcerto() {
    const e = modalAcerto.entregador;
    if (!e || !usuario) return;
    if (valorPagar <= 0) return toast.error("Valor inválido");

    try {
      // 1. Registrar pagamento
      const { error: pgErr } = await (supabase as any).from("pagamentos_entregadores").insert({
        entregador_id: e.id,
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        valor: valorPagar,
        periodo_inicio: new Date(dataInicio).toISOString(),
        periodo_fim: new Date(dataFim).toISOString(),
        observacoes: obsAcerto
      });
      if (pgErr) throw pgErr;

      // 2. Zerar saldo do entregador
      const { error: updErr } = await (supabase as any).from("entregadores").update({
        saldo_a_receber: Math.max(0, e.saldo_a_receber - valorPagar)
      }).eq("id", e.id);
      if (updErr) throw updErr;

      // 3. Registrar sangria no caixa
      const { data: caixa } = await (supabase as any).from("caixas").select("*").eq("status", "aberto").maybeSingle();
      if (caixa) {
        await (supabase as any).from("caixa_movimentacoes").insert({
          caixa_id: caixa.id,
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "sangria",
          valor: valorPagar,
          descricao: `Acerto entregador: ${e.nome}`
        });
        await (supabase as any).from("caixas").update({
          total_sangrias: (caixa.total_sangrias || 0) + valorPagar
        }).eq("id", caixa.id);
      }

      // 4. Auditoria
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "entrega",
        acao: "Pagamento realizado ao entregador",
        detalhes: { entregador: e.nome, valor: valorPagar, periodo: `${dataInicio} até ${dataFim}` }
      });

      toast.success("Pagamento realizado com sucesso!");
      
      // 5. Preparar dados do comprovante
      const { data: entregas } = await (supabase as any)
        .from("entregas")
        .select(`
          id,
          criado_em,
          taxa_entrega,
          vendas(cliente)
        `)
        .eq("entregador_id", e.id)
        .eq("status", "entregue")
        .gte("criado_em", new Date(dataInicio).toISOString())
        .lte("criado_em", new Date(new Date(dataFim).setHours(23, 59, 59, 999)).toISOString());

      const now = new Date();
      setDadosComprovante({
        entregador: e,
        adminNome: usuario.nome,
        periodoInicio: dataInicio,
        periodoFim: dataFim,
        valorTotal: valorPagar,
        dataEmissao: now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        entregas: (entregas as any[]) || []
      });

      setModalAcerto({aberto: false, entregador: null});
      setModalComprovante(true);
      fetchEntregadores();
    } catch (err) {
      toast.error("Erro ao realizar acerto");
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-muted-foreground font-medium">Carregando entregadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Bike size={32} className="text-primary" /> Entregadores
          </h1>
          <p className="text-muted-foreground font-medium">Gerenciar entregadores e realizar acertos financeiros</p>
        </div>
        <Button onClick={() => setModalNovo(true)} className="py-6 px-8 rounded-2xl font-black shadow-lg shadow-orange-500/20 gap-2">
          <Plus size={20} /> NOVO ENTREGADOR
        </Button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border/40">
                <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Nome</th>
                <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Telefone</th>
                <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Status</th>
                <th className="p-4 text-left font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Saldo a Receber</th>
                <th className="p-4 text-right font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {entregadores.map(e => (
                <tr key={e.id} className="hover:bg-muted/5 transition-colors">
                  <td className="p-4 font-black text-foreground">{e.nome}</td>
                  <td className="p-4 text-muted-foreground font-medium">{e.telefone || "—"}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      e.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {e.ativo ? "ATIVO" : "INATIVO"}
                    </span>
                  </td>
                  <td className={`p-4 font-black ${e.saldo_a_receber > 0 ? "text-orange-600" : "text-muted-foreground opacity-50"}`}>
                    {formatCurrency(e.saldo_a_receber)}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {e.saldo_a_receber > 0 && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold px-3"
                          onClick={() => {
                            setModalAcerto({aberto: true, entregador: e});
                            setValorPagar(e.saldo_a_receber);
                          }}
                        >
                          <DollarSign size={14} className="mr-1" /> Acertar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => abrirEdicao(e)}>
                        <Edit size={16} />
                      </Button>
                      <button onClick={() => toggleAtivo(e)} className={`p-1.5 transition-colors ${e.ativo ? "text-green-500 hover:text-green-600" : "text-[#1e3a8a]/30 hover:text-[#1e3a8a]/50"}`}>
                        {e.ativo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {entregadores.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground italic font-medium">Nenhum entregador cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL NOVO/EDITAR */}
      {modalNovo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <Bike className="text-primary" /> {editando ? "Editar Entregador" : "Novo Entregador"}
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="font-bold text-muted-foreground">Nome Completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva" className="h-12 rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-muted-foreground">Telefone (Opcional)</Label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="h-12 rounded-xl" />
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/20">
                <Label className="font-bold">Status do Entregador</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/40">
                <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold" onClick={fecharModalNovo}>Cancelar</Button>
                <Button className="flex-1 py-6 rounded-2xl font-black text-white" onClick={handleSalvarEntregador}>SALVAR</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACERTO */}
      {modalAcerto.aberto && modalAcerto.entregador && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <Wallet className="text-orange-600" /> Acerto de Pagamento
            </h2>
            <p className="text-muted-foreground text-sm mb-6">Confirmar pagamento para <span className="text-foreground font-bold">{modalAcerto.entregador.nome}</span></p>
            
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Saldo Pendente</span>
                <span className="text-2xl font-black text-orange-600">{formatCurrency(modalAcerto.entregador.saldo_a_receber)}</span>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-muted-foreground">Valor a Pagar (R$)</Label>
                <Input 
                  type="number" 
                  value={valorPagar} 
                  onChange={e => setValorPagar(Number(e.target.value))} 
                  className="h-14 text-2xl font-black focus:ring-primary border-2" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-muted-foreground">Período de</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-10 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-muted-foreground">Até</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-10 rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-muted-foreground">Observações</Label>
                <textarea 
                  value={obsAcerto}
                  onChange={e => setObsAcerto(e.target.value)}
                  className="w-full min-h-[80px] border-2 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-muted/30"
                  placeholder="Ex: Pagamento referente a semana..."
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/40">
                <Button variant="outline" className="flex-1 py-6 rounded-2xl font-bold" onClick={() => setModalAcerto({aberto: false, entregador: null})}>Cancelar</Button>
                <Button className="flex-1 py-6 rounded-2xl font-black text-white" onClick={handleAcerto}>CONFIRMAR PAGAMENTO</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPROVANTE */}
      {modalComprovante && dadosComprovante && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1e3a8a]/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3 text-green-600">
              <CheckCircle2 /> Pagamento Confirmado!
            </h2>
            <p className="text-muted-foreground text-sm mb-6">O comprovante de acerto está pronto para impressão.</p>
            
            <div className="border border-border rounded-2xl p-4 bg-white overflow-auto max-h-[400px] mb-6 shadow-inner">
              <Receipt data={dadosComprovante} />
            </div>

            <div className="flex gap-4">
              <Button 
                variant="outline" 
                className="flex-1 py-6 rounded-2xl font-bold" 
                onClick={() => {
                  setModalComprovante(false);
                  setDadosComprovante(null);
                }}
              >
                Fechar
              </Button>
              <Button 
                className="flex-1 py-6 rounded-2xl font-black text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30" 
                onClick={() => {
                  const style = document.createElement("style");
                  style.innerHTML = printStyle;
                  document.head.appendChild(style);
                  window.print();
                  setTimeout(() => {
                    document.head.removeChild(style);
                    setModalComprovante(false);
                    setDadosComprovante(null);
                  }, 500);
                }}
              >
                🖨️ IMPRIMIR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
