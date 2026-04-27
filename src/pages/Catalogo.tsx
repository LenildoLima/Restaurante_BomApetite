import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Search, Plus, Minus, X, ShoppingCart, ChevronRight, ChevronLeft, QrCode, Clock, ClipboardList, RefreshCw } from "lucide-react";

// ── Types ────────────────────────────────────────────────
interface Product {
  id: string;
  nome: string;
  preco: number;
  imagem_url?: string | null;
  categoria_id: string;
  categorias?: { nome: string } | null;
  estoque?: { saldo: number }[] | null;
}
interface Category { id: string; nome: string; }
interface CartItem { product: Product; quantity: number; }
interface FormasPgto { id: string; nome: string; }

const ORANGE = "#f97316";
const NAVY = "#1e3a8a";
const BG = "#faf8f5";

const CATEGORY_COLORS: Record<string, string> = {
  Bebidas: "#3b82f6", Lanches: "#f97316", Porções: "#22c55e",
  Sobremesas: "#ec4899", Lançamentos: "#f59e0b", Éxodo: "#6366f1",
};
const catColor = (name: string) => CATEGORY_COLORS[name] || "#94a3b8";

// ── Countdown de 10 minutos ─────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const pct = (seconds / 600) * 100;
  const color = seconds < 120 ? "#ef4444" : seconds < 300 ? "#f59e0b" : ORANGE;
  return (
    <div style={{ textAlign: "center", margin: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", color, fontWeight: 800, fontSize: 22 }}>
        <Clock size={20} /> {m}:{s}
      </div>
      <div style={{ background: "#e5e7eb", borderRadius: 99, height: 6, marginTop: 6, overflow: "hidden" }}>
        <div style={{ background: color, width: `${pct}%`, height: "100%", transition: "width 1s linear, background 0.5s" }} />
      </div>
      <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Tempo restante para pagar</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────
export default function Catalogo() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formasPgto, setFormasPgto] = useState<FormasPgto[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [meusPedidos, setMeusPedidos] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Form state
  const [orderType, setOrderType] = useState<"Local" | "Delivery">("Local");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [complemento, setComplemento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pgtoId, setPgtoId] = useState("");
  const [troco, setTroco] = useState("");

  // PIX
  const [pixQr, setPixQr] = useState("");
  const [pixCopyCola, setPixCopyCola] = useState("");
  const [pixLoading, setPixLoading] = useState(false);
  const [countdown, setCountdown] = useState(600);
  const countdownRef = useRef<any>(null);

  // Success
  const [pedidoId, setPedidoId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Load data ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: produtosData } = await supabase.from("produtos").select("id, nome, preco, imagem_url, categoria_id").eq("ativo", true).order("nome");
      const { data: estoqueData } = await supabase.from("estoque").select("produto_id, saldo");
      const { data: categoriasData } = await supabase.from("categorias").select("*").order("nome");
      if (produtosData) {
        const produtosComInfo = (produtosData as any[]).map(p => {
          const cat = (categoriasData || []).find(c => c.id === p.categoria_id);
          return { ...p, categorias: cat ? { nome: cat.nome } : null, saldo: estoqueData?.find(e => e.produto_id === p.id)?.saldo || 0 };
        });
        setProducts(produtosComInfo);
      }
      if (categoriasData) setCategories(categoriasData as Category[]);
      supabase.from("formas_pagamento").select("*").order("nome").then(({ data }) => setFormasPgto((data as FormasPgto[]) || []));
    }
    loadData();
  }, []);

  // ── Cart helpers ─────────────────────────────────────
  const getStock = (p: Product) => (p as any).saldo ?? 0;
  const addToCart = (p: Product) => {
    if (getStock(p) <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.product.id === p.id);
      if (ex) return prev.map(i => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product: p, quantity: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: i.quantity + delta } : i).filter(i => i.quantity > 0));
  const subtotal = cart.reduce((s, i) => s + i.product.preco * i.quantity, 0);
  const total = cart.reduce((s, i) => s + i.product.preco * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  // ── History logic ────────────────────────────────────
  async function fetchHistorico() {
    const cid = localStorage.getItem("cliente_id_lanchonete");
    if (!cid) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("vendas").select(`id, criado_em, total, situacao, entregas(status, taxa)`).eq("cliente_id", cid).order("criado_em", { ascending: false });
    setMeusPedidos(data || []);
    setHistoryLoading(false);
  }

  useEffect(() => {
    const cid = localStorage.getItem("cliente_id_lanchonete");
    const cNome = localStorage.getItem("cliente_nome_lanchonete");
    const cTel = localStorage.getItem("cliente_tel_lanchonete");
    if (cNome) setNome(cNome);
    if (cTel) setTelefone(cTel);
    if (cid) fetchHistorico();
  }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.categoria_id === catFilter;
    return matchSearch && matchCat;
  });

  const getPgtoType = () => {
    const fm = formasPgto.find(f => f.id === pgtoId)?.nome.toLowerCase() || "";
    return { isPix: fm.includes("pix"), isDinheiro: fm.includes("dinheiro"), isCartao: fm.includes("crédito") || fm.includes("credito") || fm.includes("débito") || fm.includes("debito") };
  };

  async function gerarPix() {
    setPixLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/gerar-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}`, "apikey": supabaseKey },
        body: JSON.stringify({ valor: total, descricao: `Pedido LaunchApp — ${cart.length} itens` }),
      });
      const data = await res.json();
      if (data.success) {
        setPixQr(data.qr_code_base64 || ""); setPixCopyCola(data.qr_code || ""); setCountdown(600);
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(countdownRef.current); return 0; } return c - 1; }), 1000);
      } else alert("Erro ao gerar PIX: " + (data.error || "Tente novamente"));
    } catch { alert("Erro de comunicação ao gerar PIX"); } finally { setPixLoading(false); }
  }

  useEffect(() => {
    if (step === 3 && getPgtoType().isPix && !pixQr) gerarPix();
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step, pgtoId]);

  // ── Submit ────────────────────────────────────────────
  async function handleConfirmar() {
    if (!nome.trim() || !telefone.trim()) { alert("Nome e telefone são obrigatórios"); return; }
    if (!pgtoId) { alert("Selecione a forma de pagamento"); return; }
    if (orderType === "Delivery" && !endereco.trim()) { alert("Endereço obrigatório para delivery"); return; }
    setSubmitting(true);
    try {
      let clienteId: string | null = null;
      const { data: clientes } = await supabase.from("clientes").select("id").ilike("telefone", telefone.trim()).limit(1);
      if (clientes && clientes.length > 0) clienteId = clientes[0].id;
      else {
        const { data: nC } = await supabase.from("clientes").insert({ nome: nome.trim(), telefone: telefone.trim(), endereco: endereco || null, complemento: complemento || null }).select("id").single();
        clienteId = nC?.id || null;
      }
      const { isDinheiro } = getPgtoType();
      const obsCompleta = [observacoes, isDinheiro && troco ? `Troco para R$ ${troco}` : ""].filter(Boolean).join(" | ");
      const { data: venda, error: e1 } = await supabase.from("vendas").insert({ nome_cliente: nome.trim(), cliente_id: clienteId, forma_pagamento_id: pgtoId, total: subtotal, situacao: "Aguardando confirmação", observacoes: obsCompleta || null } as any).select("id").single();
      if (e1 || !venda) throw new Error("Erro ao registrar venda");
      await supabase.from("itens_venda").insert(cart.map(i => ({ venda_id: venda.id, produto_id: i.product.id, nome_produto: i.product.nome, quantidade: i.quantity, preco_unitario: i.product.preco, status_cozinha: 'pendente' })));
      if (orderType === "Delivery") await supabase.from("entregas").insert({ venda_id: venda.id, cliente_id: clienteId, endereco: endereco, complemento: complemento || null, telefone: telefone, taxa: 0, tipo_pedido: "Entrega", status: "aguardando" } as any);
      
      if (clienteId) {
        localStorage.setItem("cliente_id_lanchonete", clienteId);
        localStorage.setItem("cliente_nome_lanchonete", nome.trim());
        localStorage.setItem("cliente_tel_lanchonete", telefone.trim());
      }
      localStorage.setItem("ultimo_pedido_lanchonete", JSON.stringify({ id: venda.id, itens: cart.map(i => ({ nome: i.product.nome, qtd: i.quantity })), total, timestamp: Date.now() }));
      setPedidoId(venda.id); setStep(4); setCheckoutOpen(true); fetchHistorico();
    } catch (e: any) { alert("Erro: " + e.message); } finally { setSubmitting(false); }
  }

  function resetCheckout() {
    localStorage.removeItem("ultimo_pedido_lanchonete");
    setCheckoutOpen(false); setStep(1); setCart([]); setObservacoes(""); setPgtoId(""); setTroco(""); setPixQr(""); setPixCopyCola(""); setPedidoId("");
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  useEffect(() => {
    const salvo = localStorage.getItem("ultimo_pedido_lanchonete");
    if (salvo) {
      try {
        const d = JSON.parse(salvo);
        if (Date.now() - d.timestamp < 86400000) { setPedidoId(d.id); setStep(4); setCheckoutOpen(true); }
        else localStorage.removeItem("ultimo_pedido_lanchonete");
      } catch { localStorage.removeItem("ultimo_pedido_lanchonete"); }
    }
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        body { background: ${BG}; }
        .cat-btn { border: none; cursor: pointer; border-radius: 99px; padding: 6px 16px; font-size: 13px; font-weight: 700; transition: all .15s; }
        .prod-card { background: #fff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,.07); overflow: hidden; transition: transform .15s; cursor: pointer; }
        .prod-card:hover:not(.disabled) { transform: translateY(-3px); }
        .cart-fab { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: ${ORANGE}; color: #fff; border: none; border-radius: 99px; padding: 14px 28px; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 8px 32px rgba(249,115,22,.4); z-index: 100; display: flex; align-items: center; gap: 10px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
        .modal-panel { background: #fff; border-radius: 24px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,.2); }
        .step-btn { width: 100%; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 800; border: none; cursor: pointer; }
        .pill-radio { border: 2px solid #e5e7eb; border-radius: 12px; padding: 14px; cursor: pointer; text-align: center; flex: 1; }
        .pill-radio.active { border-color: ${ORANGE}; background: #fff7ed; }
        .input-field { width: 100%; border: 2px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; font-size: 14px; outline: none; }
        .pgto-btn { border: 2px solid #e5e7eb; border-radius: 12px; padding: 12px 16px; cursor: pointer; font-weight: 700; background: #fff; width: 100%; }
        .pgto-btn.active { border-color: ${ORANGE}; background: #fff7ed; color: ${ORANGE}; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <header style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, #ea580c 100%)`, padding: "16px 20px", position: "sticky", top: 0, zIndex: 110 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(30,58,138,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🍔</div>
            <div>
              <span style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>LaunchApp</span>
              <p style={{ fontSize: 10, color: "#FACC15", fontWeight: 800, textTransform: "uppercase" }}>Cardápio Online</p>
            </div>
          </div>
          <button onClick={() => { setHistoryOpen(true); fetchHistorico(); }} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <ClipboardList size={16} /> Meus Pedidos
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 120px" }}>
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={18} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produtos..." style={{ width: "100%", padding: "12px 14px 12px 42px", border: "2px solid #e5e7eb", borderRadius: 12, fontSize: 15, outline: "none", background: "#fff" }} />
        </div>
        
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          <button className="cat-btn" onClick={() => setCatFilter("Todos")} style={{ background: catFilter === "Todos" ? ORANGE : "#fff", border: "1px solid #e5e7eb", minWidth: 80 }}>Todos</button>
          {categories.map(c => (
            <button key={c.id} className="cat-btn" onClick={() => setCatFilter(c.id)} style={{ background: catFilter === c.id ? catColor(c.nome) : "#fff", color: catFilter === c.id ? "#fff" : "#374151", border: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{c.nome}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {filtered.map(p => {
            const stock = getStock(p);
            const inCart = cart.find(i => i.product.id === p.id)?.quantity || 0;
            return (
              <div key={p.id} className={`prod-card${stock <= 0 ? " disabled" : ""}`} onClick={() => addToCart(p)}>
                {p.imagem_url && <img src={p.imagem_url} alt={p.nome} style={{ width: "100%", height: 110, objectFit: "cover" }} />}
                <div style={{ padding: 12 }}>
                  {!p.imagem_url && <span style={{ background: catColor(p.categorias?.nome || ""), color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 4, textTransform: "uppercase" }}>{p.categorias?.nome}</span>}
                  <p style={{ fontWeight: 700, fontSize: 13, color: NAVY, marginTop: 4 }}>{p.nome}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontWeight: 900, color: ORANGE }}>{formatCurrency(p.preco)}</span>
                    {stock > 0 ? (inCart > 0 ? <span style={{ background: ORANGE, color: "#fff", fontWeight: 800, fontSize: 11, borderRadius: 99, padding: "1px 8px" }}>{inCart}</span> : <Plus size={18} color={ORANGE} />) : <span style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>Esgotado</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalItems > 0 && !cartOpen && !checkoutOpen && <button className="cart-fab" onClick={() => setCartOpen(true)}><ShoppingCart size={20} /> Ver Sacola ({totalItems})</button>}

      {cartOpen && (
        <div className="modal-overlay" onClick={() => setCartOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, color: NAVY }}>Sua Sacola</h2>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none" }}><X size={22} /></button>
            </div>
            {cart.map(item => (
              <div key={item.product.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, background: "#f9fafb", padding: 10, borderRadius: 10 }}>
                <div><p style={{ fontWeight: 700, fontSize: 14 }}>{item.product.nome}</p><p style={{ color: ORANGE, fontWeight: 800, fontSize: 12 }}>{formatCurrency(item.product.preco * item.quantity)}</p></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => updateQty(item.product.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}>-</button>
                  <span style={{ fontWeight: 800 }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: ORANGE, color: "#fff" }}>+</button>
                </div>
              </div>
            ))}
            <div style={{ borderTop: "2px solid #eee", paddingTop: 15, textAlign: "right", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, marginRight: 10 }}>Subtotal:</span>
              <span style={{ fontWeight: 900, fontSize: 20, color: ORANGE }}>{formatCurrency(total)}</span>
            </div>
            <button className="step-btn" style={{ background: ORANGE, color: "#fff" }} onClick={() => { setCartOpen(false); setCheckoutOpen(true); setStep(1); }}>Finalizar Pedido</button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ background: step === 4 ? "#fff" : "#fff" }}>
            {step === 4 ? (
              <div style={{ textAlign: "center", position: "relative" }}>
                <button onClick={resetCheckout} style={{ position: "absolute", top: -10, right: -10, background: "none", border: "none" }}><X size={20} /></button>
                <div style={{ fontSize: 60, marginBottom: 10 }}>✅</div>
                <h2 style={{ fontWeight: 900, color: NAVY }}>Pedido Recebido!</h2>
                <p style={{ fontSize: 22, fontWeight: 900, color: ORANGE, margin: "10px 0" }}>#{pedidoId.slice(0, 6).toUpperCase()}</p>
                <button onClick={() => {
                  const m = encodeURIComponent(`🍔 *Meu Pedido*\nNúmero: #${pedidoId.slice(0, 6).toUpperCase()}\nTotal: ${formatCurrency(total)}`);
                  window.open(`https://wa.me/?text=${m}`, '_blank');
                }} style={{ width: "100%", padding: 12, background: "#25d366", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, marginBottom: 15 }}>🟢 Compartilhar WhatsApp</button>
                <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Acompanhe em "Meus Pedidos" no topo da página.</p>
                <button className="step-btn" style={{ background: ORANGE, color: "#fff" }} onClick={resetCheckout}>Novo Pedido</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 18 }}>{step === 1 ? "Entrega" : step === 2 ? "Dados" : "Pagamento"}</h2>
                  <button onClick={() => setCheckoutOpen(false)} style={{ background: "none", border: "none" }}><X size={22} /></button>
                </div>
                {step === 1 && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div className={`pill-radio${orderType === "Local" ? " active" : ""}`} onClick={() => setOrderType("Local")}>🍽️<p>Retirar</p></div>
                    <div className={`pill-radio${orderType === "Delivery" ? " active" : ""}`} onClick={() => setOrderType("Delivery")}>🛵<p>Entrega</p></div>
                  </div>
                )}
                {step === 2 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
                    <input className="input-field" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="WhatsApp" />
                    {orderType === "Delivery" && <input className="input-field" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço" />}
                    <textarea className="input-field" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações" />
                  </div>
                )}
                {step === 3 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {formasPgto.map(f => <button key={f.id} className={`pgto-btn${pgtoId === f.id ? " active" : ""}`} onClick={() => setPgtoId(f.id)}>{f.nome}</button>)}
                    </div>
                    {getPgtoType().isPix && (
                      <div style={{ textAlign: "center", background: "#f0fdf4", padding: 15, borderRadius: 10 }}>
                        {pixLoading ? "Gerando..." : pixQr ? <><img src={`data:image/png;base64,${pixQr}`} style={{ width: 150, borderRadius: 10 }} /><Countdown seconds={countdown} /></> : <button onClick={gerarPix} className="step-btn" style={{ background: "#16a34a", color: "#fff" }}>Gerar PIX</button>}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                  {step > 1 && <button className="step-btn" style={{ background: "#eee", flex: 1 }} onClick={() => setStep(step - 1)}>Voltar</button>}
                  <button className="step-btn" style={{ background: ORANGE, color: "#fff", flex: 2 }} onClick={() => step < 3 ? setStep(step + 1) : handleConfirmar()} disabled={submitting}>{submitting ? "Enviando..." : step === 3 ? "Confirmar" : "Próximo"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, color: NAVY }}>Meus Pedidos</h2>
              <button onClick={() => setHistoryOpen(false)} style={{ background: "none", border: "none" }}><X size={22} /></button>
            </div>
            {historyLoading ? <p style={{ textAlign: "center", padding: 30 }}>Carregando...</p> : meusPedidos.length === 0 ? <p style={{ textAlign: "center", color: "#999", padding: 30 }}>Nenhum pedido feito.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {meusPedidos.map(p => (
                  <div key={p.id} style={{ background: "#fff", borderRadius: 12, padding: 15, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontWeight: 800 }}>#{p.id.slice(0, 6).toUpperCase()}</span>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 5, background: p.situacao === "Concluída" ? "#f0fdf4" : "#fff7ed", color: p.situacao === "Concluída" ? "#16a34a" : ORANGE }}>{p.situacao}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#999" }}>{new Date(p.criado_em).toLocaleDateString()}</span>
                      <span style={{ fontWeight: 900 }}>{formatCurrency(p.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="step-btn" style={{ background: NAVY, color: "#fff", marginTop: 20 }} onClick={fetchHistorico} disabled={historyLoading}><RefreshCw size={16} className={historyLoading ? "animate-spin" : ""} style={{ marginRight: 8 }} /> Atualizar Lista</button>
          </div>
        </div>
      )}
    </div>
  );
}
