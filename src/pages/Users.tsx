import { useState, useEffect } from "react";
import { Users as UsersIcon, Plus, Pencil, Power, X, Eye, EyeOff, Loader2, KeyRound, Copy, RefreshCw, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate, Link } from "react-router-dom";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: "admin" | "atendente" | "cozinheiro";
  ativo: boolean;
  criado_em: string;
}

interface SolicitacaoSenha {
  id: string;
  usuario_id: string;
  email: string;
  status: string;
  criado_em: string;
  usuarios: { nome: string };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function UsersPage() {
  const { usuario, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState("");

  // Form novo usuário
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoPerfil, setNovoPerfil] = useState<"admin" | "atendente" | "cozinheiro">("atendente");
  const [novoAtivo, setNovoAtivo] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);

  // Solicitações
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoSenha[]>([]);
  const [modalResetAberto, setModalResetAberto] = useState(false);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<SolicitacaoSenha | null>(null);
  const [senhaReset, setSenhaReset] = useState("");
  const [senhaResetConfirmacao, setSenhaResetConfirmacao] = useState("");
  const [mostrarSenhaReset, setMostrarSenhaReset] = useState(true);
  const [resetando, setResetando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/nova-venda", { replace: true });
      return;
    }
    buscarUsuarios();
  }, []);

  async function buscarUsuarios() {
    setCarregando(true);
    const [resUsuarios, resSol] = await Promise.all([
      supabase.from("usuarios").select("*").order("criado_em", { ascending: true }),
      supabase.from("solicitacoes_senha").select(`*, usuarios(nome)`).eq("status", "pendente").order("criado_em", { ascending: false })
    ]);
    setUsuarios((resUsuarios.data as Usuario[]) || []);
    setSolicitacoes((resSol.data as any) || []);
    setCarregando(false);
  }

  function fecharModal() {
    setModalAberto(false);
    setUsuarioSelecionado(null);
    setErroModal("");
    setNovoNome("");
    setNovoEmail("");
    setNovaSenha("");
    setNovoPerfil("atendente");
    setNovoAtivo(true);
    setMostrarSenha(false);
  }

  function abrirModalNovo() {
    setUsuarioSelecionado(null);
    setErroModal("");
    setNovoNome("");
    setNovoEmail("");
    setNovaSenha("");
    setNovoPerfil("atendente");
    setNovoAtivo(true);
    setMostrarSenha(false);
    setModalAberto(true);
  }

  function abrirModalEditar(u: Usuario) {
    setUsuarioSelecionado(u);
    setErroModal("");
    setNovoNome(u.nome);
    setNovoEmail(u.email);
    setNovaSenha("");
    setNovoPerfil(u.perfil);
    setNovoAtivo(u.ativo);
    setMostrarSenha(false);
    setModalAberto(true);
  }

  async function salvarUsuario(e: React.FormEvent) {
    e.preventDefault();
    setErroModal("");

    if (!novoNome.trim()) return setErroModal("Nome é obrigatório.");
    if (!usuarioSelecionado && !novoEmail.trim()) return setErroModal("Email é obrigatório.");
    if (!usuarioSelecionado && novaSenha.length < 6) return setErroModal("A senha deve ter pelo menos 6 caracteres.");
    if (usuarioSelecionado && novaSenha.length > 0 && novaSenha.length < 6) return setErroModal("A nova senha deve ter pelo menos 6 caracteres.");

    setSalvando(true);
    try {
      if (usuarioSelecionado) {
        // Modo Edição
        const { data, error } = await supabase.functions.invoke("editar-usuario", {
          body: {
            id: usuarioSelecionado.id,
            nome: novoNome.trim(),
            perfil: novoPerfil,
            ativo: novoAtivo,
            senha: novaSenha || undefined, // Evitar enviar string vazia
          }
        });

        if (error) {
           throw new Error(error.message || "Erro ao editar usuário.");
        }

        if (usuario) {
          await registrarAuditoria({
            usuario_id: usuario.id,
            usuario_nome: usuario.nome,
            tipo: "usuario",
            acao: "Usuário editado",
            detalhes: { 
              id: usuarioSelecionado.id,
              nome: novoNome.trim(), 
              perfil: novoPerfil, 
              ativo: novoAtivo,
              editado_por_admin: true
            }
          });
        }
      } else {
        // Modo Criação
        const { data, error } = await supabase.functions.invoke("criar-usuario", {
          body: {
            nome: novoNome.trim(),
            email: novoEmail.trim().toLowerCase(),
            password: novaSenha,
            perfil: novoPerfil,
            ativo: novoAtivo,
          }
        });

        if (error) {
           throw new Error(error.message || "Erro ao criar usuário.");
        }

        if (usuario) {
          await registrarAuditoria({
            usuario_id: usuario.id,
            usuario_nome: usuario.nome,
            tipo: "usuario",
            acao: "Usuário criado",
            detalhes: { nome: novoNome.trim(), email: novoEmail.trim().toLowerCase(), perfil: novoPerfil }
          });
        }
      }

      await buscarUsuarios();
      fecharModal();
    } catch (err: unknown) {
      setErroModal(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(u: Usuario) {
    await supabase
      .from("usuarios")
      .update({ ativo: !u.ativo })
      .eq("id", u.id);

    if (usuario) {
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "usuario",
        acao: u.ativo ? "Usuário desativado" : "Usuário ativado",
        detalhes: { nome: u.nome, email: u.email }
      });
    }

    setUsuarios((prev) =>
      prev.map((x) => (x.id === u.id ? { ...x, ativo: !x.ativo } : x))
    );
  }

  function abrirModalReset(s: SolicitacaoSenha) {
    setSolicitacaoSelecionada(s);
    setErroModal("");
    setSenhaReset("");
    setSenhaResetConfirmacao("");
    setMostrarSenhaReset(true);
    setModalResetAberto(true);
  }

  function fecharModalReset() {
    setModalResetAberto(false);
    setSolicitacaoSelecionada(null);
  }

  function gerarNovaSenha() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#!";
    let senha = "";
    for (let i = 0; i < 8; i++) {
      senha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSenhaReset(senha);
    setSenhaResetConfirmacao(senha);
    setMostrarSenhaReset(true);
  }

  async function confirmarResetSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroModal("");
    if (senhaReset.length < 6) return setErroModal("A senha deve ter pelo menos 6 caracteres.");
    if (senhaReset !== senhaResetConfirmacao) return setErroModal("As senhas não coincidem.");

    setResetando(true);
    try {
      const { error } = await supabase.functions.invoke("editar-usuario", {
        body: { id: solicitacaoSelecionada!.usuario_id, senha: senhaReset }
      });
      if (error) throw new Error(error.message || "Erro ao atualizar a senha.");

      await supabase.from("solicitacoes_senha").update({ status: "resolvida" }).eq("id", solicitacaoSelecionada!.id);
      
      if (usuario) {
        await registrarAuditoria({
          usuario_id: usuario.id,
          usuario_nome: usuario.nome,
          tipo: "senha",
          acao: "Senha redefinida pelo administrador",
          detalhes: { usuario_nome: solicitacaoSelecionada.usuarios?.nome, usuario_email: solicitacaoSelecionada.email }
        });
      }

      toast.success("Senha redefinida com sucesso! Informe a senha temporária ao usuário.");
      await buscarUsuarios();
      fecharModalReset();
    } catch (err: any) {
      setErroModal(err.message || "Erro inesperado.");
    } finally {
      setResetando(false);
    }
  }

  function copiarSenha() {
    if (!senhaReset) return;
    navigator.clipboard.writeText(senhaReset);
    setCopiado(true);
    toast.success("Copiado!");
    setTimeout(() => setCopiado(false), 2000);
  }

  const badgePerfil = (perfil: string) =>
    perfil === "admin" ? (
      <span
        style={{
          background: "#fff7ed",
          color: "#ea580c",
          border: "1px solid #fed7aa",
          borderRadius: "0.4rem",
          padding: "0.2rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        Admin
      </span>
    ) : perfil === "cozinheiro" ? (
      <span
        style={{
          background: "#fef3c7",
          color: "#92400e",
          border: "1px solid #fde68a",
          borderRadius: "0.4rem",
          padding: "0.2rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        Cozinheiro
      </span>
    ) : (
      <span
        style={{
          background: "#eff6ff",
          color: "#2563eb",
          border: "1px solid #bfdbfe",
          borderRadius: "0.4rem",
          padding: "0.2rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        Atendente
      </span>
    );

  const badgeStatus = (ativo: boolean) =>
    ativo ? (
      <span
        style={{
          background: "#f0fdf4",
          color: "#16a34a",
          border: "1px solid #bbf7d0",
          borderRadius: "0.4rem",
          padding: "0.2rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        Ativo
      </span>
    ) : (
      <span
        style={{
          background: "#fef2f2",
          color: "#dc2626",
          border: "1px solid #fecaca",
          borderRadius: "0.4rem",
          padding: "0.2rem 0.65rem",
          fontSize: "0.75rem",
          fontWeight: 700,
        }}
      >
        Inativo
      </span>
    );

  return (
    <div>
      {/* Banner Perfil */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#fff7ed",
        border: "1px solid #fed7aa",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <UserCircle size={24} color="#ea580c" />
          <span style={{ color: "#9a3412", fontWeight: 600, fontSize: "0.95rem" }}>
            Quer alterar seus dados ou senha?
          </span>
        </div>
        <Link 
          to="/perfil" 
          style={{ 
            color: "#ea580c", 
            fontWeight: 700, 
            fontSize: "0.9rem", 
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem"
          }}
          className="hover:underline"
        >
          Acesse seu perfil aqui →
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "0.75rem",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(249,115,22,0.3)",
            }}
          >
            <UsersIcon size={22} color="#fff" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground" style={{ letterSpacing: "-0.02em" }}>
              Usuários
              {usuarios.filter(u => !u.ativo).length > 0 && (
                <span style={{ 
                  marginLeft: '0.6rem', 
                  fontSize: '0.95rem', 
                  color: '#ea580c', 
                  fontWeight: 800,
                  background: '#fff7ed',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.5rem',
                  verticalAlign: 'middle',
                  border: '1px solid #fed7aa'
                }}>
                  {usuarios.filter(u => !u.ativo).length} pendentes
                </span>
              )}
              {solicitacoes.length > 0 && (
                <span style={{ 
                  marginLeft: usuarios.filter(u => !u.ativo).length > 0 ? '0.4rem' : '0.6rem', 
                  fontSize: '0.95rem', 
                  color: '#ea580c', 
                  fontWeight: 800,
                  background: '#fff7ed',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '0.5rem',
                  verticalAlign: 'middle',
                  border: '1px solid #fed7aa'
                }}>
                  {solicitacoes.length} solicitações de senha
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">Gerenciar equipe</p>
          </div>
        </div>

        <button
          onClick={abrirModalNovo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "0.65rem",
            padding: "0.6rem 1.1rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
          }}
        >
          <Plus size={17} />
          Novo Usuário
        </button>
      </div>

      {/* Solicitações de Senha */}
      {solicitacoes.length > 0 && (
        <div style={{ marginBottom: "2rem", background: "#fff", borderRadius: "1rem", border: "1px solid #f3f4f6", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#ea580c", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <KeyRound size={18} />
              Solicitações de Redefinição de Senha
            </h2>
          </div>
          <div>
            {solicitacoes.map((sol, i) => (
              <div key={sol.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: i < solicitacoes.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#1e3a8a", fontSize: "0.95rem" }}>{sol.usuarios?.nome || "Desconhecido"}</div>
                  <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "0.1rem" }}>{sol.email} • Solicitado em {new Date(sol.criado_em).toLocaleString("pt-BR")}</div>
                </div>
                <button
                  onClick={() => abrirModalReset(sol)}
                  style={{ background: "#ea580c", color: "#fff", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#c2410c")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#ea580c")}
                >
                  <KeyRound size={15} />
                  Redefinir senha
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Usuários */}
      <div
        style={{
          background: "#fff",
          borderRadius: "1rem",
          border: "1px solid #f3f4f6",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        {carregando ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : usuarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <UsersIcon size={40} style={{ color: "#d1d5db" }} />
            <p style={{ color: "#9ca3af", fontWeight: 500 }}>Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1e3a8a", borderBottom: "1px solid #1e40af" }}>
                  {["NOME", "EMAIL", "PERFIL", "STATUS", "AÇÕES"].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "1rem 1.25rem",
                        textAlign: "left",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "#fff",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u, i) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: "1px solid #fed7aa",
                      background: i % 2 === 0 ? "#fff7ed" : "#fffcf8",
                      transition: "background 0.15s",
                      opacity: u.ativo ? 1 : 0.8,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#ffedde")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff7ed" : "#fffcf8")}
                  >
                    <td style={{ padding: "1rem 1.25rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: u.perfil === "admin"
                              ? "linear-gradient(135deg, #f97316, #ea580c)"
                              : u.perfil === "cozinheiro"
                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                : "linear-gradient(135deg, #3b82f6, #2563eb)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            flexShrink: 0,
                          }}
                        >
                          {u.nome.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: "#1e3a8a" }}>{u.nome}</span>
                        {u.id === usuario?.id && (
                          <span style={{
                            fontSize: "0.65rem",
                            background: "#f3f4f6",
                            color: "#6b7280",
                            borderRadius: "0.3rem",
                            padding: "0.1rem 0.4rem",
                            fontWeight: 600,
                          }}>você</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "1rem 1.25rem", color: "#6b7280", fontSize: "0.9rem" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "1rem 1.25rem" }}>{badgePerfil(u.perfil)}</td>
                    <td style={{ padding: "1rem 1.25rem" }}>{badgeStatus(u.ativo)}</td>
                    <td style={{ padding: "1rem 1.25rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          title="Editar usuário"
                          onClick={() => abrirModalEditar(u)}
                          style={{
                            background: "#f3f4f6",
                            border: "1px solid #e5e7eb",
                            color: "#4b5563",
                            borderRadius: "0.5rem",
                            padding: "0.4rem",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          title={u.ativo ? "Desativar usuário" : "Ativar usuário"}
                          onClick={() => toggleAtivo(u)}
                          disabled={u.id === usuario?.id}
                          style={{
                            background: u.ativo ? "#fef2f2" : "#f0fdf4",
                            border: `1px solid ${u.ativo ? "#fecaca" : "#bbf7d0"}`,
                            color: u.ativo ? "#dc2626" : "#16a34a",
                            borderRadius: "0.5rem",
                            padding: "0.4rem",
                            cursor: u.id === usuario?.id ? "not-allowed" : "pointer",
                            opacity: u.id === usuario?.id ? 0.4 : 1,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Usuário */}
      {modalAberto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => e.target === e.currentTarget && fecharModal()}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "1.25rem",
              padding: "2rem",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#1e3a8a" }}>
                  {usuarioSelecionado ? "Editar Usuário" : "Novo Usuário"}
                </h2>
                <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                  {usuarioSelecionado ? "Atualize os dados do membro" : "Preencha os dados do novo membro"}
                </p>
              </div>
              <button onClick={fecharModal} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={salvarUsuario} className="space-y-4" autoComplete="off">
              {/* Fake fields to workaround severe browser autocomplete issues sometimes */}
              <input style={{display: 'none'}} type="email" name="fake-email" />
              <input style={{display: 'none'}} type="password" name="fake-password" />

              {/* Nome */}
              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome completo"
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  autoComplete="off"
                  disabled={usuarioSelecionado !== null}
                  style={{ ...inputStyle, background: usuarioSelecionado ? "#f3f4f6" : "#fff", color: usuarioSelecionado ? "#6b7280" : "#1e3a8a", cursor: usuarioSelecionado ? "not-allowed" : "text" }}
                />
              </div>

              {/* Senha */}
              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  {usuarioSelecionado ? "Nova Senha" : "Senha *"} <span style={{ color: "#9ca3af", fontWeight: 400 }}>{usuarioSelecionado ? "(opcional, mínimo 6 caracteres)" : "(mínimo 6 caracteres)"}</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: "2.8rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                  >
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Perfil */}
              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  Perfil *
                </label>
                <select
                  value={novoPerfil}
                  onChange={(e) => setNovoPerfil(e.target.value as "admin" | "atendente" | "cozinheiro")}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="atendente">Atendente</option>
                  <option value="cozinheiro">Cozinheiro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Toggle Ativo */}
              <div className="flex items-center justify-between" style={{ padding: "0.75rem 0", borderTop: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1e3a8a" }}>Usuário ativo</span>
                <button
                  type="button"
                  onClick={() => setNovoAtivo(!novoAtivo)}
                  disabled={usuarioSelecionado?.id === usuario?.id}
                  style={{
                    width: 46,
                    height: 26,
                    borderRadius: 13,
                    background: novoAtivo ? "#f97316" : "#e5e7eb",
                    border: "none",
                    cursor: usuarioSelecionado?.id === usuario?.id ? "not-allowed" : "pointer",
                    position: "relative",
                    transition: "background 0.2s",
                    opacity: usuarioSelecionado?.id === usuario?.id ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      left: novoAtivo ? 23 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>

              {/* Erro */}
              {erroModal && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem",
                  padding: "0.6rem 0.9rem", color: "#dc2626", fontSize: "0.83rem", fontWeight: 500,
                }}>
                  {erroModal}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  style={{
                    flex: 1, padding: "0.75rem", borderRadius: "0.65rem",
                    background: "#f9fafb", border: "1px solid #e5e7eb",
                    color: "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  style={{
                    flex: 1, padding: "0.75rem", borderRadius: "0.65rem",
                    background: salvando ? "#fed7aa" : "linear-gradient(135deg, #f97316, #ea580c)",
                    border: "none", color: "#fff", fontWeight: 700,
                    cursor: salvando ? "not-allowed" : "pointer", fontSize: "0.9rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                    boxShadow: salvando ? "none" : "0 4px 12px rgba(249,115,22,0.3)",
                  }}
                >
                  {salvando ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Redefinição de Senha */}
      {modalResetAberto && solicitacaoSelecionada && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
          onClick={(e) => e.target === e.currentTarget && fecharModalReset()}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "1.25rem",
              padding: "2rem",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "1.2rem", color: "#1e3a8a" }}>
                  Redefinir senha de {solicitacaoSelecionada.usuarios?.nome}
                </h2>
                <p style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                  Você definirá uma senha temporária em nome deste usuário.
                </p>
              </div>
              <button onClick={fecharModalReset} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={confirmarResetSenha} className="space-y-4" autoComplete="off">
              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  Nova senha temporária *
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type={mostrarSenhaReset ? "text" : "password"}
                      value={senhaReset}
                      onChange={(e) => setSenhaReset(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      style={{ ...inputStyle, paddingRight: "2.8rem" }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenhaReset(!mostrarSenhaReset)}
                      style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                    >
                      {mostrarSenhaReset ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    title="Copiar senha"
                    onClick={copiarSenha}
                    style={{ 
                      background: copiado ? "#f0fdf4" : "#f3f4f6", 
                      border: `1px solid ${copiado ? "#bbf7d0" : "#e5e7eb"}`, 
                      borderRadius: "0.65rem", 
                      padding: "0 1rem", 
                      cursor: "pointer", 
                      color: copiado ? "#16a34a" : "#4b5563",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      transition: "all 0.2s"
                    }}
                  >
                    {copiado ? (
                      <>✅ Copiado!</>
                    ) : (
                      <>📋 Copiar senha</>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.83rem", fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
                  Confirmar nova senha *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={mostrarSenhaReset ? "text" : "password"}
                    value={senhaResetConfirmacao}
                    onChange={(e) => setSenhaResetConfirmacao(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: "2.8rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaReset(!mostrarSenhaReset)}
                    style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
                  >
                    {mostrarSenhaReset ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={gerarNovaSenha}
                  style={{
                    width: "100%", background: "#fff7ed", color: "#ea580c", border: "1px dashed #fed7aa",
                    padding: "0.75rem", borderRadius: "0.65rem", fontWeight: 700, fontSize: "0.85rem",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
                  }}
                >
                  <RefreshCw size={15} />
                  🔀 Gerar senha aleatória
                </button>
              </div>

              {erroModal && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem",
                  padding: "0.6rem 0.9rem", color: "#dc2626", fontSize: "0.83rem", fontWeight: 500, marginTop: "1rem"
                }}>
                  {erroModal}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={fecharModalReset}
                  style={{
                    flex: 1, padding: "0.75rem", borderRadius: "0.65rem", background: "#f9fafb",
                    border: "1px solid #e5e7eb", color: "#6b7280", fontWeight: 600, cursor: "pointer", fontSize: "0.9rem",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetando}
                  style={{
                    flex: 1, padding: "0.75rem", borderRadius: "0.65rem",
                    background: resetando ? "#fed7aa" : "linear-gradient(135deg, #f97316, #ea580c)",
                    border: "none", color: "#fff", fontWeight: 700, cursor: resetando ? "not-allowed" : "pointer", fontSize: "0.9rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem",
                    boxShadow: resetando ? "none" : "0 4px 12px rgba(249,115,22,0.3)",
                  }}
                >
                  {resetando ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : "Confirmar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  borderRadius: "0.65rem",
  border: "1.5px solid #e5e7eb",
  fontSize: "0.9rem",
  color: "#1e3a8a",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};
