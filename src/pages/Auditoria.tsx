import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Search, ClipboardList, Filter, User, Tag, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";

interface LogAuditoria {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  tipo: string;
  acao: string;
  detalhes: any;
  criado_em: string;
}

export default function Auditoria() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [rangeFiltro, setRangeFiltro] = useState<"hoje" | "semana" | "mes" | "todos">("todos");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/nova-venda");
      return;
    }
    document.title = "Auditoria | LaunchApp";
    const timeout = setTimeout(() => {
      fetchLogs();
    }, 300); // Debounce search
    return () => clearTimeout(timeout);
  }, [rangeFiltro, tipoFiltro, search]);

  async function fetchLogs() {
    setCarregando(true);
    let query = supabase.from("auditoria").select("*").order("criado_em", { ascending: false });

    if (tipoFiltro !== "todos") {
      query = query.eq("tipo", tipoFiltro);
    }

    if (rangeFiltro !== "todos") {
      const agora = new Date();
      let dataInicio = new Date();
      
      if (rangeFiltro === "hoje") {
        dataInicio.setHours(0, 0, 0, 0);
      } else if (rangeFiltro === "semana") {
        dataInicio.setDate(agora.getDate() - 7);
      } else if (rangeFiltro === "mes") {
        dataInicio.setDate(agora.getDate() - 30); // Garantir exatamente 30 dias
      }
      
      query = query.gte("criado_em", dataInicio.toISOString());
    }

    // Nota: A busca por texto (search) é aplicada no lado do cliente (filtered)
    // para garantir que possamos pesquisar dentro do campo JSONB 'detalhes',
    // o que não seria possível de forma simples apenas com filtros PostgREST básicos.
    
    const { data } = await query;
    setLogs((data as LogAuditoria[]) || []);
    setCarregando(false);
  }

  const filtered = logs.filter(log => 
    (log.usuario_nome?.toLowerCase() || "").includes(search.toLowerCase()) ||
    (log.acao?.toLowerCase() || "").includes(search.toLowerCase()) ||
    JSON.stringify(log.detalhes || {}).toLowerCase().includes(search.toLowerCase())
  );

  const getTipoBadge = (tipo: string) => {
    const colors: Record<string, string> = {
      autenticacao: "bg-blue-100 text-blue-700 border-blue-200",
      venda: "bg-green-100 text-green-700 border-green-200",
      produto: "bg-purple-100 text-purple-700 border-purple-200",
      usuario: "bg-orange-100 text-orange-700 border-orange-200",
      senha: "bg-red-100 text-red-700 border-red-200",
      estoque: "bg-yellow-100 text-yellow-700 border-yellow-200",
      caixa: "bg-emerald-100 text-emerald-700 border-emerald-200",
      entrega: "bg-sky-100 text-sky-700 border-sky-200",
      produtos: "bg-indigo-100 text-indigo-700 border-indigo-200",
      sistema: "bg-amber-100 text-amber-700 border-amber-200",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colors[tipo] || "bg-[#1e3a8a]/10 text-[#1e3a8a] border-[#1e3a8a]/20"}`}>
        {tipo}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-20 z-30 -mx-4 px-4 py-4 -mt-4 bg-background/95 backdrop-blur shadow-sm md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Auditoria</h1>
            <p className="text-sm text-muted-foreground">Rastro de atividades do sistema</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por usuário, ação ou detalhe..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 h-11"
          />
        </div>
        
        <div className="flex gap-2">
          <div className="flex bg-muted p-1 rounded-lg">
            {(["hoje", "semana", "mes", "todos"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRangeFiltro(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${
                  rangeFiltro === r 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <select 
            value={tipoFiltro} 
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="h-11 px-3 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="todos">Todos os tipos</option>
            <option value="autenticacao">Autenticação</option>
            <option value="venda">Vendas</option>
            <option value="produto">Produtos</option>
            <option value="usuario">Usuários</option>
            <option value="senha">Senhas</option>
            <option value="estoque">Estoque</option>
            <option value="caixa">Caixa</option>
            <option value="entrega">Entregas</option>
            <option value="produtos">Produtos</option>
            <option value="sistema">Sistema</option>
          </select>
        </div>
      </div>

      <div className="card-metric p-0 overflow-hidden relative border border-border/50">
        <div className="max-h-[65vh] overflow-auto scrollbar-thin">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-20 bg-background border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Momento</th>
                <th className="text-left p-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Usuário</th>
                <th className="text-left p-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Tipo</th>
                <th className="text-left p-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Ação</th>
                <th className="text-left p-4 font-bold text-muted-foreground text-[11px] uppercase tracking-wider">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {carregando ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground italic">Carregando logs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">Nenhum registro encontrado.</td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 whitespace-nowrap text-muted-foreground font-medium">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="opacity-50" />
                        {formatDateTime(log.criado_em)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary">
                          {log.usuario_nome.charAt(0)}
                        </div>
                        {log.usuario_nome}
                      </div>
                    </td>
                    <td className="p-4">{getTipoBadge(log.tipo)}</td>
                    <td className="p-4 font-medium text-foreground">{log.acao}</td>
                    <td className="p-4 text-xs text-muted-foreground">
                      <pre className="font-sans whitespace-pre-wrap max-w-xs overflow-hidden text-ellipsis">
                        {JSON.stringify(log.detalhes, null, 1).replace(/[{}]/g, "")}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
