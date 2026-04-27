import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { id, nome, perfil, ativo, senha } = await req.json()

    if (!id) throw new Error('ID do usuário é obrigatório')

    // Atualizar senha se fornecida
    if (senha && senha.trim().length >= 6) {
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: senha
      })
      if (updateAuthError) throw new Error(`Erro ao atualizar senha: ${updateAuthError.message}`)
    }

    // Atualizar dados na tabela usuarios (apenas campos fornecidos)
    const updateData: Record<string, unknown> = {}
    if (nome !== undefined) updateData.nome = nome
    if (perfil !== undefined) updateData.perfil = perfil
    if (ativo !== undefined) updateData.ativo = ativo

    if (Object.keys(updateData).length > 0) {
      const { error: dbError } = await supabaseAdmin
        .from('usuarios')
        .update(updateData)
        .eq('id', id)

      if (dbError) throw new Error(`Erro DB: ${dbError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})