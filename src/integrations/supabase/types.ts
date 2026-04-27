export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      produtos: {
        Row: {
          ativo: boolean
          categoria_id: string
          custo: number
          criado_em: string
          id: string
          estoque_minimo: number
          nome: string
          preco: number
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          custo?: number
          criado_em?: string
          id?: string
          estoque_minimo?: number
          nome: string
          preco?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          custo?: number
          criado_em?: string
          id?: string
          estoque_minimo?: number
          nome?: string
          preco?: number
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque: {
        Row: {
          produto_id: string
          saldo: number
          atualizado_em: string
        }
        Insert: {
          produto_id: string
          saldo?: number
          atualizado_em?: string
        }
        Update: {
          produto_id?: string
          saldo?: number
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: true
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      entradas_nota: {
        Row: {
          id: string
          fornecedor: string | null
          observacoes: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          fornecedor?: string | null
          observacoes?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          fornecedor?: string | null
          observacoes?: string | null
          criado_em?: string
        }
        Relationships: []
      }
      entradas_nota_item: {
        Row: {
          id: string
          entrada_id: string
          produto_id: string
          quantidade: number
          custo_unitario: number
        }
        Insert: {
          id?: string
          entrada_id: string
          produto_id: string
          quantidade: number
          custo_unitario?: number
        }
        Update: {
          id?: string
          entrada_id?: string
          produto_id?: string
          quantidade?: number
          custo_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_nota_item_entrada_id_fkey"
            columns: ["entrada_id"]
            isOneToOne: false
            referencedRelation: "entradas_nota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_nota_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_venda: {
        Row: {
          id: string
          produto_id: string
          nome_produto: string
          quantidade: number
          venda_id: string
          preco_unitario: number
        }
        Insert: {
          id?: string
          produto_id: string
          nome_produto: string
          quantidade?: number
          venda_id: string
          preco_unitario?: number
        }
        Update: {
          id?: string
          produto_id?: string
          nome_produto?: string
          quantidade?: number
          venda_id?: string
          preco_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_venda_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_venda_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          id: string
          nome: string
          telefone: string | null
          endereco: string | null
          complemento: string | null
          saldo_devedor: number | null
          criado_em: string
        }
        Insert: {
          id?: string
          nome: string
          telefone?: string | null
          endereco?: string | null
          complemento?: string | null
          saldo_devedor?: number | null
          criado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          telefone?: string | null
          endereco?: string | null
          complemento?: string | null
          saldo_devedor?: number | null
          criado_em?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          criado_em: string
          nome_cliente: string | null
          cliente_id: string | null
          id: string
          observacoes: string | null
          forma_pagamento_id: string
          situacao: string
          total: number
        }
        Insert: {
          criado_em?: string
          nome_cliente?: string | null
          cliente_id?: string | null
          id?: string
          observacoes?: string | null
          forma_pagamento_id: string
          situacao?: string
          total?: number
        }
        Update: {
          criado_em?: string
          nome_cliente?: string | null
          cliente_id?: string | null
          id?: string
          observacoes?: string | null
          forma_pagamento_id?: string
          situacao?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      formas_pagamento: {
        Row: {
          id: string
          nome: string
        }
        Insert: {
          id?: string
          nome: string
        }
        Update: {
          id?: string
          nome?: string
        }
        Relationships: []
      }
      entregas: {
        Row: {
          id: string
          venda_id: string
          endereco: string | null
          telefone: string | null
          taxa: number | null
          criado_em: string
        }
        Insert: {
          id?: string
          venda_id: string
          endereco?: string | null
          telefone?: string | null
          taxa?: number | null
          criado_em?: string
        }
        Update: {
          id?: string
          venda_id?: string
          endereco?: string | null
          telefone?: string | null
          taxa?: number | null
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_venda_id_fkey"
            columns: ["venda_id"]
            isOneToOne: false
            referencedRelation: "vendas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          id: string
          nome: string
          email: string
          perfil: string
          ativo: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          nome: string
          email: string
          perfil: string
          ativo?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          perfil?: string
          ativo?: boolean
          criado_em?: string
        }
        Relationships: []
      }
      solicitacoes_senha: {
        Row: {
          id: string
          usuario_id: string | null
          email: string
          status: string
          criado_em: string
        }
        Insert: {
          id?: string
          usuario_id?: string | null
          email: string
          status?: string
          criado_em?: string
        }
        Update: {
          id?: string
          usuario_id?: string | null
          email?: string
          status?: string
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_senha_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
      auditoria: {
        Row: {
          id: string
          usuario_id: string
          usuario_nome: string
          tipo: string
          acao: string
          detalhes: Json
          criado_em: string
        }
        Insert: {
          id?: string
          usuario_id: string
          usuario_nome: string
          tipo: string
          acao: string
          detalhes?: Json
          criado_em?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          usuario_nome?: string
          tipo?: string
          acao?: string
          detalhes?: Json
          criado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
