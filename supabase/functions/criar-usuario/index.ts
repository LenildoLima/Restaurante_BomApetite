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

    const { email, password, nome, perfil, ativo } = await req.json()

    if (!email || !password || !nome || !perfil) {
      throw new Error('Dados incompletos')
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (createError) throw new Error('Erro Auth: ' + createError.message)

    const { error: dbError } = await supabaseAdmin.from('usuarios').insert({
      id: newUser.user.id,
      email: email,
      nome: nome,
      perfil: perfil,
      ativo: ativo ?? true
    })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw new Error('Erro DB: ' + dbError.message)
    }

    return new Response(
      JSON.stringify({ success: true, user: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
