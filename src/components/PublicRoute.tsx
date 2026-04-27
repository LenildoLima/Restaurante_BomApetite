import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

/**
 * Rota pública (ex: /login).
 * Se o usuário já estiver autenticado, redireciona para a rota adequada ao perfil.
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "#faf8f5" }}>
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  if (usuario) {
    // Admin vai para o painel; cozinheiro para cozinha; atendente vai para nova venda
    const destino = 
      usuario.perfil === "admin" ? "/" : 
      usuario.perfil === "cozinheiro" ? "/cozinha" : 
      "/nova-venda";
    return <Navigate to={destino} replace />;
  }

  return <>{children}</>;
}
