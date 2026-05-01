import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Cadastro() {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const isValidEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!nome.trim() || !email.trim() || !senha.trim() || !confirmarSenha.trim()) {
      setErro("Preencha todos os campos.");
      return;
    }

    if (!isValidEmail(email)) {
      setErro("E-mail inválido.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    
    // 1. Criar Auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
        }
      }
    });

    if (authError) {
      setCarregando(false);
      setErro(authError.message);
      return;
    }

    if (authData.user) {
      // 2. Inserir na tabela usuarios
      const { error: dbError } = await supabase
        .from('usuarios')
        .insert({
          id: authData.user.id,
          nome: nome.trim(),
          email: email.trim(),
          perfil: 'atendente',
          ativo: false
        });

      setCarregando(false);

      if (dbError) {
        // Se falhar ao gravar no banco, avisamos, mas a conta auth foi criada
        console.error("Erro ao salvar perfil de usuário:", dbError);
        setErro("Erro ao registrar o perfil. Entre em contato com o suporte.");
        return;
      }

      setSucesso(true);
      toast.success("Conta criada com sucesso! Aguarde a ativação pelo administrador antes de fazer login.");
      
      // Limpar os campos opcionais se quiser, ou deixar assim por já estar no "sucesso"
      setNome("");
      setEmail("");
      setSenha("");
      setConfirmarSenha("");
    } else {
      setCarregando(false);
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
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1f2937", marginBottom: "0.2rem" }}>Criar Conta</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>Preencha os dados para criar sua conta</p>
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
              <p style={{ fontSize: "0.9rem" }}>Conta criada com sucesso! Aguarde a ativação pelo administrador antes de fazer login.</p>
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
              Fazer Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label
                  htmlFor="nome"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1e3a8a",
                    marginBottom: "0.4rem",
                  }}
                >
                  Nome completo *
                </label>
                <input
                  id="nome"
                  type="text"
                  autoComplete="name"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
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
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
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

              {/* Senha */}
              <div>
                <label
                  htmlFor="senha"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1e3a8a",
                    marginBottom: "0.4rem",
                  }}
                >
                  Senha *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="senha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={carregando}
                    style={{
                      width: "100%",
                      padding: "0.75rem 3rem 0.75rem 1rem",
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
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    disabled={carregando}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      padding: 0,
                    }}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha */}
              <div>
                <label
                  htmlFor="confirmarSenha"
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color: "#1e3a8a",
                    marginBottom: "0.4rem",
                  }}
                >
                  Confirmar senha *
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="confirmarSenha"
                    type={mostrarSenha ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Repita a senha"
                    disabled={carregando}
                    style={{
                      width: "100%",
                      padding: "0.75rem 3rem 0.75rem 1rem",
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
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    disabled={carregando}
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      padding: 0,
                    }}
                    aria-label={mostrarSenha ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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
                    Criando...
                  </>
                ) : (
                  "Criar Conta"
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
                Já tenho conta
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
