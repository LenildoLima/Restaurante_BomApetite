import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";

interface Category {
  id: string;
  nome: string;
}

interface Product {
  id: string;
  nome: string;
  categoria_id: string;
  categorias?: { nome: string };
  preco: number;
  custo: number;
  estoque_minimo: number;
  ativo: boolean;
  estoque?: { saldo: number };
  imagem_url?: string;
}

const emptyProduct = { nome: "", categoria_id: "", preco: 0, custo: 0, estoque_minimo: 5, ativo: true, imagem_url: "" };

export default function Products() {
  const { usuario } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    console.log("Iniciando busca de dados...");
    const [prodRes, catRes] = await Promise.all([
      supabase.from("produtos").select("*, categorias(nome), estoque(saldo)").order("nome"),
      supabase.from("categorias").select("*").order("nome")
    ]);
    
    if (prodRes.error) console.error("Erro produtos:", prodRes.error.message, prodRes.error.details);
    if (catRes.error) console.error("Erro categorias:", catRes.error.message, catRes.error.details);

    setProducts((prodRes.data as any[]) || []);
    setCategories((catRes.data as Category[]) || []);

    // Set default category if creating new
    if (!editing && catRes.data && catRes.data.length > 0 && !form.categoria_id) {
      setForm(prev => ({ ...prev, categoria_id: catRes.data?.[0].id || "" }));
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyProduct, categoria_id: categories[0]?.id || "" });
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ 
      nome: p.nome, 
      categoria_id: p.categoria_id, 
      preco: p.preco, 
      custo: p.custo, 
      estoque_minimo: p.estoque_minimo, 
      ativo: p.ativo,
      imagem_url: p.imagem_url || "" 
    });
    setImageFile(null);
    setImagePreview(p.imagem_url || null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.categoria_id) {
      toast.error("Categoria é obrigatória");
      return;
    }

    let finalImageUrl = form.imagem_url;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("produtos_imagens")
        .upload(fileName, imageFile);
      
      if (uploadError) {
        toast.error("Erro ao enviar a imagem. Verifique as configurações de Storage.");
        console.error(uploadError);
        return;
      }
      
      const { data } = supabase.storage.from("produtos_imagens").getPublicUrl(fileName);
      finalImageUrl = data.publicUrl;
    }

    const payload = { ...form, imagem_url: finalImageUrl };

    if (editing) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editing.id);
      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }

      if (usuario) {
        const alteracoes: Record<string, any> = {};
        if (editing.nome !== form.nome) alteracoes.nome = { de: editing.nome, para: form.nome };
        if (editing.categoria_id !== form.categoria_id) alteracoes.categoria = { para: categories.find(c => c.id === form.categoria_id)?.nome };
        if (editing.preco !== form.preco) alteracoes.preco = { de: editing.preco, para: form.preco };
        if (editing.custo !== form.custo) alteracoes.custo = { de: editing.custo, para: form.custo };
        if (editing.ativo !== form.ativo) alteracoes.ativo = { de: editing.ativo, para: form.ativo };
        if (editing.imagem_url !== finalImageUrl) alteracoes.imagem = "Imagem alterada";

        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "produto",
          acao: "Produto editado",
          detalhes: { 
            nome: form.nome,
            alteracoes 
          }
        });
      }

      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("produtos").insert(payload);
      if (error) {
        toast.error("Erro ao criar produto");
        return;
      }

      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "produto",
          acao: "Produto criado",
          detalhes: {
            nome: form.nome,
            categoria: categories.find(c => c.id === form.categoria_id)?.nome,
            preco: form.preco,
            com_imagem: !!finalImageUrl
          }
        });
      }

      toast.success("Produto criado!");
    }
    setModalOpen(false);
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja excluir este produto?")) return;
    const p = products.find(x => x.id === id);
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir produto. Ele pode estar em alguma venda.");
      return;
    }

    if (usuario && p) {
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "produto",
        acao: "Produto excluído",
        detalhes: { nome: p.nome }
      });
    }

    toast.success("Produto excluído!");
    fetchData();
  }

  const filtered = products.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerenciar catálogo e estoque</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> Novo Produto
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produtos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="card-metric p-0 overflow-hidden relative">
        <div className="max-h-[60vh] overflow-auto scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur shadow-sm">
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-muted-foreground">PRODUTO</th>
                <th className="text-left p-3 font-medium text-muted-foreground">CATEGORIA</th>
                <th className="text-left p-3 font-medium text-muted-foreground">PREÇO</th>
                <th className="text-left p-3 font-medium text-muted-foreground">ESTOQUE</th>
                <th className="text-left p-3 font-medium text-muted-foreground">STATUS</th>
                <th className="text-right p-3 font-medium text-muted-foreground">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.imagem_url ? (
                        <img src={p.imagem_url} alt={p.nome} className="w-10 h-10 rounded-md object-cover flex-shrink-0 bg-muted" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground/30">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                      <span className="font-medium">{p.nome}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.categorias?.nome || '-'}</td>
                  <td className="p-3">{formatCurrency(p.preco)}</td>
                  <td className="p-3">
                    <span className={(p.estoque?.saldo ?? 0) < p.estoque_minimo ? "text-destructive font-bold" : ""}>
                      {p.estoque?.saldo ?? 0}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={p.ativo ? "badge-active" : "badge-inactive"}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-muted rounded-md mr-1">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-destructive/10 rounded-md">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum produto encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Foto Picker */}
            <div className="flex justify-center">
              <div className="relative group cursor-pointer w-32 h-32 rounded-xl border-2 border-dashed border-primary/40 bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImagePreview(null); setImageFile(null); setForm(f => ({...f, imagem_url: ""})); }}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground flex flex-col items-center">
                    <Camera className="w-8 h-8 mb-1 opacity-50" />
                    <span className="text-[10px] font-medium leading-tight">Câmera /<br/>Galeria</span>
                  </div>
                )}
                {!imagePreview && (
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImageFile(e.target.files[0]);
                        setImagePreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }} 
                  />
                )}
              </div>
            </div>

            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex: X-Burger" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Estoque Mínimo (alerta)</Label>
              <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground mt-1">O saldo do estoque é gerenciado pelas Entradas de Mercadoria</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              <Label>Produto ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {editing ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
