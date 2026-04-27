import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Plus, Trash2, PackagePlus, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";

interface Produto {
  id: string;
  nome: string;
  estoque?: { saldo: number };
}

interface ItemEntrada {
  produto_id: string;
  nome_produto: string;
  quantidade: number;
  custo_unitario: number;
}

interface EntradaNota {
  id: string;
  fornecedor: string | null;
  observacoes: string | null;
  criado_em: string;
  entradas_nota_item: {
    id: string;
    quantidade: number;
    custo_unitario: number;
    produtos: { nome: string } | null;
  }[];
}

export default function Entradas() {
  const { usuario } = useAuth();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [entradas, setEntradas] = useState<EntradaNota[]>([]);
  const [fornecedor, setFornecedor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemEntrada[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [prodRes, entradasRes] = await Promise.all([
      supabase.from("produtos").select("id, nome, estoque(saldo)").eq("ativo", true).order("nome"),
      supabase
        .from("entradas_nota")
        .select("*, entradas_nota_item(id, quantidade, custo_unitario, produtos(nome))")
        .order("criado_em", { ascending: false })
        .limit(30),
    ]);
    setProdutos((prodRes.data as any[]) || []);
    setEntradas((entradasRes.data as any[]) || []);
  }

  function addItem() {
    if (produtos.length === 0) return;
    setItens((prev) => [
      ...prev,
      { produto_id: produtos[0].id, nome_produto: produtos[0].nome, quantidade: 1, custo_unitario: 0 },
    ]);
  }

  function updateItem(index: number, field: keyof ItemEntrada, value: string | number) {
    setItens((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === "produto_id") {
          const p = produtos.find((p) => p.id === value);
          return { ...item, produto_id: value as string, nome_produto: p?.nome || "" };
        }
        return { ...item, [field]: value };
      })
    );
  }

  function removeItem(index: number) {
    setItens((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (itens.length === 0) {
      toast.error("Adicione ao menos um item");
      return;
    }
    for (const item of itens) {
      if (item.quantidade <= 0) {
        toast.error("Quantidade deve ser maior que zero");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Criar cabeçalho da nota
      const { data: nota, error: notaError } = await supabase
        .from("entradas_nota")
        .insert({ fornecedor: fornecedor || null, observacoes: observacoes || null })
        .select()
        .single();

      if (notaError || !nota) {
        toast.error("Erro ao registrar entrada");
        return;
      }

      // Inserir os itens (trigger atualiza o estoque automaticamente)
      const itensPayload = itens.map((i) => ({
        entrada_id: nota.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        custo_unitario: i.custo_unitario,
      }));

      const { error: itensError } = await supabase.from("entradas_nota_item").insert(itensPayload);
      if (itensError) {
        toast.error("Erro ao inserir itens da entrada");
        return;
      }

      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "estoque",
          acao: "Entrada de mercadoria registrada",
          detalhes: {
            fornecedor,
            itens: itens.map((i) => `${i.quantidade}x ${i.nome_produto}`).join(", "),
          },
        });
      }

      toast.success("Entrada registrada! Estoque atualizado automaticamente.");
      setFornecedor("");
      setObservacoes("");
      setItens([]);
      fetchData();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground">Entradas de Mercadoria</h1>
        <p className="text-sm text-muted-foreground">Registre a chegada de produtos e atualize o estoque</p>
      </div>

      {/* Formulário nova entrada */}
      <div className="card-metric space-y-4">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-primary" />
          Nova Entrada
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Fornecedor (opcional)</Label>
            <Input
              placeholder="Nome do fornecedor"
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
            />
          </div>
          <div>
            <Label>Observações (opcional)</Label>
            <Input
              placeholder="Ex: Nota fiscal #1234"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        {/* Itens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Itens da Entrada</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Item
            </Button>
          </div>

          {itens.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
              Nenhum item adicionado. Clique em "Adicionar Item" para começar.
            </p>
          )}

          {itens.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg border border-border">
              <div className="col-span-12 sm:col-span-5">
                <Label className="text-xs">Produto</Label>
                <select
                  value={item.produto_id}
                  onChange={(e) => updateItem(index, "produto_id", e.target.value)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (saldo: {p.estoque?.saldo ?? 0})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={item.quantidade}
                  onChange={(e) => updateItem(index, "quantidade", Number(e.target.value))}
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Label className="text-xs">Custo Unit. (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={item.custo_unitario}
                  onChange={(e) => updateItem(index, "custo_unitario", Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <button
                  onClick={() => removeItem(index)}
                  className="p-2 hover:bg-destructive/10 rounded-md"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {itens.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isSubmitting ? "Salvando..." : "Confirmar Entrada"}
            </Button>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="card-metric p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-base font-semibold">Histórico de Entradas</h2>
        </div>
        <div className="divide-y divide-border">
          {entradas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrada registrada ainda.</p>
          )}
          {entradas.map((entrada) => (
            <div key={entrada.id}>
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 text-left"
                onClick={() => setExpandedId(expandedId === entrada.id ? null : entrada.id)}
              >
                <div>
                  <p className="text-sm font-medium">
                    {entrada.fornecedor || "Fornecedor não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(entrada.criado_em)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {entrada.entradas_nota_item.length} {entrada.entradas_nota_item.length === 1 ? "item" : "itens"}
                  </span>
                  {expandedId === entrada.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>
              {expandedId === entrada.id && (
                <div className="px-4 pb-4">
                  {entrada.observacoes && (
                    <p className="text-xs text-muted-foreground mb-2">Obs: {entrada.observacoes}</p>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="pb-1 font-medium text-muted-foreground">Produto</th>
                        <th className="pb-1 font-medium text-muted-foreground text-center">Qtd</th>
                        <th className="pb-1 font-medium text-muted-foreground text-right">Custo Unit.</th>
                        <th className="pb-1 font-medium text-muted-foreground text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entrada.entradas_nota_item.map((item) => (
                        <tr key={item.id} className="border-b border-border/50 last:border-0">
                          <td className="py-1.5">{item.produtos?.nome || "-"}</td>
                          <td className="py-1.5 text-center">{item.quantidade}</td>
                          <td className="py-1.5 text-right text-muted-foreground">{formatCurrency(item.custo_unitario)}</td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(item.quantidade * item.custo_unitario)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-2 text-right text-xs text-muted-foreground uppercase font-semibold">Total</td>
                        <td className="pt-2 text-right font-bold text-primary">
                          {formatCurrency(
                            entrada.entradas_nota_item.reduce(
                              (s, i) => s + i.quantidade * i.custo_unitario,
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
