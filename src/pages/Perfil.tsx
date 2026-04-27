import { useState, useEffect } from "react";
import { User as UserIcon, Lock, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditoria";

export default function Perfil() {
  const { usuario, atualizarUsuarioSession } = useAuth();
  const navigate = useNavigate();

  // Seção de Dados Pessoais
  const [nome, setNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);

  // Seção Alterar Senha
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState("");

  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome);
    }
  }, [usuario]);

  async function handleSalvarNome(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !usuario) return;

    setSalvandoNome(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ nome: nome.trim() })
        .eq('id', usuario.id);

      if (error) throw error;
      
      const nomeAnterior = usuario.nome;
      atualizarUsuarioSession({ nome: nome.trim() });
      
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: nome.trim(),
        tipo: "usuario",
        acao: "Perfil atualizado",
        detalhes: { nome_novo: nome.trim() }
      });

      toast.success("Nome atualizado com sucesso!");
    } catch (err) {
      toast.error("Erro ao atualizar o nome. Tente novamente.");
    } finally {
      setSalvandoNome(false);
    }
  }

  async function handleAlterarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha("");

    if (!usuario?.email) return;
    if (novaSenha.length < 6) return setErroSenha("A nova senha deve ter no mínimo 6 caracteres.");
    if (novaSenha !== confirmarSenha) return setErroSenha("As senhas não coincidem.");

    setSalvandoSenha(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (updateError) {
        setErroSenha(updateError.message || "Erro ao definir a nova senha.");
        setSalvandoSenha(false);
        return;
      }

      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "senha",
        acao: "Senha alterada pelo próprio usuário",
        detalhes: { email: usuario.email }
      });

      toast.success("Senha alterada com sucesso!");
      setNovaSenha("");
      setConfirmarSenha("");
      setMostrarNovaSenha(false);
      setMostrarConfirmarSenha(false);
    } catch (err: any) {
      setErroSenha('Ocorreu um erro inesperado.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div style={{ minHeight: "calc(100vh - 80px)", background: "#faf8f5", padding: "2rem 1.5rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        
        {/* Header da Tela Perfil */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "1.75rem", fontWeight: 800, color: "#1e3a8a", margin: 0 }}>
              <UserIcon size={28} color="#ea580c" />
              Meu Perfil
            </h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#fff",
              border: "1px solid #e5e7eb",
              padding: "0.5rem 1rem",
              borderRadius: "0.6rem",
              color: "#1e3a8a",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
            }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>

        {/* Card Principal */}
        <div style={cardStyle}>
          
          <div style={{ padding: "2rem", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>
            <div style={{ 
              width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", 
              color: "#fff", fontSize: "2.5rem", display: "flex", alignItems: "center", 
              justifyContent: "center", fontWeight: "bold", margin: "0 auto 1rem auto",
              boxShadow: "0 4px 12px rgba(234, 88, 12, 0.4)" 
            }}>
              {nome.charAt(0).toUpperCase() || usuario?.nome.charAt(0).toUpperCase()}
            </div>
            
            <div style={{ display: "inline-block", padding: "0.3rem 0.8rem", background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa", borderRadius: "1rem", fontSize: "0.8rem", fontWeight: 700 }}>
              {usuario?.perfil === "admin" ? "Administrador" : "Atendente"}
            </div>
          </div>

          <div style={{ padding: "2rem" }}>
            {/* Seção Dados Pessoais */}
            <form onSubmit={handleSalvarNome}>
              <div style={{ marginBottom: "1.5rem" }}>
                <label style={labelStyle}>Nome completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  style={inputStyle}
                  autoComplete="off"
                />
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={labelStyle}>E-mail</label>
                <input
                  type="email"
                  value={usuario?.email || ""}
                  disabled
                  style={{ ...inputStyle, background: "#f9fafb", color: "#6b7280", borderColor: "#f3f4f6", cursor: "not-allowed" }}
                />
              </div>

              <div style={{ paddingBottom: "2.5rem", borderBottom: "1px solid #e5e7eb" }}>
                <button
                  type="submit"
                  disabled={salvandoNome}
                  style={primaryButtonStyle(salvandoNome)}
                >
                  {salvandoNome ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : "Salvar alterações"}
                </button>
              </div>
            </form>

            {/* Seção Alterar Senha */}
            <form onSubmit={handleAlterarSenha} style={{ paddingTop: "2.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
                <Lock size={18} color="#ea580c" />
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1e3a8a", margin: 0 }}>Alterar Senha</h2>
              </div>

              {/* Workaround for browser autocomplete */}
              <input style={{ display: "none" }} type="password" name="fake-new-pwd" />

              <div style={{ marginBottom: "1.25rem" }}>
                <label style={labelStyle}>Nova senha <span style={{ color: "#9ca3af", fontWeight: 400 }}>(mínimo 6 caracteres)</span></label>
                <div style={{ position: "relative" }}>
                  <input
                    type={mostrarNovaSenha ? "text" : "password"}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: "2.8rem" }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                    style={eyeButtonStyle}
                  >
                    {mostrarNovaSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={labelStyle}>Confirmar nova senha</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={mostrarConfirmarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    style={{ ...inputStyle, paddingRight: "2.8rem" }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                    style={eyeButtonStyle}
                  >
                    {mostrarConfirmarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {erroSenha && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem",
                  padding: "0.75rem", color: "#dc2626", fontSize: "0.85rem", fontWeight: 500, marginBottom: "1.5rem"
                }}>
                  {erroSenha}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={salvandoSenha}
                  style={primaryButtonStyle(salvandoSenha)}
                >
                  {salvandoSenha ? <><Loader2 size={16} className="animate-spin" /> Atualizando senha...</> : "Alterar senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Estilos Compartilhados
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "1.25rem",
  boxShadow: "0 10px 40px rgba(0,0,0,0.04)",
  overflow: "hidden",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#1e3a8a",
  marginBottom: "0.4rem"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.8rem 1rem",
  borderRadius: "0.65rem",
  border: "1.5px solid #e5e7eb",
  fontSize: "1rem",
  color: "#1e3a8a",
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
  transition: "border-color 0.2s"
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: "0.75rem",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#9ca3af",
  display: "flex",
  alignItems: "center"
};

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "0.85rem 1.25rem",
  borderRadius: "0.65rem",
  background: disabled ? "#fed7aa" : "linear-gradient(135deg, #f97316, #ea580c)",
  border: "none",
  color: "#fff",
  fontWeight: 700,
  fontSize: "0.95rem",
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  boxShadow: disabled ? "none" : "0 4px 12px rgba(249,115,22,0.3)",
});
