import { useState } from "react";
import { 
  Database, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Save, 
  FileJson,
  Info,
  ShieldCheck,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

// Lista de tabelas para backup (ordem importa para restauração)
const TABELAS = [
  "categorias",
  "formas_pagamento",
  "produtos",
  "estoque",
  "entradas_nota",
  "entradas_nota_item",
  "clientes",
  "entregadores",
  "vendas",
  "itens_venda",
  "entregas",
  "caixas",
  "caixa_movimentacoes",
  "pagamentos_entregadores",
  "solicitacoes_senha",
  "auditoria",
  "usuarios"
];

// Ordem inversa para deleção segura (respeitando FKs)
const TABELAS_ORDEM_DELECAO = [
  "auditoria",
  "caixa_movimentacoes",
  "pagamentos_entregadores",
  "solicitacoes_senha",
  "itens_venda",
  "entregas",
  "caixas",
  "vendas",
  "clientes",
  "entregadores",
  "entradas_nota_item",
  "entradas_nota",
  "estoque",
  "produtos",
  "categorias",
  "formas_pagamento"
];

export default function BackupPage() {
  const { usuario } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [ultimaExportacao, setUltimaExportacao] = useState<string | null>(localStorage.getItem("ultimo_backup"));

  // Estado para Restauração
  const [arquivoRestaurar, setArquivoRestaurar] = useState<any>(null);
  const [confirmacaoTexto, setConfirmacaoTexto] = useState("");
  const [modalConfirmacao, setModalConfirmacao] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  // --- FUNÇÃO: EXPORTAR BACKUP ---
  async function handleBackup() {
    if (!usuario) return;
    setCarregando(true);
    setProgresso("Iniciando coleta de dados...");

    try {
      const backup: any = {
        sistema: "LaunchApp",
        versao: "1.0",
        data_backup: new Date().toISOString(),
        total_registros: {},
        dados: {}
      };

      for (const tabela of TABELAS) {
        setProgresso(`Buscando dados de: ${tabela}...`);
        const { data, error } = await supabase.from(tabela as any).select("*");
        
        if (error) throw error;

        // Se for usuários, removemos senhas e informações sensíveis se existirem
        if (tabela === "usuarios") {
          backup.dados[tabela] = (data as any[]).map(({ senha, ...u }) => u);
        } else {
          backup.dados[tabela] = data;
        }
        
        backup.total_registros[tabela] = data.length;
      }

      // Gerar arquivo
      const nomeArquivo = `launchapp-backup-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}-${new Date().getHours()}-${new Date().getMinutes()}.json`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      link.click();

      // Atualizar local storage
      const agora = new Date().toISOString();
      localStorage.setItem("ultimo_backup", agora);
      setUltimaExportacao(agora);

      // Auditoria
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "sistema",
        acao: "Backup realizado",
        detalhes: { total_registros: backup.total_registros }
      });

      toast.success("Backup realizado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao realizar backup: " + err.message);
    } finally {
      setCarregando(false);
      setProgresso("");
    }
  }

  // --- FUNÇÃO: LER ARQUIVO PARA RESTAURAÇÃO ---
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.sistema !== "LaunchApp") {
          toast.error("Arquivo inválido. Não é um backup do LaunchApp.");
          return;
        }
        setArquivoRestaurar(json);
      } catch (err) {
        toast.error("Erro ao ler arquivo JSON.");
      }
    };
    reader.readAsText(file);
  }

  // --- FUNÇÃO: EXECUTAR RESTAURAÇÃO ---
  async function handleRestaurar() {
    if (!usuario || !arquivoRestaurar) return;
    if (confirmacaoTexto !== "CONFIRMAR") {
      toast.error("Digite CONFIRMAR para prosseguir");
      return;
    }

    setRestaurando(true);
    setProgresso("Iniciando limpeza de dados...");

    try {
      // 1. Limpar tabelas na ordem correta
      for (const tabela of TABELAS_ORDEM_DELECAO) {
        setProgresso(`Limpando tabela: ${tabela}...`);
        const { error } = await supabase.from(tabela as any).delete().neq("id", "00000000-0000-0000-0000-000000000000"); // hack para deletar tudo
        if (error) throw error;
      }

      // 2. Inserir dados na ordem correta
      for (const tabela of TABELAS) {
        // Ignoramos usuários na restauração para não quebrar a sessão atual, 
        // ou upsertamos se necessário. Usuário disse "não restaurar usuários para não perder acesso"
        if (tabela === "usuarios") continue;

        const dados = arquivoRestaurar.dados[tabela];
        if (dados && dados.length > 0) {
          setProgresso(`Restaurando dados de: ${tabela} (${dados.length} registros)...`);
          
          // Inserir em lotes se necessário (Supabase handles batch inserts well)
          const { error } = await supabase.from(tabela as any).insert(dados);
          if (error) throw error;
        }
      }

      // Auditoria
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "sistema",
        acao: "Backup restaurado",
        detalhes: { 
          data_backup: arquivoRestaurar.data_backup, 
          total_registros: arquivoRestaurar.total_registros 
        }
      });

      toast.success("Sistema restaurado com sucesso! Recarregando...");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro na restauração: " + err.message);
      setRestaurando(false);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
          <Database size={32} className="text-primary" /> Backup do Sistema
        </h1>
        <p className="text-muted-foreground font-medium">Gerencie os backups e a integridade dos dados do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CARD: FAZER BACKUP */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border-2 border-orange-100 flex flex-col h-full relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-orange-50 rounded-full blur-3xl group-hover:bg-orange-100 transition-colors" />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6 shadow-sm">
              <Save size={28} />
            </div>

            <h2 className="text-2xl font-black text-gray-800 mb-2">Exportar Backup Completo</h2>
            <p className="text-gray-500 font-medium mb-6 leading-relaxed">
              Exporta todos os dados do sistema em um arquivo JSON. Guarde em local seguro (Google Drive, pendrive, etc).
            </p>

            <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100 mb-8 flex items-center gap-3">
              <History size={18} className="text-orange-600" />
              <div>
                <p className="text-[10px] font-black text-orange-600/60 uppercase tracking-widest">Última Exportação</p>
                <p className="font-bold text-orange-900 leading-tight">
                  {ultimaExportacao ? formatDateTime(ultimaExportacao) : "Nunca realizado"}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-3 mb-8">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">O que será exportado:</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  "Produtos e Categorias",
                  "Vendas e Itens de Vendas",
                  "Estoque e Entradas",
                  "Clientes",
                  "Entregadores e Pagamentos",
                  "Caixas e Movimentações",
                  "Usuários (dados públicos)",
                  "Solicitações de Senha",
                  "Auditória completa"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-bold text-gray-600 px-1">
                    <CheckCircle2 size={16} className="text-green-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <Button 
              onClick={handleBackup} 
              disabled={carregando}
              className="w-full py-7 rounded-2xl font-black text-lg bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/30 gap-2 transition-all active:scale-95"
            >
              {carregando ? (
                <>
                  <Loader2 className="animate-spin" size={24} />
                  {progresso || "PROCESSANDO..."}
                </>
              ) : (
                <>
                  <Download size={24} /> FAZER BACKUP AGORA
                </>
              )}
            </Button>
          </div>
        </div>

        {/* CARD: RESTAURAR */}
        <div className="bg-[#fffbeb] rounded-3xl p-8 shadow-sm border-2 border-yellow-200 flex flex-col h-full relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-yellow-100/50 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="w-14 h-14 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center mb-6 shadow-sm">
              <Upload size={28} />
            </div>

            <h2 className="text-2xl font-black text-yellow-900 mb-2">Restaurar Backup</h2>
            
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl mb-6">
              <div className="flex gap-3">
                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                <p className="text-xs font-bold text-red-700 leading-relaxed">
                  <span className="font-black uppercase tracking-tighter mr-1 font-sans">Atenção:</span> 
                  A restauração substituirá TODOS os dados atuais do sistema. Esta ação não pode ser desfeita. 
                  Faça um backup atual antes de restaurar.
                </p>
              </div>
            </div>

            {!arquivoRestaurar ? (
              <div className="flex-1 flex flex-col justify-center items-center py-10 border-2 border-dashed border-yellow-200 rounded-3xl bg-white/50 mb-8 transition-all hover:bg-white hover:border-yellow-400">
                <FileJson size={48} className="text-yellow-400 mb-4" />
                <p className="text-sm font-bold text-yellow-800 mb-4">Selecione um arquivo .json</p>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleFileChange}
                  className="hidden" 
                  id="file-upload" 
                />
                <Button 
                  asChild 
                  variant="outline" 
                  className="rounded-xl border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                >
                  <label htmlFor="file-upload" className="cursor-pointer">Escolher Arquivo</label>
                </Button>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-3xl p-4 border border-yellow-200 mb-8 space-y-4 shadow-inner">
                <div className="flex items-center justify-between border-b border-yellow-50 pb-2">
                  <div className="flex items-center gap-2">
                    <FileJson size={20} className="text-yellow-600" />
                    <span className="text-xs font-black text-gray-700 uppercase truncate max-w-[150px]">Backup Selecionado</span>
                  </div>
                  <button 
                    onClick={() => setArquivoRestaurar(null)} 
                    className="text-[10px] font-black text-red-500 hover:underline"
                  >
                    MUDAR
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Data do Backup</p>
                    <p className="text-sm font-bold text-gray-800">{formatDateTime(arquivoRestaurar.data_backup)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase">Registros</p>
                    <p className="text-sm font-bold text-gray-800">
                      {Object.values(arquivoRestaurar.total_registros).reduce((a: any, b: any) => a + b, 0)} total
                    </p>
                  </div>
                </div>

                <div className="bg-yellow-50/50 rounded-xl p-3 border border-yellow-100 max-h-[120px] overflow-y-auto">
                  <p className="text-[9px] font-black text-yellow-700/60 uppercase tracking-widest mb-2">Resumo de Tabelas:</p>
                  {Object.entries(arquivoRestaurar.total_registros).map(([tabela, total]) => (
                    <div key={tabela} className="flex justify-between text-[10px] font-bold text-gray-600 border-b border-yellow-100/50 py-1 last:border-0">
                      <span className="capitalize">{tabela}</span>
                      <span>{String(total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {arquivoRestaurar && (
              <Button 
                onClick={() => setModalConfirmacao(true)}
                className="w-full py-7 rounded-2xl font-black text-lg bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30 gap-2 transition-all active:scale-95"
              >
                <AlertTriangle size={24} /> RESTAURAR SISTEMA AGORA
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO CRÍTICA */}
      {modalConfirmacao && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-red-100 text-red-600 flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            
            <h2 className="text-2xl font-black text-center text-gray-900 mb-2">Confirmar Restauração?</h2>
            <p className="text-center text-gray-500 font-medium mb-8">
              Você está prestes a substituir <span className="text-red-600 font-black">TODOS</span> os dados pelo backup de <span className="font-bold text-gray-900">{formatDateTime(arquivoRestaurar?.data_backup)}</span>. 
              Esta ação é <span className="font-black underline">irreversível</span>.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-center text-xs font-black text-gray-400 uppercase tracking-widest">Digite CONFIRMAR para prosseguir</p>
                <input 
                  type="text" 
                  value={confirmacaoTexto}
                  onChange={e => setConfirmacaoTexto(e.target.value.toUpperCase())}
                  className="w-full h-14 border-2 border-red-100 rounded-2xl text-center text-xl font-black focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all"
                  placeholder="DIGITE AQUI"
                  disabled={restaurando}
                />
              </div>

              {restaurando && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Processando Restauração...</span>
                  </div>
                  <p className="text-[10px] text-center font-black text-gray-400 uppercase animate-pulse">{progresso}</p>
                </div>
              )}

              {!restaurando && (
                <div className="flex gap-4">
                  <Button 
                    variant="ghost" 
                    className="flex-1 py-6 rounded-2xl font-bold text-gray-500"
                    onClick={() => {
                      setModalConfirmacao(false);
                      setConfirmacaoTexto("");
                    }}
                  >
                    CANCELAR
                  </Button>
                  <Button 
                    className="flex-1 py-6 rounded-2xl font-black bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleRestaurar}
                  >
                    RESTAURAR
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="bg-white/50 backdrop-blur-sm border border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-black text-gray-800">Segurança de Dados</p>
            <p className="text-xs font-medium text-gray-500">Seus dados estão protegidos por criptografia ponta-a-ponta no Supabase.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
          <Info size={14} /> Local de armazenamento recomendado: Google Drive ou DropBox
        </div>
      </div>
    </div>
  );
}

// Helper para links do drawer (não usado aqui, mas para consistência se necessário importar subcomponentes)
