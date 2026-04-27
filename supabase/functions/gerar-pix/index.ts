import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!accessToken) throw new Error('Token não configurado no Supabase (MERCADOPAGO_ACCESS_TOKEN)')

    const { valor, descricao } = await req.json()

    if (!valor || valor <= 0) throw new Error('Valor inválido')

    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString()

    const response = await fetch(
      'https://api.mercadopago.com/v1/payments',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `launchapp-${Date.now()}`
        },
        body: JSON.stringify({
          transaction_amount: Number(valor),
          description: descricao || 'Pedido LaunchApp',
          payment_method_id: 'pix',
          date_of_expiration: expirationDate,
          payer: {
            email: 'cliente@launchapp.com',
            identification: {
              type: 'CPF',
              number: '00000000191'
            }
          }
        })
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Erro Mercado Pago (status):', response.status)
      console.error('Erro Mercado Pago (body):', JSON.stringify(data))
      // Retorna 200 para que o SDK do Supabase não engula o body do erro
      return new Response(
        JSON.stringify({
          success: false,
          error: data.message || data.error || 'Erro ao gerar PIX no Mercado Pago',
          details: data
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: data.id,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        valor: data.transaction_amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Erro inesperado na Edge Function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
