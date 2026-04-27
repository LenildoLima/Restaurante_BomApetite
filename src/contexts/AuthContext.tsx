import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/auditoria";

export type PerfilUsuario = "admin" | "atendente" | "cozinheiro";

export interface UsuarioLogado {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
}

interface AuthContextType {
  usuario: UsuarioLogado | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  atualizarUsuarioSession: (dados: Partial<UsuarioLogado>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [loading, setLoading] = useState(true);

  async function carregarUsuario(userId: string): Promise<UsuarioLogado | null> {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, perfil, ativo")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    
    if (!data.ativo) {
      await supabase.auth.signOut();
      return null;
    }

    return {
      id: data.id,
      nome: data.nome,
      email: data.email,
      perfil: data.perfil as PerfilUsuario,
    };
  }

  useEffect(() => {
    // 1) Timeout rígido restrito a 2 segundos
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    // 2) Carrega a sessão inicial de forma linear
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        carregarUsuario(session.user.id).then((u) => {
          setUsuario(u);
          clearTimeout(timeout);
          setLoading(false);
        }).catch(() => {
          clearTimeout(timeout);
          setLoading(false);
        });
      } else {
        clearTimeout(timeout);
        setLoading(false);
      }
    }).catch(() => {
      clearTimeout(timeout);
      setLoading(false);
    });

    // 3) Escutador de estado simplificado para evitar loops (sem loaders globais extras)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUsuario(null);
        setLoading(false);
      } else if (event === "SIGNED_IN" && session?.user) {
        carregarUsuario(session.user.id).then((u) => {
          setUsuario(u);
        });
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, senha: string): Promise<{ error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        return { error: "Email ou senha inválidos." };
      }

      if (!data.user) {
        return { error: "Usuário não encontrado." };
      }

      const { data: dbData, error: dbError } = await supabase
        .from("usuarios")
        .select("id, nome, email, perfil, ativo")
        .eq("id", data.user.id)
        .maybeSingle();
        
      if (dbError || !dbData) {
        await supabase.auth.signOut();
        return { error: "Usuário não encontrado no sistema." };
      }

      if (!dbData.ativo) {
        await supabase.auth.signOut();
        await registrarAuditoria({
          usuario_id: dbData.id,
          usuario_nome: dbData.nome,
          tipo: "autenticacao",
          acao: "Tentativa de login bloqueada - conta inativa",
          detalhes: { email }
        });
        return { error: "Conta aguardando ativação pelo administrador." };
      }

      const u: UsuarioLogado = {
        id: dbData.id,
        nome: dbData.nome,
        email: dbData.email,
        perfil: dbData.perfil as PerfilUsuario,
      };

      await registrarAuditoria({
        usuario_id: u.id,
        usuario_nome: u.nome,
        tipo: "autenticacao",
        acao: "Login realizado",
        detalhes: { email }
      });

      setUsuario(u);
      return {};
    } catch {
      return { error: "Erro inesperado. Tente novamente." };
    }
  }

  async function logout(): Promise<void> {
    if (usuario) {
      await registrarAuditoria({
        usuario_id: usuario.id,
        usuario_nome: usuario.nome,
        tipo: "autenticacao",
        acao: "Logout realizado",
        detalhes: { email: usuario.email }
      });
    }
    await supabase.auth.signOut();
    setUsuario(null);
  }

  function isAdmin(): boolean {
    return usuario?.perfil === "admin";
  }

  function atualizarUsuarioSession(dados: Partial<UsuarioLogado>) {
    setUsuario((prev) => (prev ? { ...prev, ...dados } : null));
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, isAdmin, atualizarUsuarioSession }}>
      {children}
    </AuthContext.Provider>
  );
}

