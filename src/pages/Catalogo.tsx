import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { 
  Search, Plus, Minus, X, ShoppingCart, 
  ChevronRight, ChevronLeft, QrCode, 
  Clock, ClipboardList, RefreshCw,
  MapPin, Truck, Wallet, Info, ArrowLeft,
  Settings, CheckCircle2
} from "lucide-react";

// ── Types ────────────────────────────────────────────────
interface Product {
  id: string;
  nome: string;
  preco: number;
  imagem_url?: string | null;
  categoria_id: string;
  categorias?: { nome: string } | null;
  estoque?: { saldo: number }[] | null;
  saldo?: number;
}
interface Category { id: string; nome: string; }
interface CartItem { product: Product; quantity: number; }
interface FormasPgto { id: string; nome: string; }

// ── Design Tokens ────────────────────────────────────────
const COLORS = {
  primary: "#D4521A", // Laranja
  dark: "#3D1F0A",    // Marrom escuro
  bg: "#FDF6EE",      // Bege fundo
  textSoft: "#8B6550" // Texto suave
};

// ── Countdown Component ──────────────────────────────────
function Countdown({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  const pct = (seconds / 600) * 100;
  const color = seconds < 120 ? "#ef4444" : seconds < 300 ? "#f59e0b" : COLORS.primary;
  
  return (
    <div className="text-center my-4 font-sans">
      <div className="flex items-center gap-2 justify-center font-bold text-2xl" style={{ color }}>
        <Clock size={20} /> {m}:{s}
      </div>
      <div className="bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden w-full max-w-[200px] mx-auto">
        <div style={{ background: color, width: `${pct}%`, height: "100%", transition: "width 1s linear" }} />
      </div>
      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Aguardando pagamento</p>
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
  
  // Date selection (UI only for now)
  const [selectedDate, setSelectedDate] = useState(0); // 0=Hoje, 1=Amanhã, etc.
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : d.toLocaleDateString('pt-BR', { weekday: 'short' }),
      day: d.getDate(),
      dateFull: d
    };
  });

  // Form state
  const [orderType, setOrderType] = useState<"Delivery" | "Retirada">("Delivery");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cep, setCep] = useState("");
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
  const [globalTaxaEntrega, setGlobalTaxaEntrega] = useState(5); // Default fallback

  // ── Load data ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      const { data: produtosData } = await supabase.from("produtos").select("id, nome, preco, imagem_url, categoria_id").eq("ativo", true).order("nome");
      const { data: estoqueData } = await supabase.from("estoque").select("produto_id, saldo");
      const { data: categoriasData } = await supabase.from("categorias").select("*").order("nome");
      const { data: formasPgtoData } = await supabase.from("formas_pagamento").select("*").order("nome");
      
      if (produtosData) {
        const produtosComInfo = (produtosData as any[]).map(p => {
          const cat = (categoriasData || []).find(c => c.id === p.categoria_id);
          return { 
            ...p, 
            categorias: cat ? { nome: cat.nome } : null, 
            saldo: estoqueData?.find(e => e.produto_id === p.id)?.saldo || 0 
          };
        });
        setProducts(produtosComInfo);
      }
      if (categoriasData) setCategories(categoriasData as Category[]);
      if (formasPgtoData) {
        // Filtrar "Fiado" do catálogo online
        setFormasPgto((formasPgtoData as FormasPgto[]).filter(f => !f.nome.toLowerCase().includes("fiado")));
      }
      
      // Busca taxa de entrega global
      const { data: configData } = await (supabase as any)
        .from("configuracoes")
        .select("valor")
        .eq("chave", "taxa_entrega")
        .maybeSingle();

      if (configData) {
        setGlobalTaxaEntrega(parseFloat(configData.valor));
      } else {
        setGlobalTaxaEntrega(5.00); // Default fallback
      }
    }
    loadData();
  }, []);

  // ── Persistence ─────────────────────────────────────
  useEffect(() => {
    const cid = localStorage.getItem("cliente_id_marmitaria");
    const cNome = localStorage.getItem("cliente_nome_marmitaria");
    const cTel = localStorage.getItem("cliente_tel_marmitaria");
    if (cNome) setNome(cNome);
    if (cTel) setTelefone(cTel);
    if (cid) fetchHistorico();
  }, []);

  // ── Cart helpers ─────────────────────────────────────
  const getStock = (p: Product) => p.saldo ?? 0;
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
  const taxaEntrega = orderType === "Delivery" ? globalTaxaEntrega : 0;
  const total = subtotal + taxaEntrega;
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  // ── History logic ────────────────────────────────────
  async function fetchHistorico() {
    const cid = localStorage.getItem("cliente_id_marmitaria");
    if (!cid) return;
    setHistoryLoading(true);
    const { data } = await supabase.from("vendas").select(`id, criado_em, total, situacao, entregas(status, taxa)`).eq("cliente_id", cid).order("criado_em", { ascending: false });
    setMeusPedidos(data || []);
    setHistoryLoading(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.categoria_id === catFilter;
    return matchSearch && matchCat;
  });

  const getPgtoType = () => {
    const fm = formasPgto.find(f => f.id === pgtoId)?.nome.toLowerCase() || "";
    return { 
      isPix: fm.includes("pix"), 
      isDinheiro: fm.includes("dinheiro"), 
      isCartao: fm.includes("crédito") || fm.includes("credito") || fm.includes("débito") || fm.includes("debito") 
    };
  };

  async function gerarPix() {
    setPixLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/gerar-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}`, "apikey": supabaseKey },
        body: JSON.stringify({ valor: total, descricao: `Pedido Bom Apetite — ${cart.length} itens` }),
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

      // Usando a RPC para persistir o pedido com segurança e debitar estoque
      const { data: vendaId, error: e1 } = await (supabase as any).rpc("realizar_venda", {
        p_itens: cart.map(i => ({ 
          produto_id: i.product.id, 
          quantidade: i.quantity, 
          preco_unitario: i.product.preco, 
          nome_produto: i.product.nome, 
          status_cozinha: 'pendente' 
        })),
        p_pagamento_id: pgtoId,
        p_observacao: obsCompleta || "",
        p_cliente: nome.trim(),
        p_cliente_id: clienteId,
        p_tipo_pedido: orderType,
        p_endereco: orderType === "Delivery" ? endereco : "",
        p_telefone: telefone,
        p_taxa_entrega: orderType === "Delivery" ? 5.00 : 0,
        p_status: "Aguardando confirmação"
      });
      
      if (e1 || !vendaId) throw new Error("Erro ao registrar venda: " + (e1?.message || "ID não retornado"));
      
      if (clienteId) {
        localStorage.setItem("cliente_id_marmitaria", clienteId);
        localStorage.setItem("cliente_nome_marmitaria", nome.trim());
        localStorage.setItem("cliente_tel_marmitaria", telefone.trim());
      }
      
      setPedidoId(vendaId); 
      setStep(4); 
      fetchHistorico();
    } catch (e: any) { alert("Erro: " + e.message); } finally { setSubmitting(false); }
  }

  function resetCheckout() {
    setCheckoutOpen(false); setStep(1); setCart([]); setObservacoes(""); setPgtoId(""); setTroco(""); setPixQr(""); setPixCopyCola(""); setPedidoId("");
    setNome(""); setTelefone(""); setEndereco(""); setComplemento(""); setCep("");
    if (countdownRef.current) clearInterval(countdownRef.current);
  }

  // ── Render ───────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans" style={{ background: COLORS.bg }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
      <style>{`
        body { background: ${COLORS.bg}; font-family: 'DM Sans', sans-serif; }
        h1, h2, h3, .font-playfair { font-family: 'Playfair Display', serif; }
        .pulsing-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 0 rgba(34, 197, 94, 0.4); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .product-card { background: white; border-radius: 20px; overflow: hidden; border: 1px solid rgba(139, 101, 80, 0.1); box-shadow: 0 4px 12px rgba(61, 31, 10, 0.05); transition: all 0.2s; }
        .product-card:active { transform: scale(0.98); }
        .cart-drawer { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top-left-radius: 32px; border-top-right-radius: 32px; z-index: 200; box-shadow: 0 -10px 40px rgba(0,0,0,0.1); max-height: 90vh; overflow-y: auto; }
      `}</style>

      {/* FIXED HEADER */}
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-orange-100/50 px-5 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <img src="/logo-bom-apetite.png" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight" style={{ color: COLORS.dark }}>Bom Apetite</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="pulsing-dot"></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-600">Aberto agora</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setHistoryOpen(true)} className="p-2.5 rounded-full hover:bg-orange-50 transition-colors" style={{ color: COLORS.dark }}>
              <ClipboardList size={22} />
            </button>
            <a href="/login" className="p-2.5 rounded-full hover:bg-orange-50 transition-colors" style={{ color: COLORS.dark }}>
              <Settings size={22} />
            </a>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <section className="px-5 pt-4 pb-2">
        <div className="max-w-6xl mx-auto rounded-[32px] p-6 text-white relative overflow-hidden" style={{ background: COLORS.dark }}>
          <div className="relative z-10">
            <span className="text-orange-400 text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Menu Exclusivo</span>
            <h2 className="text-3xl font-black mb-4">Cardápio do Dia</h2>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium">
                <Truck size={14} className="text-orange-400" /> Delivery
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-[11px] font-medium">
                <Wallet size={14} className="text-orange-400" /> PIX / Cartão
              </div>
            </div>
          </div>
          {/* Subtle decoration */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-orange-400/10 rounded-full blur-2xl"></div>
        </div>
      </section>

      {/* DATE SELECTOR */}
      <section className="px-5 py-4 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {dates.map((d, i) => (
              <button 
                key={i} 
                onClick={() => setSelectedDate(i)}
                className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  selectedDate === i 
                    ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30 scale-105" 
                    : "bg-white border border-gray-100 text-gray-400"
                }`}
              >
                <span className="text-[10px] font-bold uppercase mb-1">{d.label}</span>
                <span className="text-xl font-black">{d.day}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SEARCH AND CATEGORIES */}
      <section className="px-5 py-2 sticky top-[73px] z-[90] bg-inherit">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={20} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="O que você deseja hoje?" 
              className="w-full bg-white border-2 border-transparent focus:border-orange-200 outline-none rounded-2xl py-3.5 pl-12 pr-4 shadow-sm transition-all" 
              style={{ color: COLORS.dark }}
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setCatFilter("Todos")}
              className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                catFilter === "Todos" 
                  ? "bg-[#3D1F0A] text-white" 
                  : "bg-white text-[#8B6550] border border-gray-200"
              }`}
            >
              Todos
            </button>
            {categories.map(c => (
              <button 
                key={c.id} 
                onClick={() => setCatFilter(c.id)}
                className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  catFilter === c.id 
                    ? "bg-[#3D1F0A] text-white" 
                    : "bg-white text-[#8B6550] border border-gray-200"
                }`}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS GRID */}
      <section className="px-5 py-6 pb-32">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const stock = getStock(p);
            const inCart = cart.find(i => i.product.id === p.id)?.quantity || 0;
            return (
              <div key={p.id} className="product-card flex flex-col">
                <div className="relative aspect-video overflow-hidden bg-gray-100">
                  {p.imagem_url ? (
                    <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl bg-orange-50/50">
                      🥘
                    </div>
                  )}
                  {stock > 0 && stock <= 10 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                      Resta {stock}
                    </div>
                  )}
                  {stock <= 0 && (
                     <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-black text-sm uppercase tracking-widest border-2 border-white px-3 py-1 -rotate-3">Esgotado</span>
                     </div>
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-sm text-[9px] font-bold uppercase tracking-wider text-[#D4521A]">
                    {p.categorias?.nome || "Marmita"}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-sm leading-snug mb-1 line-clamp-2" style={{ color: COLORS.dark }}>{p.nome}</h3>
                  <p className="text-[10px] leading-relaxed mb-4 line-clamp-2 flex-1" style={{ color: COLORS.textSoft }}>Prato especial preparado com ingredientes frescos selecionados.</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-lg font-black" style={{ color: COLORS.primary }}>
                      {formatCurrency(p.preco)}
                    </span>
                    
                    {stock > 0 && (
                      <button 
                        onClick={() => addToCart(p)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          inCart > 0 ? "bg-[#3D1F0A] text-white" : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                        }`}
                      >
                        {inCart > 0 ? <span className="font-black text-sm">{inCart}</span> : <Plus size={20} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAB CART */}
      {totalItems > 0 && (
        <div className="fixed bottom-8 left-0 right-0 z-[150] px-5 pointer-events-none">
          <button 
            onClick={() => setCartOpen(true)}
            className="w-full max-w-lg mx-auto bg-[#3D1F0A] text-white flex items-center justify-between p-4 rounded-3xl shadow-2xl pointer-events-auto active:scale-95 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart size={24} />
                <span className="absolute -top-2 -right-2 bg-[#D4521A] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#3D1F0A]">
                  {totalItems}
                </span>
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-orange-300 block leading-none mb-1">Na sacola</span>
                <span className="text-sm font-black uppercase tracking-wider">Ver Carrinho</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black">{formatCurrency(total)}</span>
            </div>
          </button>
        </div>
      )}

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-[200]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)}></div>
          <div className="cart-drawer p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black" style={{ color: COLORS.dark }}>Minha Sacola</h2>
                <p className="text-xs text-[#8B6550]">{totalItems} {totalItems === 1 ? 'item' : 'itens'}</p>
              </div>
              <button 
                onClick={() => setCartOpen(false)} 
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 mb-8 pr-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex gap-4 items-center bg-gray-50 rounded-2xl p-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
                    <img src={item.product.imagem_url || ""} alt={item.product.nome} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm leading-tight mb-1" style={{ color: COLORS.dark }}>{item.product.nome}</h4>
                    <span className="text-orange-600 font-bold text-sm">{formatCurrency(item.product.preco)}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 py-1.5 px-2">
                    <button onClick={() => updateQty(item.product.id, -1)} className="text-orange-600 p-1"><Minus size={16} /></button>
                    <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product.id, 1)} className="text-orange-600 p-1"><Plus size={16} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-200 pt-6 space-y-3 mb-8">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between font-black text-lg" style={{ color: COLORS.dark }}>
                <span>Total</span>
                <span className="text-orange-600">{formatCurrency(total)}</span>
              </div>
            </div>

            <button 
              onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
              className="w-full bg-[#D4521A] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 active:scale-95 transition-all"
            >
              Próximo Passo
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[250] bg-white pt-10 flex flex-col">
          <header className="px-6 flex items-center justify-between mb-8">
            <button onClick={() => step > 1 && step < 4 ? setStep(step - 1) : resetCheckout()} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
              <ArrowLeft size={24} />
            </button>
            {step < 4 ? (
              <span className="text-xs font-black uppercase tracking-widest text-[#8B6550]">Passo {step} de 3</span>
            ) : (
              <span className="text-xs font-black uppercase tracking-widest text-[#8B6550]">Pedido Confirmado</span>
            )}
            <div className="w-10"></div>
          </header>

          <div className="flex-1 overflow-y-auto px-6 max-w-lg mx-auto w-full">
            {step === 4 ? (
              <div className="text-center py-10">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={48} className="text-green-600" />
                </div>
                <h2 className="text-3xl font-black mb-2" style={{ color: COLORS.dark }}>Pronto!</h2>
                <p className="text-gray-500 mb-8 leading-relaxed">Seu pedido foi enviado para a cozinha. Agora é só aguardar!</p>
                
                <div className="bg-orange-50 rounded-3xl p-6 mb-8 border border-orange-100">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2 block">Número do Pedido</span>
                  <span className="text-2xl font-black text-orange-600">#{pedidoId.slice(0, 6).toUpperCase()}</span>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                        const m = encodeURIComponent(`🥘 *Novo Pedido - Bom Apetite*\n*Número:* #${pedidoId.slice(0, 6).toUpperCase()}\n*Cliente:* ${nome}\n*Total:* ${formatCurrency(total)}`);
                        window.open(`https://wa.me/?text=${m}`, '_blank');
                    }}
                    className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2"
                  >
                    Compartilhar no WhatsApp
                  </button>
                  <button onClick={resetCheckout} className="w-full text-gray-400 font-bold text-sm underline">Voltar para o Cardápio</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-black mb-8" style={{ color: COLORS.dark }}>
                  {step === 1 ? "Como deseja receber?" : step === 2 ? "Seus dados" : "Forma de pagamento"}
                </h2>

                {step === 1 && (
                  <div className="space-y-4">
                    <button 
                      onClick={() => setOrderType("Delivery")} 
                      className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center gap-4 ${orderType === "Delivery" ? "border-orange-600 bg-orange-50/50" : "border-gray-100"}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${orderType === "Delivery" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        <Truck size={24} />
                      </div>
                      <div className="text-left">
                        <span className="font-black block leading-none">Receber em Casa (Delivery)</span>
                        <span className="text-xs text-gray-400 mt-1 block">Entregamos com todo cuidado</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setOrderType("Retirada")} 
                      className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center gap-4 ${orderType === "Retirada" ? "border-orange-600 bg-orange-50/50" : "border-gray-100"}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${orderType === "Retirada" ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                        <MapPin size={24} />
                      </div>
                      <div className="text-left">
                        <span className="font-black block leading-none">Vou Buscar (Retirada)</span>
                        <span className="text-xs text-gray-400 mt-1 block">Rua do Sabor, 123 - Centro</span>
                      </div>
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">Seu Nome</label>
                      <input className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Maria Silva" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">WhatsApp</label>
                      <input className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                    {orderType === "Delivery" && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">Endereço Completo</label>
                          <input className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">Complemento</label>
                            <input className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100" value={complemento} onChange={e => setComplemento(e.target.value)} placeholder="Apto, Casa 2..." />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">CEP</label>
                            <input className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100" value={cep} onChange={e => setCep(e.target.value)} placeholder="00000-000" />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">Observações</label>
                      <textarea className="w-full bg-gray-50 border-none rounded-2xl py-4 px-5 outline-none focus:ring-2 ring-orange-100 resize-none h-24" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Alguma restrição ou pedido especial?" />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1">Como deseja pagar?</h4>
                      
                      {/* Opção PIX (Automática) */}
                      {formasPgto.filter(f => f.nome.toLowerCase().includes("pix")).map(f => (
                        <button 
                          key={f.id} 
                          onClick={() => setPgtoId(f.id)}
                          className={`w-full p-5 rounded-3xl border-2 transition-all flex items-center justify-between ${pgtoId === f.id ? "border-orange-600 bg-orange-50/50" : "border-gray-100"}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pgtoId === f.id ? "bg-orange-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                              <QrCode size={20} />
                            </div>
                            <div className="text-left">
                              <span className="font-black text-sm block tracking-tight">Pagar agora com PIX</span>
                              <span className="text-[10px] text-green-600 font-bold">Confirmação instantânea</span>
                            </div>
                          </div>
                          {pgtoId === f.id && <CheckCircle2 className="text-orange-600" size={20} />}
                        </button>
                      ))}

                      {/* Outras formas (Pagar na entrega/retirada) */}
                      <div className="pt-4 mt-4 border-t border-dashed border-gray-200">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8B6550] ml-1 mb-3">Pagar na {orderType === "Delivery" ? "Entrega" : "Retirada"}</h4>
                        <div className="grid grid-cols-1 gap-3">
                          {formasPgto.filter(f => !f.nome.toLowerCase().includes("pix")).map(f => (
                            <button 
                              key={f.id} 
                              onClick={() => setPgtoId(f.id)}
                              className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${pgtoId === f.id ? "border-orange-600 bg-orange-50/50" : "border-gray-100"}`}
                            >
                              <div className="flex items-center gap-3">
                                <Wallet size={18} className={pgtoId === f.id ? "text-orange-600" : "text-gray-400"} />
                                <span className="font-bold text-sm tracking-tight">{f.nome}</span>
                              </div>
                              {pgtoId === f.id && <CheckCircle2 className="text-orange-600" size={18} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {getPgtoType().isPix && (
                      <div className="mt-8 bg-gray-50 rounded-[32px] p-8 border border-dashed border-gray-200">
                        {pixLoading ? (
                          <div className="flex flex-col items-center py-10">
                            <RefreshCw className="animate-spin text-orange-500 mb-4" size={32} />
                            <span className="text-xs font-bold text-gray-500">Gerando seu PIX...</span>
                          </div>
                        ) : pixQr ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-orange-400">Escaneie o QR Code</span>
                            <div className="bg-white p-4 rounded-3xl shadow-sm mb-4 border border-gray-100">
                              <img src={`data:image/png;base64,${pixQr}`} className="w-48 h-48" alt="QR Code" />
                            </div>
                            <Countdown seconds={countdown} />
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(pixCopyCola);
                                alert("Link PIX copiado!");
                              }}
                              className="text-orange-600 text-xs font-bold underline mt-2"
                            >
                              Copiar código PIX
                            </button>
                          </div>
                        ) : (
                          <button onClick={gerarPix} className="w-full bg-green-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2">
                            <QrCode size={20} /> Gerar QR Code
                          </button>
                        )}
                      </div>
                    )}
                    
                    {getPgtoType().isDinheiro && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-2xl animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold text-gray-500 mb-2 block">Precisa de troco para quanto?</label>
                        <input className="w-full bg-white border-none rounded-xl py-3 px-4 outline-none focus:ring-1 ring-orange-200" value={troco} onChange={e => setTroco(e.target.value)} placeholder="Deixe vazio se não precisar" />
                      </div>
                    )}
                  </div>
                )}

                <div className="sticky bottom-0 pt-10 pb-8 bg-white mt-auto">
                    <button 
                      onClick={() => step < 3 ? setStep(step + 1) : handleConfirmar()} 
                      disabled={submitting}
                      className="w-full bg-[#3D1F0A] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? <RefreshCw className="animate-spin" size={20} /> : (step === 3 ? "Confirmar Pedido" : "Continuar")}
                    </button>
                    <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">
                       <span>Subtotal: {formatCurrency(subtotal)}</span>
                       {taxaEntrega > 0 && <span>Taxa: {formatCurrency(taxaEntrega)}</span>}
                    </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyOpen && (
        <div className="fixed inset-0 z-[300] bg-white flex flex-col font-sans">
          <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-black" style={{ color: COLORS.dark }}>Meus Pedidos</h2>
            <button onClick={() => setHistoryOpen(false)} className="p-2 bg-gray-50 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </header>
          
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {historyLoading ? (
              <div className="flex flex-col items-center py-20">
                <RefreshCw className="animate-spin text-orange-500 mb-4" size={32} />
                <span className="text-sm font-bold text-gray-500 font-sans">Buscando seus pedidos...</span>
              </div>
            ) : meusPedidos.length === 0 ? (
              <div className="text-center py-20 font-sans">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList size={32} className="text-orange-200" />
                </div>
                <p className="text-gray-400 font-bold mb-1">Nenhum pedido encontrado</p>
                <p className="text-xs text-gray-300">Você ainda não realizou pedidos conosco.</p>
              </div>
            ) : (
              meusPedidos.map(p => (
                <div key={p.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm font-sans">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Pedido</span>
                      <span className="font-black text-sm" style={{ color: COLORS.dark }}>#{p.id.slice(0, 6).toUpperCase()}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      p.situacao === 'Concluída' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                    }`}>
                      {p.situacao}
                    </div>
                  </div>
                  <div className="flex justify-between items-end border-t border-dashed border-gray-100 pt-3">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold">{new Date(p.criado_em).toLocaleDateString()}</span>
                    </div>
                    <span className="text-base font-black text-orange-600">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-6 bg-gray-50">
            <button 
              onClick={fetchHistorico}
              className="w-full bg-[#3D1F0A] text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} /> Atualizar Lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
