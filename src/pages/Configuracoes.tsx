import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save, RefreshCw } from "lucide-react";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";

export default function Configuracoes() {
  const { usuario } = useAuth();
  const [taxaEntrega, setTaxaEntrega] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("configuracoes")
        .select("valor")
        .eq("chave", "taxa_entrega")
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar configuração:", error);
        toast.error("Erro ao carregar configurações");
      } else if (data) {
        setTaxaEntrega(data.valor);
      } else {
        // Caso não exista a linha, sugerimos 5.00 mas deixamos o campo vazio ou com default
        setTaxaEntrega("5.00");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!taxaEntrega || isNaN(parseFloat(taxaEntrega))) {
      toast.error("Informe um valor válido para a taxa");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("configuracoes")
        .upsert({ 
          chave: "taxa_entrega", 
          valor: parseFloat(taxaEntrega).toFixed(2),
          atualizado_em: new Date().toISOString()
        });

      if (error) {
        toast.error("Erro ao salvar configuração");
        return;
      }

      toast.success("Configurações salvas com sucesso!");
      
      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "sistema",
          acao: "Alteração de configuração",
          detalhes: { chave: "taxa_entrega", novo_valor: taxaEntrega }
        });
      }
    } catch (err) {
      toast.error("Erro inesperado ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-sm text-muted-foreground">Gerencie as definições globais do restaurante</p>
      </div>

      <div className="max-w-2xl">
        <div className="card-metric">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            Entrega & Logística
          </h2>
          
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="taxa-entrega">Taxa de Entrega Padrão (R$)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                  <Input 
                    id="taxa-entrega"
                    type="number" 
                    step="0.50"
                    min="0"
                    placeholder="0,00"
                    value={taxaEntrega} 
                    onChange={(e) => setTaxaEntrega(e.target.value)}
                    className="pl-9 font-bold"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={fetchConfig}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                * Este valor será sugerido automaticamente em novos pedidos de Delivery no PDV e aplicado no Catálogo Online.
              </p>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={saving || loading}
                className="bg-primary text-primary-foreground font-bold gap-2"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Configurações
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
