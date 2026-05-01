import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Se fornecido, redireciona para essa rota se o usuário não tiver o perfil necessário */
  apenasAdmin?: boolean;
}

export function ProtectedRoute({ children, apenasAdmin = false }: ProtectedRouteProps) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#faf8f5" }}>
        <div className="flex flex-col items-center gap-3">
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "1rem",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              animation: "pulse 1.5s infinite",
            }}
          >
            <img src="/logo-bom-apetite.png" alt="Logo" style={{ width: 48, height: 48, objectFit: "contain" }} />
          </div>
          <p style={{ color: "#9ca3af", fontWeight: 500 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Página restrita a admin, mas o usuário não é admin
  if (apenasAdmin && usuario.perfil !== "admin") {
    // Se for cozinheiro, manda para cozinha, senão para vendas
    const fallback = usuario.perfil === "cozinheiro" ? "/cozinha" : "/nova-venda";
    return <Navigate to={fallback} replace />;
  }

  // Se for cozinheiro e tentar entrar na home (Dashboard), manda para cozinha
  if (usuario.perfil === "cozinheiro" && window.location.pathname === "/") {
    return <Navigate to="/cozinha" replace />;
  }

  return <>{children}</>;
}
