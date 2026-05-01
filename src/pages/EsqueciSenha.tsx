import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";

export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const isValidEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!email.trim()) {
      setErro("Preencha o seu e-mail.");
      return;
    }

    if (!isValidEmail(email)) {
      setErro("E-mail inválido.");
      return;
    }

    setCarregando(true);

    try {
      // 1. Check if email exists in usuarios
      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('email', email.trim())
        .maybeSingle();

      if (userError || !userData) {
        setCarregando(false);
        setErro("Email não encontrado no sistema.");
        return;
      }

      // 2. Insert into solicitacoes_senha
      const { error: reqError } = await supabase
        .from('solicitacoes_senha')
        .insert({
          email: email.trim(),
          usuario_id: userData.id,
          status: 'pendente'
        });

      if (!reqError) {
        await registrarAuditoria({
          usuario_id: userData.id,
          usuario_nome: userData.nome,
          tipo: "senha",
          acao: "Solicitação de redefinição de senha",
          detalhes: { email: email.trim() }
        });
      }

      if (reqError) {
        setCarregando(false);
        setErro("Erro ao enviar a solicitação. Tente novamente mais tarde.");
        return;
      }

      setCarregando(false);
      setSucesso(true);
    } catch (err: any) {
      setCarregando(false);
      setErro("Erro inesperado de servidor.");
    }
  }

  return (
    <div
      style={{ minHeight: "100vh", background: "#faf8f5" }}
      className="flex items-center justify-center px-4"
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "1.5rem",
          boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: "420px",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "1.25rem",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              boxShadow: "0 6px 24px rgba(249,115,22,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              marginBottom: "1rem",
            }}
          >
            <img src="/logo-bom-apetite.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <h1
            style={{
              fontWeight: 900,
              fontSize: "1.8rem",
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              marginBottom: "0.25rem",
            }}
          >
            Bom Apetite
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem", fontWeight: 500 }}>
            Gestão de Marmitaria
          </p>
        </div>

        {/* Informações do formulário */}
        <div className="text-center mb-6">
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1f2937", marginBottom: "0.2rem" }}>Esqueci minha senha</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Digite seu email para solicitar uma nova senha ao administrador
          </p>
        </div>

        {sucesso ? (
          <div className="text-center space-y-6">
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                color: "#166534",
              }}
            >
              <h3 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Sucesso!</h3>
              <p style={{ fontSize: "0.9rem" }}>
                Solicitação enviada! O administrador definirá uma nova senha para você em breve.
              </p>
            </div>
            
            <Link
              to="/login"
              style={{
                display: "inline-block",
                width: "100%",
                padding: "0.85rem",
                borderRadius: "0.75rem",
                background: "#f3f4f6",
                color: "#1e3a8a",
                fontWeight: 600,
                textDecoration: "none",
                textAlign: "center",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#e5e7eb")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "#f3f4f6")}
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1e3a8a",
                    marginBottom: "0.4rem",
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email-recuperar"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={carregando}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.75rem",
                    border: erro ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
                    fontSize: "0.95rem",
                    outline: "none",
                    color: "#1e3a8a",
                    background: carregando ? "#f9fafb" : "#fff",
                    transition: "border 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.border = "1.5px solid #f97316")}
                  onBlur={(e) =>
                    (e.target.style.border = erro
                      ? "1.5px solid #ef4444"
                      : "1.5px solid #e5e7eb")
                  }
                />
              </div>

              {/* Erro */}
              {erro && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "0.6rem",
                    padding: "0.6rem 0.9rem",
                    color: "#dc2626",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  {erro}
                </div>
              )}

              {/* Botão */}
              <button
                type="submit"
                disabled={carregando}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  borderRadius: "0.75rem",
                  background: carregando
                    ? "#fed7aa"
                    : "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "1rem",
                  border: "none",
                  cursor: carregando ? "not-allowed" : "pointer",
                  boxShadow: carregando ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                {carregando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar solicitação"
                )}
              </button>
            </div>
            
            <div className="mt-6 text-center">
              <Link
                to="/login"
                style={{
                  fontSize: "0.9rem",
                  color: "#f97316",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = "none")}
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
