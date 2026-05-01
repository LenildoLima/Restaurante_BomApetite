import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getCategoriaBadgeClass } from "@/lib/format";
import { Search, ShoppingCart, Plus, Minus, X, UserPlus, Check, Printer, User } from "lucide-react";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface Product {
  id: string;
  nome: string;
  categoria_id: string;
  categorias?: { nome: string };
  preco: number;
  estoque?: any;
  ativo: boolean;
  imagem_url?: string;
}
interface Category { id: string; nome: string; }
interface PaymentMethod { id: string; nome: string; }
interface Cliente { id: string; nome: string; telefone: string | null; endereco: string | null; complemento: string | null; }
interface CartItem { product: Product; quantity: number; }

interface ReceiptData {
  orderType: "Presencial" | "Retirada" | "Delivery";
  identification: string;
  cart: CartItem[];
  subtotal: number;
  deliveryFee: number;
  totalGeral: number;
  paymentName: string;
  notes: string;
  trocoValor: string;
  noTroco: boolean;
  isDinheiro: boolean;
  clienteNome: string;
  clienteTelefone: string;
  clienteEndereco: string;
  clienteComplemento: string;
  dataHora: string;
  qrCodeBase64?: string;
  qrCodeTexto?: string;
}

// ======= CSS PRINT STYLE =======
const printStyle = `
@media print {
  body * { visibility: hidden !important; }
  #receipt-content, #receipt-content * { visibility: visible !important; }
  #receipt-content { position: fixed; left: 0; top: 0; width: 80mm; font-family: monospace !important; font-size: 12px !important; }
  @page { margin: 4mm; size: 80mm auto; }
}
`;

// ======= RECEIPT COMPONENT =======
function Receipt({ data }: { data: ReceiptData }) {
  const sep = "─".repeat(32);
  const sepScissors = "- - - - - - - - - - - ✂ - - - - - - - - - - -";

  if (data.orderType !== "Delivery") {
    return (
      <div id="receipt-content" style={{ fontFamily: "monospace", fontSize: 12, width: "100%", maxWidth: 300, padding: "8px 0" }}>
        <div style={{ textAlign: "center", fontWeight: "bold" }}>Bom Apetite</div>
        <div style={{ textAlign: "center", fontSize: 10 }}>Gestão de Marmitaria</div>
        <div style={{ textAlign: "center", fontSize: 10 }}>{data.dataHora}</div>
        <div>{sep}</div>
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 14, letterSpacing: 2 }}>COMANDA</div>
        {data.identification && (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: "bold" }}>▶ {data.identification} ◀</div>
        )}
        <div>{sep}</div>
        {data.cart.map((i, idx) => {
          const val = formatCurrency(i.product.preco * i.quantity);
          const label = `${i.quantity}x ${i.product.nome}`;
          const spaces = Math.max(1, 32 - label.length - val.length);
          return <div key={idx}>{label}{" ".repeat(spaces)}{val}</div>;
        })}
        <div>{sep}</div>
        <div style={{ fontWeight: "bold" }}>{"TOTAL"}{" ".repeat(32 - 5 - formatCurrency(data.totalGeral).length)}{formatCurrency(data.totalGeral)}</div>
        <div>{sep}</div>
        <div>Pagamento: {data.paymentName}</div>
        
        {data.paymentName.toLowerCase() === 'pix' && data.qrCodeBase64 && (
          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div>{sep}</div>
            <div style={{ fontWeight: "bold", margin: "4px 0" }}>Escaneie o QR Code para pagar</div>
            <img 
              src={`data:image/png;base64,${data.qrCodeBase64}`}
              style={{ width: 150, height: 150, margin: '8px auto', display: 'block' }}
              alt="QR Code PIX"
            />
            <div>{sep}</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>Ou copie o código PIX:</div>
            <div style={{ fontSize: 9, wordBreak: "break-all", textAlign: "center", marginTop: 4 }}>
              {data.qrCodeTexto?.match(/.{1,30}/g)?.join('\n')}
            </div>
            <div>{sep}</div>
          </div>
        )}

        {data.notes && <><div>{sep}</div><div style={{ fontSize: 11 }}>Obs: {data.notes}</div></>}
        <div>{sep}</div>
        <div style={{ textAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>Bom apetite! <img src="/logo-bom-apetite.png" alt="Logo" style={{ width: 24, height: 24 }} /></div>
      </div>
    );
  }

  // Entrega — 2 vias
  const trocoNum = !data.noTroco && data.isDinheiro && data.trocoValor ? parseFloat(data.trocoValor) : null;
  const trocoVal = trocoNum !== null ? trocoNum - data.totalGeral : null;

  return (
    <div id="receipt-content" style={{ fontFamily: "monospace", fontSize: 12, width: "100%", maxWidth: 300, padding: "8px 0" }}>
      {/* VIA 1 - COZINHA */}
      <div style={{ textAlign: "center", fontWeight: "bold" }}>LaunchApp</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>Gestão de Lanchonete</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>{data.dataHora}</div>
      <div>{sep}</div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 13, letterSpacing: 1 }}>PEDIDO {data.orderType.toUpperCase()} - COZINHA</div>
      <div>{sep}</div>
      {data.cart.map((i, idx) => (
        <div key={idx} style={{ fontWeight: "bold" }}>{i.quantity}x {i.product.nome}</div>
      ))}
      {data.notes && <><div>{sep}</div><div style={{ fontSize: 11 }}>Obs: {data.notes}</div></>}
      <div style={{ marginTop: 8 }}></div>

      {/* SEPARADOR TESOURA */}
      <div style={{ textAlign: "center", fontSize: 10, margin: "6px 0" }}>{sepScissors}</div>

      {/* VIA 2 - ENTREGADOR */}
      <div style={{ textAlign: "center", fontWeight: "bold" }}>LaunchApp</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>Gestão de Lanchonete</div>
      <div style={{ textAlign: "center", fontSize: 10 }}>{data.dataHora}</div>
      <div>{sep}</div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 13, letterSpacing: 1 }}>PEDIDO {data.orderType.toUpperCase()} - ENTREGA</div>
      <div>{sep}</div>
      <div style={{ fontWeight: "bold" }}>{data.clienteNome}</div>
      {data.clienteTelefone && <div>Tel: {data.clienteTelefone}</div>}
      {data.clienteEndereco && <div>End: {data.clienteEndereco}</div>}
      {data.clienteComplemento && <div>Comp: {data.clienteComplemento}</div>}
      <div>{sep}</div>
      {data.cart.map((i, idx) => {
        const val = formatCurrency(i.product.preco * i.quantity);
        const label = `${i.quantity}x ${i.product.nome}`;
        const spaces = Math.max(1, 32 - label.length - val.length);
        return <div key={idx}>{label}{" ".repeat(spaces)}{val}</div>;
      })}
      <div>{sep}</div>
      <div>{"Subtotal"}{" ".repeat(32 - 8 - formatCurrency(data.subtotal).length)}{formatCurrency(data.subtotal)}</div>
      <div>{"Taxa entrega"}{" ".repeat(32 - 12 - formatCurrency(data.deliveryFee).length)}{formatCurrency(data.deliveryFee)}</div>
      <div style={{ fontWeight: "bold" }}>{"TOTAL"}{" ".repeat(32 - 5 - formatCurrency(data.totalGeral).length)}{formatCurrency(data.totalGeral)}</div>
      <div>{sep}</div>
      <div>Pagamento: {data.paymentName}</div>

      {data.paymentName.toLowerCase() === 'pix' && data.qrCodeBase64 && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <div>{sep}</div>
          <div style={{ fontWeight: "bold", margin: "4px 0" }}>Escaneie o QR Code para pagar</div>
          <img 
            src={`data:image/png;base64,${data.qrCodeBase64}`}
            style={{ width: 150, height: 150, margin: '8px auto', display: 'block' }}
            alt="QR Code PIX"
          />
          <div>{sep}</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>Ou copie o código PIX:</div>
          <div style={{ fontSize: 9, wordBreak: "break-all", textAlign: "center", marginTop: 4 }}>
            {data.qrCodeTexto?.match(/.{1,30}/g)?.join('\n')}
          </div>
          <div>{sep}</div>
        </div>
      )}

      {data.isDinheiro && !data.noTroco && trocoNum !== null && (
        <>
          <div>Troco para: {formatCurrency(trocoNum)}</div>
          {trocoVal !== null && trocoVal >= 0 && <div>Troco: {formatCurrency(trocoVal)}</div>}
        </>
      )}
      {data.notes && <><div>{sep}</div><div style={{ fontSize: 11 }}>Obs: {data.notes}</div></>}
      <div>{sep}</div>
      <div style={{ marginTop: 8, padding: "8px 0", borderTop: "1px dashed #000" }}>
        Entregador: _______________________
      </div>
      <div style={{ textAlign: "center", marginTop: 4 }}>Bom apetite! 🛵</div>
    </div>
  );
}

export default function NewSale() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedVendaId = searchParams.get("vendaId");
  const linkedCliente = searchParams.get("cliente");
  const { usuario } = useAuth();
  const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string; bgSoft: string }> = {
    Bebidas: { bg: "#3b82f6", border: "#bfdbfe", text: "#1d4ed8", bgSoft: "#eff6ff" },
    Lanches: { bg: "#f97316", border: "#fed7aa", text: "#c2410c", bgSoft: "#fff7ed" },
    Éxodo: { bg: "#6366f1", border: "#c7d2fe", text: "#4338ca", bgSoft: "#eef2ff" },
    Porções: { bg: "#22c55e", border: "#bbf7d0", text: "#15803d", bgSoft: "#f0fdf4" },
    Sobremesas: { bg: "#ec4899", border: "#fbcfe8", text: "#be185d", bgSoft: "#fdf2f8" },
    Lançamentos: { bg: "#f59e0b", border: "#fde68a", text: "#b45309", bgSoft: "#fffbeb" },
    Default: { bg: "#94a3b8", border: "#e2e8f0", text: "#475569", bgSoft: "#f8fafc" }
  };

  const getStyle = (name: string) => CATEGORY_STYLES[name] || CATEGORY_STYLES.Default;
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);

  const [orderType, setOrderType] = useState<"Presencial" | "Retirada" | "Delivery">("Presencial");
  const [identification, setIdentification] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [address, setAddress] = useState("");
  const [complement, setComplement] = useState("");
  const [phone, setPhone] = useState("");

  const [clientQuery, setClientQuery] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<Cliente[]>([]);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientNome, setNewClientNome] = useState("");
  const [newClientTelefone, setNewClientTelefone] = useState("");
  const [newClientEndereco, setNewClientEndereco] = useState("");
  const [newClientComplemento, setNewClientComplemento] = useState("");

  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maskPhone = (v: string) => {
    let r = v.replace(/\D/g, "");
    if (r.length > 11) r = r.substring(0, 11);
    if (r.length > 10) {
      r = r.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
    } else if (r.length > 5) {
      r = r.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    } else if (r.length > 2) {
      r = r.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
    } else {
      r = r.replace(/^(\d*)/, "$1");
    }
    return r;
  };
  const [trocoValor, setTrocoValor] = useState("");
  const [noTroco, setNoTroco] = useState(false);

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Mobile
  const [isMobile, setIsMobile] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetchInitialData();
    const handleClick = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (linkedVendaId && linkedCliente) {
      setOrderType("Presencial");
      setIdentification(linkedCliente);
      // Pequeno delay para o toast não sumir com o carregamento inicial
      setTimeout(() => {
        toast.info(`Adicionando itens à comanda de: ${linkedCliente}`, {
          duration: 5000,
        });
      }, 500);
    }
  }, [linkedVendaId, linkedCliente]);

  async function fetchInitialData() {
    const [prodRes, catRes, payRes] = await Promise.all([
      supabase.from("produtos").select("*, categorias(nome), estoque(saldo)").eq("ativo", true).order("nome"),
      supabase.from("categorias").select("*").order("nome"),
      supabase.from("formas_pagamento").select("*").order("nome"),
    ]);
    setProducts((prodRes.data as any[]) || []);
    setCategories((catRes.data as Category[]) || []);
    setPaymentMethods((payRes.data as PaymentMethod[]) || []);
  }

  useEffect(() => {
    if (clientQuery.length < 2) { setClientSuggestions([]); setShowSuggestions(false); return; }
    const timer = setTimeout(async () => {
      setIsSearchingClient(true);
      const { data } = await supabase.from("clientes").select("id, nome, telefone, endereco, complemento")
        .or(`nome.ilike.%${clientQuery}%,telefone.ilike.%${clientQuery}%`).limit(6);
      setClientSuggestions((data as Cliente[]) || []);
      setShowSuggestions(true);
      setIsSearchingClient(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [clientQuery]);

  function selectClient(client: Cliente) {
    setSelectedClient(client);
    setClientQuery(client.nome);
    setPhone(client.telefone || "");
    setAddress(client.endereco || "");
    setComplement(client.complemento || "");
    setShowSuggestions(false);
    setShowNewClientForm(false);
  }

  function clearClient() {
    setSelectedClient(null);
    setClientQuery("");
    setPhone("");
    setAddress("");
    setComplement("");
  }

  async function handleSaveNewClient() {
    if (!newClientNome.trim()) { toast.error("Nome do cliente é obrigatório"); return; }
    setIsSavingClient(true);
    const { data, error } = await supabase.from("clientes")
      .insert({ nome: newClientNome.trim(), telefone: newClientTelefone || null, endereco: newClientEndereco || null, complemento: newClientComplemento || null })
      .select().single();
    setIsSavingClient(false);
    if (error) { toast.error("Erro ao cadastrar cliente"); return; }
    toast.success("Cliente cadastrado!");
    selectClient(data as Cliente);
    setShowNewClientForm(false);
    setNewClientNome(""); setNewClientTelefone(""); setNewClientEndereco(""); setNewClientComplemento("");
  }

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const subtotal = cart.reduce((s, i) => s + i.product.preco * i.quantity, 0);
  const totalGeral = subtotal + (orderType === "Delivery" ? deliveryFee : 0);

  const filtered = products.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCategory = selectedCategoryId === "Todos" || p.categoria_id === selectedCategoryId;
    return matchSearch && matchCategory;
  });

  function resetAll() {
    setCart([]); setStep(1); setOrderType("Presencial"); setIdentification(""); setDeliveryFee(0);
    setAddress(""); setComplement(""); setPhone(""); clearClient();
    setPaymentMethodId(""); setNotes(""); setTrocoValor(""); setNoTroco(false);
  }

  async function ensureCliente(nome: string, telefone: string) {
    if (!telefone.trim() || !nome.trim()) return null;
    try {
      const { data: existing, error: searchError } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefone", telefone)
        .maybeSingle();

      if (searchError) throw searchError;
      if (existing) return existing.id;

      const { data: newClient, error: insertError } = await supabase
        .from("clientes")
        .insert({ nome, telefone })
        .select("id")
        .single();

      if (insertError) throw insertError;
      return newClient.id;
    } catch (err) {
      console.error("Erro ao gerenciar cliente:", err);
      return null;
    }
  }

  async function handleConfirmSale() {
    if (!paymentMethodId) { toast.error("Selecione a forma de pagamento"); return; }
    setIsSubmitting(true);
    try {
      const paymentMethod = paymentMethods.find(m => m.id === paymentMethodId);
      const isPix = paymentMethod?.nome?.toLowerCase().includes("pix");
      let pixData = { qr_code: "", qr_code_base64: "" };

      // Gerar PIX se for o caso
      if (isPix) {
        try {
          console.log('Chamando gerar-pix com valor:', Number(totalGeral));
          const { data: resData, error: pixError } = await (supabase as any).functions.invoke('gerar-pix', {
            body: { 
              valor: Number(totalGeral), 
              descricao: `Pedido Bom Apetite - ${cart.length} itens` 
            }
          });
          
          console.log('Resposta gerar-pix (data):', resData);
          console.log('Resposta gerar-pix (error):', pixError);

          if (pixError) throw pixError;
          if (!resData || resData.success === false) {
            throw new Error(resData?.error || 'Erro ao gerar PIX');
          }
          if (resData?.success) {
            pixData = { qr_code: resData.qr_code, qr_code_base64: resData.qr_code_base64 };
            console.log('QR Code gerado com sucesso');
          } else {
            throw new Error(resData?.error || 'Erro desconhecido na resposta da função');
          }
        } catch (err: any) {
          console.error("Erro detalhado ao gerar PIX:", err);
          toast.error(`Erro PIX: ${err.message || 'Falha na comunicação com o servidor'}`);
          setIsSubmitting(false);
          return;
        }
      }

      const nomeCliente = selectedClient?.nome || newClientNome || identification || "";
      const telefoneCliente = selectedClient?.telefone || newClientTelefone || phone || "";

      let finalClienteId = (selectedClient && selectedClient.id !== 'temp') ? selectedClient.id : null;
      if (!finalClienteId && (orderType === "Retirada" || orderType === "Delivery") && telefoneCliente) {
        finalClienteId = await ensureCliente(nomeCliente, telefoneCliente);
      }

      const isDinheiro = paymentMethod?.nome?.toLowerCase().includes("dinheiro") ?? false;
      const trocoInfo = (orderType === "Delivery" && isDinheiro && !noTroco && trocoValor)
        ? `Troco para R$ ${parseFloat(trocoValor).toFixed(2).replace(".", ",")}` : "";
      const obsCompleta = [trocoInfo, notes].filter(Boolean).join(" | ");

      const { error } = await (supabase as any).rpc("realizar_venda", {
        p_itens: cart.map((i: any) => ({ 
          produto_id: i.product.id, 
          quantidade: i.quantity, 
          preco_unitario: i.product.preco,
          nome_produto: i.product.nome,
          status_cozinha: orderType === "Presencial" ? "concluído" : "pendente"
        })),
        p_pagamento_id: paymentMethodId,
        p_observacao: obsCompleta || "",
        p_cliente: nomeCliente,
        p_cliente_id: finalClienteId,
        p_tipo_pedido: orderType,
        p_endereco: orderType === "Delivery" ? address : "",
        p_telefone: orderType === "Presencial" ? "" : telefoneCliente,
        p_taxa_entrega: orderType === "Delivery" ? parseFloat(deliveryFee.toString()) : 0,
        p_status: "Concluída"
      });

      if (error) { toast.error(error.message || "Erro ao realizar venda"); return; }

      // Prepare receipt
      const now = new Date();
      const dataHora = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setReceiptData({
        orderType,
        identification,
        cart: [...cart],
        subtotal,
        deliveryFee,
        totalGeral,
        paymentName: paymentMethod?.nome || "",
        notes: obsCompleta,
        trocoValor,
        noTroco,
        isDinheiro,
        clienteNome: selectedClient?.nome || "",
        clienteTelefone: phone,
        clienteEndereco: address,
        clienteComplemento: complement,
        dataHora,
        qrCodeBase64: pixData.qr_code_base64,
        qrCodeTexto: pixData.qr_code,
      });

      if (usuario) {
        // Log principal da Venda
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "venda",
          acao: "Venda realizada",
          detalhes: {
            total: totalGeral,
            tipo_pedido: orderType,
            cliente_nome: nomeCliente,
            forma_pagamento: paymentMethod?.nome,
            quantidade_itens: cart.length
          }
        });

        // Log de Estoque (para o filtro de estoque)
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "estoque",
          acao: "Baixa de estoque por venda",
          detalhes: {
            venda_tipo: orderType,
            itens: cart.map(i => `${i.quantity}x ${i.product.nome}`).join(", ")
          }
        });

        // Log de Produto (para o filtro de produtos)
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "produto",
          acao: "Produtos vendidos",
          detalhes: {
            itens: cart.map(i => i.product.nome).join(", "),
            total: totalGeral
          }
        });
      }

      toast.success("Venda realizada com sucesso!");
      setModalOpen(false);
      resetAll();
      fetchInitialData();
      setReceiptOpen(true);
    } catch {
      toast.error("Erro inesperado ao realizar venda");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveComanda() {
    setIsSubmitting(true);
    try {
      const nomeCliente = selectedClient?.nome || newClientNome || identification || "";
      const telefoneCliente = selectedClient?.telefone || newClientTelefone || phone || "";
      
      let finalClienteId = (selectedClient && selectedClient.id !== 'temp') ? selectedClient.id : null;
      if (!finalClienteId && (orderType === "Retirada" || orderType === "Delivery") && telefoneCliente) {
        finalClienteId = await ensureCliente(nomeCliente, telefoneCliente);
      }

      const { error } = await (supabase as any).rpc("realizar_venda", {
        p_itens: cart.map((i: any) => ({ 
          produto_id: i.product.id, 
          quantidade: i.quantity, 
          preco_unitario: i.product.preco,
          nome_produto: i.product.nome,
          status_cozinha: orderType === "Presencial" ? "concluído" : "pendente"
        })),
        p_pagamento_id: null,
        p_observacao: notes || "",
        p_cliente: nomeCliente,
        p_cliente_id: finalClienteId,
        p_tipo_pedido: orderType,
        p_endereco: orderType === "Delivery" ? address : "",
        p_telefone: orderType === "Presencial" ? "" : telefoneCliente,
        p_taxa_entrega: orderType === "Delivery" ? parseFloat(deliveryFee.toString()) : 0,
        p_status: "Em Aberto"
      });

      if (error) { toast.error(error.message || "Erro ao salvar comanda"); return; }

      const now = new Date();
      const dataHora = now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      
      setReceiptData({
        orderType: orderType,
        identification: identification || "Comanda Extra",
        cart: [...cart],
        subtotal,
        deliveryFee: 0,
        totalGeral: subtotal,
        paymentName: "PENDENTE (EM ABERTO)",
        notes: notes,
        trocoValor: "",
        noTroco: false,
        isDinheiro: false,
        clienteNome: "",
        clienteTelefone: "",
        clienteEndereco: "",
        clienteComplemento: "",
        dataHora,
      });

      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "venda",
          acao: "Comanda aberta",
          detalhes: {
            total: subtotal,
            tipo_pedido: orderType,
            cliente_nome: identification || selectedClient?.nome,
            quantidade_itens: cart.length
          }
        });
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "estoque",
          acao: "Baixa de estoque por comanda",
          detalhes: {
            venda_tipo: orderType,
            itens: cart.map(i => `${i.quantity}x ${i.product.nome}`).join(", ")
          }
        });
      }

      toast.success("Comanda salva e pendente de pagamento!");
      setModalOpen(false);
      resetAll();
      fetchInitialData();
      setReceiptOpen(true);
    } catch {
      toast.error("Erro inesperado ao salvar comanda");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddItemsToExisting() {
    if (!linkedVendaId) return;
    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("adicionar_itens_venda", {
        p_venda_id: linkedVendaId,
        p_itens: cart.map((i: any) => ({ 
          produto_id: i.product.id, 
          quantidade: i.quantity, 
          preco_unitario: i.product.preco,
          nome_produto: i.product.nome
        }))
      });

      if (error) { toast.error(error.message || "Erro ao adicionar itens"); return; }

      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "venda",
          acao: "Itens adicionados a comanda aberta",
          detalhes: {
            venda_id: linkedVendaId,
            cliente: linkedCliente,
            itens: cart.map(i => `${i.quantity}x ${i.product.nome}`).join(", ")
          }
        });
      }

      toast.success("Itens adicionados com sucesso!");
      setModalOpen(false);
      resetAll();
      navigate("/vendas");
    } catch {
      toast.error("Erro inesperado ao adicionar itens");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrint() {
    const style = document.createElement("style");
    style.innerHTML = printStyle;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      document.head.removeChild(style);
      setReceiptOpen(false);
    }, 500);
  }

  const stepLabels = ["Tipo de Pedido", "Revisão", "Pagamento"];

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] overflow-hidden -mt-2">

      {/* Left — Products */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="flex-none space-y-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nova Venda</h1>
            <p className="text-sm text-muted-foreground">Selecione os produtos para o pedido</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar produtos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
          </div>
          
          {linkedVendaId && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-sm text-indigo-900">
                  Modo de Edição: <strong>{linkedCliente}</strong>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/nova-venda")} className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 h-7 text-xs">
                Sair do modo edição
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap pb-2 border-b border-border/50 flex-none">
          <button 
            onClick={() => setSelectedCategoryId("Todos")} 
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategoryId === "Todos" ? "bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground border border-border hover:bg-muted"}`}
          >
            Todos
          </button>
          {categories.map((c) => {
            const style = getStyle(c.nome);
            const isSelected = selectedCategoryId === c.id;
            return (
              <button 
                key={c.id} 
                onClick={() => setSelectedCategoryId(c.id)} 
                style={{
                  background: isSelected ? style.bg : style.bgSoft,
                  color: isSelected ? "#fff" : style.text,
                  borderColor: isSelected ? style.bg : style.border,
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all hover:brightness-95`}
              >
                {c.nome}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 px-1">
            {filtered.map((p) => {
              const catName = p.categorias?.nome || 'Geral';
              const style = getStyle(catName);
              return (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)} 
                  disabled={((p.estoque?.saldo ?? p.estoque?.[0]?.saldo) ?? 0) <= 0}
                  style={{
                    background: style.bgSoft,
                    borderColor: style.border,
                  }}
                  className={`rounded-xl border-2 text-left transition-all hover:shadow-lg overflow-hidden flex flex-col ${((p.estoque?.saldo ?? p.estoque?.[0]?.saldo) ?? 0) <= 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02] active:scale-95"}`}
                >
                  {p.imagem_url ? (
                    <div className="w-full h-32 bg-muted relative shrink-0">
                      <img src={p.imagem_url} alt={p.nome} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2">
                        <span style={{ background: style.bg, color: "#fff" }} className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                          {catName}
                        </span>
                      </div>
                      <div className="absolute top-2 right-2 bg-background/90 px-1.5 py-0.5 rounded-md shadow-sm">
                        <span className="text-[10px] text-foreground font-bold">{((p.estoque?.saldo ?? p.estoque?.[0]?.saldo) ?? 0)} un.</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="p-3 flex-1 flex flex-col w-full">
                    {!p.imagem_url && (
                      <div className="flex items-start justify-between mb-1.5">
                        <span 
                          style={{ background: style.bg, color: "#fff" }}
                          className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md"
                        >
                          {catName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold">{((p.estoque?.saldo ?? p.estoque?.[0]?.saldo) ?? 0)} un.</span>
                      </div>
                    )}
                    <p className={`font-bold text-sm leading-tight truncate mb-1 text-[#1e3a8a] ${p.imagem_url ? "mt-1" : ""}`} title={p.nome}>{p.nome}</p>
                    <div className="mt-auto pt-1">
                      <p style={{ color: style.text }} className="font-black text-base">{formatCurrency(p.preco)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Search className="w-12 h-12 mb-2 opacity-20" /><p>Nenhum produto encontrado</p></div>}
        </div>
      </div>

      {/* Right — Cart (Desktop) */}
      {!isMobile && (
        <div className="w-full lg:w-96 flex-none h-full animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="card-metric flex flex-col h-full bg-card shadow-lg border-primary/10">
            <div className="flex items-center justify-between mb-4 flex-none">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg"><ShoppingCart className="w-5 h-5 text-primary" /></div>
                <h2 className="font-bold text-lg">Carrinho</h2>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">{cart.reduce((s, i) => s + i.quantity, 0)} itens</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 scrollbar-thin scrollbar-thumb-muted-foreground/20">
              {cart.length === 0 && <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-12"><ShoppingCart className="w-12 h-12 mb-2" /><p className="text-sm">Seu carrinho está vazio</p></div>}
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-transparent hover:border-primary/20 transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate text-foreground">{item.product.nome}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.product.preco)} / un.</p>
                  </div>
                  <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border border-border">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex-none border-t border-border pt-4 bg-card">
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground font-medium">Total do Pedido</span>
                <span className="text-2xl font-extrabold text-primary">{formatCurrency(subtotal)}</span>
              </div>
              <Button onClick={() => { setStep(linkedVendaId ? 2 : 1); setModalOpen(true); }} disabled={cart.length === 0} className="w-full h-12 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
                {linkedVendaId ? "Confirmar Adição" : "Revisar Pedido"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button (Mobile) */}
      {isMobile && cart.length > 0 && (
        <div className="fixed bottom-[80px] left-4 right-4 z-50 animate-in slide-in-from-bottom-10 duration-300">
          <Button 
            onClick={() => setIsCartDrawerOpen(true)}
            className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-[0_8px_30px_rgb(249,115,22,0.3)] flex items-center justify-between px-6 border-none"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">Ver Carrinho ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
            </div>
            <span className="font-black text-lg">{formatCurrency(subtotal)}</span>
          </Button>
        </div>
      )}

      {/* Cart Drawer (Mobile) */}
      <Drawer open={isCartDrawerOpen} onOpenChange={setIsCartDrawerOpen}>
        <DrawerContent className="max-h-[85vh] z-[100]">
          <DrawerHeader className="border-b border-border/50 pb-4">
            <DrawerTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <span>Carrinho</span>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-bold">
                {cart.reduce((s, i) => s + i.quantity, 0)} itens
              </span>
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cart.map((item) => (
              <div key={item.product.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-transparent">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate text-foreground">{item.product.nome}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.product.preco)} / un.</p>
                </div>
                <div className="flex items-center gap-2 bg-background p-1.5 rounded-lg border border-border">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                  <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 rounded-md hover:bg-muted flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p>Seu carrinho está vazio</p>
              </div>
            )}
          </div>

          <DrawerFooter className="border-t border-border p-4 bg-card">
            <div className="flex justify-between items-center mb-4 px-2">
              <span className="text-muted-foreground font-medium text-lg">Total do Pedido</span>
              <span className="text-3xl font-black text-primary">{formatCurrency(subtotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DrawerClose asChild>
                <Button variant="outline" className="h-12 font-bold text-base">Fechar</Button>
              </DrawerClose>
              <Button 
                onClick={() => { setIsCartDrawerOpen(false); setStep(linkedVendaId ? 2 : 1); setModalOpen(true); }}
                disabled={cart.length === 0}
                className="h-12 text-base font-bold bg-orange-500 text-white hover:bg-orange-600 border-none"
              >
                {linkedVendaId ? "Confirmar" : "Revisar Pedido"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* ===== CHECKOUT MODAL ===== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader><DialogTitle>Finalizar Venda</DialogTitle></DialogHeader>

          {/* Progress */}
          <div className="flex items-center gap-1 mb-2">
            {stepLabels.map((label, idx) => {
              const n = idx + 1; const isActive = step === n; const isDone = step > n;
              return (
                <div key={n} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary/20 text-primary border-2 border-primary" : "bg-muted text-muted-foreground"}`}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`text-[10px] mt-0.5 text-center leading-tight ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
                  </div>
                  {idx < stepLabels.length - 1 && <div className={`h-0.5 flex-1 mb-4 transition-colors ${isDone ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>

          {/* PASSO 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">Selecione o Tipo</h3>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={orderType === "Presencial" ? "default" : "outline"}
                  className="flex-1 py-8 flex flex-col gap-2 rounded-2xl h-auto"
                  onClick={() => { setOrderType("Presencial"); setIdentification(""); clearClient(); }}
                >
                  <User className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Presencial</span>
                </Button>
                <Button 
                  variant={orderType === "Retirada" ? "default" : "outline"}
                  className="flex-1 py-8 flex flex-col gap-2 rounded-2xl h-auto"
                  onClick={() => { setOrderType("Retirada"); setIdentification(""); clearClient(); }}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Retirada</span>
                </Button>
                <Button 
                  variant={orderType === "Delivery" ? "default" : "outline"}
                  className="flex-1 py-8 flex flex-col gap-2 rounded-2xl h-auto"
                  onClick={() => { setOrderType("Delivery"); setIdentification(""); clearClient(); }}
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase">Delivery</span>
                </Button>
              </div>

              {(orderType === "Retirada" || orderType === "Delivery") && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cliente</Label>
                  <div className="relative" ref={clientSearchRef}>
                    {selectedClient ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg border border-primary/40 bg-primary/5">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{selectedClient.nome}</p>
                          {selectedClient.telefone && <p className="text-xs text-muted-foreground">{selectedClient.telefone}</p>}
                        </div>
                        <button onClick={clearClient} className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            placeholder="Buscar por nome ou celular..." 
                            value={clientQuery}
                            onChange={(e) => {
                              setClientQuery(e.target.value);
                              if (!showSuggestions && e.target.value.length > 0) setShowSuggestions(true);
                            }}
                            className="pl-9 h-12 rounded-xl"
                          />
                        </div>
                        
                        {showSuggestions && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                            {isSearchingClient ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
                            ) : clientSuggestions.length > 0 ? (
                              <>
                                {clientSuggestions.map((c) => (
                                  <button key={c.id} onClick={() => selectClient(c)} className="w-full p-3 text-left hover:bg-muted flex flex-col border-b last:border-0">
                                    <span className="font-bold text-sm text-slate-800">{c.nome}</span>
                                    {c.telefone && <span className="text-xs text-muted-foreground">{c.telefone}</span>}
                                  </button>
                                ))}
                                <button 
                                  onClick={() => { setShowSuggestions(false); setShowNewClientForm(true); setNewClientNome(clientQuery); }}
                                  className="w-full p-3 text-center bg-slate-50 hover:bg-slate-100 text-primary text-xs font-bold border-t"
                                >
                                  + CADASTRAR NOVO CLIENTE
                                </button>
                              </>
                            ) : (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground mb-3">Cliente não encontrado</p>
                                <Button size="sm" variant="default" onClick={() => { setShowSuggestions(false); setShowNewClientForm(true); setNewClientNome(clientQuery); }} className="w-full bg-primary hover:bg-primary/90">
                                  + Criar "{clientQuery}"
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {showNewClientForm && !selectedClient && (
                      <div className="mt-2 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-primary uppercase tracking-widest">Informações do Novo Cliente</p>
                          <button onClick={() => setShowNewClientForm(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nome Completo *</Label>
                            <Input 
                              placeholder="Nome do cliente..." 
                              value={newClientNome} 
                              onChange={(e) => setNewClientNome(e.target.value)} 
                              className="h-10 bg-background"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Telefone / WhatsApp *</Label>
                            <Input 
                              placeholder="(00) 00000-0000" 
                              value={newClientTelefone} 
                              onChange={(e) => setNewClientTelefone(maskPhone(e.target.value))} 
                              className="h-10 bg-background"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button 
                            size="sm" 
                            onClick={() => {
                              if (!newClientNome.trim() || !newClientTelefone.trim()) {
                                toast.error("Preencha nome e telefone");
                                return;
                              }
                              setSelectedClient({ 
                                id: 'temp', 
                                nome: newClientNome, 
                                telefone: newClientTelefone, 
                                endereco: null, 
                                complemento: null 
                              });
                              setShowNewClientForm(false);
                            }} 
                            className="w-full bg-primary text-primary-foreground font-bold"
                          >
                            Confirmar Dados
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {orderType === "Delivery" && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-60">Dados da Entrega</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Endereço: Rua, nº, bairro..." className="h-10 rounded-xl" />
                        </div>
                        <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Bloco, apto..." className="h-10 rounded-xl" />
                        <Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="Telefone..." className="h-10 rounded-xl" />
                      </div>
                      <div className="pt-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground/70">Taxa de Entrega</Label>
                        <Input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)} className="h-10 rounded-xl" placeholder="R$ 0,00" />
                      </div>
                    </div>
                  )}

                  {!selectedClient && !showNewClientForm && (
                     <div className="pt-1">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-60">Identificação/Obs (Opcional)</Label>
                        <Input value={identification} onChange={(e) => setIdentification(e.target.value)} placeholder="Ex: Mesa 05, Retirada às 12h..." className="h-10 rounded-xl mt-1" />
                     </div>
                  )}
                </div>
              )}

              {orderType === "Presencial" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest italic opacity-60">Identificação (Opcional)</Label>
                  <Input value={identification} onChange={(e) => setIdentification(e.target.value)} placeholder="Ex: Mesa 10, Comanda, Nome..." className="h-12 rounded-xl" />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                {linkedVendaId ? (
                   <Button onClick={handleAddItemsToExisting} disabled={isSubmitting} className="bg-indigo-600 text-white hover:bg-indigo-700">
                     {isSubmitting ? "Salvando..." : "Confirmar Adição"}
                   </Button>
                ) : (
                  <Button onClick={() => setStep(2)} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]">Próximo →</Button>
                )}
              </div>
            </div>
          )}

          {/* PASSO 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
                {cart.map((i) => (
                  <div key={i.product.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-medium">{i.quantity}x {i.product.nome}</span>
                    <span className="font-bold">{formatCurrency(i.product.preco * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border/60 pt-3 mt-3 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal (Itens)</span><span>{formatCurrency(subtotal)}</span></div>
                {orderType === "Delivery" && <div className="flex justify-between text-sm text-muted-foreground"><span>Taxa de Entrega</span><span>{formatCurrency(deliveryFee)}</span></div>}
                <div className="flex justify-between items-center pt-2 border-t border-border mt-2">
                  <span className="font-bold text-lg">Total Geral</span>
                  <span className="text-2xl font-black text-primary">{formatCurrency(totalGeral)}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-primary/10 bg-primary/5 space-y-2">
                <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Resumo do Pedido</p>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <p className="text-sm font-bold">Tipo: {orderType}</p>
                </div>
                {(identification || selectedClient) && (
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium">Cliente/Ident.: <span className="font-bold">{selectedClient?.nome || identification}</span></p>
                   </div>
                )}
                {orderType === "Delivery" && address && (
                   <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                      <p className="text-xs font-medium text-muted-foreground leading-tight">{address}{complement ? `, ${complement}` : ""}</p>
                   </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-border">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isSubmitting}>← Voltar</Button>
                {linkedVendaId ? (
                  <Button onClick={handleAddItemsToExisting} disabled={isSubmitting} className="bg-indigo-600 text-white hover:bg-indigo-700">
                    {isSubmitting ? "Salvando..." : "Confirmar Adição"}
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleSaveComanda} disabled={isSubmitting} className="border-primary/20 text-primary hover:bg-primary/5 font-bold">
                      {isSubmitting ? "Salvando..." : "Salvar Aberto"}
                    </Button>
                    <Button onClick={() => setStep(3)} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px] font-bold">
                      Pagar Agora →
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* PASSO 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block font-semibold">Forma de Pagamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((m) => (
                    <button key={m.id} onClick={() => setPaymentMethodId(m.id)}
                      className={`p-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${paymentMethodId === m.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>

              {orderType === "Delivery" && paymentMethods.find(m => m.id === paymentMethodId)?.nome?.toLowerCase().includes("dinheiro") && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Troco para quanto? <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input type="checkbox" checked={noTroco} onChange={(e) => { setNoTroco(e.target.checked); if (e.target.checked) setTrocoValor(""); }} className="rounded border-border w-3.5 h-3.5 accent-orange-500" />
                      Não precisa de troco
                    </label>
                  </div>
                  {!noTroco && (
                    <>
                      <input type="number" step="0.01" min="0"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={trocoValor} onChange={(e) => setTrocoValor(e.target.value)} placeholder="Ex: 100,00" />
                      {trocoValor && (() => {
                        const val = parseFloat(trocoValor);
                        const troco = val - totalGeral;
                        if (val < totalGeral) return <p className="text-xs text-destructive font-medium">⚠️ Valor insuficiente (faltam {formatCurrency(totalGeral - val)})</p>;
                        return <p className="text-xs text-green-600 font-medium">Troco: {formatCurrency(troco)}</p>;
                      })()}
                    </>
                  )}
                </div>
              )}

              <div>
                <Label>Observações (opcional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem cebola, sem maionese..." className="mt-1" />
              </div>

              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total a pagar</span>
                <span className="text-xl font-extrabold text-primary">{formatCurrency(totalGeral)}</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>← Voltar</Button>
                <Button onClick={handleConfirmSale} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1">
                  {isSubmitting ? "Processando..." : "✓ Confirmar Venda"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== RECEIPT MODAL ===== */}
      <Dialog open={receiptOpen} onOpenChange={() => { setReceiptOpen(false); setReceiptData(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" /> Venda Confirmada!
            </DialogTitle>
          </DialogHeader>

          {receiptData && (
            <>
              <div className="border border-border rounded-lg p-4 bg-white overflow-auto max-h-96 text-xs">
                <Receipt data={receiptData} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => { setReceiptOpen(false); setReceiptData(null); }} className="flex-1">
                  Fechar
                </Button>
                <Button onClick={handlePrint} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Printer className="w-4 h-4 mr-2" /> Imprimir
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
