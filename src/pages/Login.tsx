import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setEmail("");
    setSenha("");
    setErro("");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!email.trim() || !senha.trim()) {
      setErro("Preencha todos os campos.");
      return;
    }

    setCarregando(true);
    const result = await login(email.trim(), senha);
    setCarregando(false);

    if (result.error) {
      setErro(result.error);
      return;
    }

    // O redirecionamento fica a cargo do AuthContext via ProtectedRoute
    // Mas fazemos aqui também para agilizar
    // Buscamos o perfil direto do contexto atualizado via navigate
    // O PublicRoute irá redirecionar adequadamente após o login (mas o usuário já estará logado e cairá no if(usuario))
    
    // Pegar o usuário logado para decidir o destino (embora o PublicRoute cuide disso no próximo render)
    // Para simplificar e manter consistência:
    navigate("/", { replace: true });
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

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
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
                name="email-nofill"
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
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="senha"
                  name="senha-nofill"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
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

            {/* Erro */}
            {erro && !erro.includes("Conta aguardando ativação") && (
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
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </div>
        </form>

        <div style={{ marginTop: "1.5rem", textAlign: "center", fontSize: "0.85rem" }}>
          <Link
            to="/cadastro"
            style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = "underline")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = "none")}
          >
            Criar nova conta
          </Link>
          <span style={{ margin: "0 0.5rem", color: "#d1d5db" }}>|</span>
          <Link
            to="/esqueci-senha"
            style={{ color: "#f97316", textDecoration: "none", fontWeight: 600 }}
            onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = "underline")}
            onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = "none")}
          >
            Esqueci minha senha
          </Link>
        </div>

        {erro.includes("Conta aguardando ativação") ? (
          <div
            style={{
              marginTop: "2rem",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "0.75rem",
              padding: "1rem",
              color: "#166534",
              fontSize: "0.85rem",
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <span>⚠️</span>
              <span style={{ fontWeight: 700 }}>Atenção</span>
            </div>
            <p style={{ margin: 0 }}>
              Após{" "}
              <Link
                to="/cadastro"
                style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.textDecoration = "underline")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.textDecoration = "none")}
              >
                criar sua conta
              </Link>
              , aguarde a ativação pelo administrador. Sem a ativação seu acesso não será liberado mesmo com email e senha corretos.
            </p>
          </div>
        ) : (
          <p
            style={{
              textAlign: "center",
              marginTop: "2rem",
              fontSize: "0.78rem",
              color: "#d1d5db",
            }}
          >
            Acesso restrito. Solicite suas credenciais ao administrador.
          </p>
        )}
      </div>
    </div>
  );
}
