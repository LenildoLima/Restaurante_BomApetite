import { supabase } from "@/integrations/supabase/client";

interface RegistrarAuditoriaParams {
  usuario_id: string;
  usuario_nome: string;
  tipo: "autenticacao" | "venda" | "produto" | "usuario" | "senha" | "estoque" | "caixa" | "entrega" | "produtos" | "sistema";
  acao: string;
  detalhes?: Record<string, any>;
}

/**
 * Registra uma ação no sistema de auditoria.
 * @param params Dados da auditoria
 */
export async function registrarAuditoria({
  usuario_id,
  usuario_nome,
  tipo,
  acao,
  detalhes = {}
}: RegistrarAuditoriaParams) {
  try {
    const { error } = await supabase.from("auditoria").insert({
      usuario_id,
      usuario_nome,
      tipo,
      acao,
      detalhes
    });

    if (error) {
      console.error("Erro ao registrar auditoria:", error);
    }
  } catch (err) {
    console.error("Erro inesperado ao registrar auditoria:", err);
  }
}
