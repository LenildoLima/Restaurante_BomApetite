import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface PedidoOnline {
  id: string;
  criado_em: string;
  nome_cliente: string | null;
  total: number;
  situacao: string;
  observacoes: string | null;
  forma_pagamento_id: string | null;
  formas_pagamento?: { nome: string } | null;
  entregas?: { endereco: string; telefone: string; taxa: number }[];
  itens?: { nome_produto: string; quantidade: number; preco_unitario: number }[];
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Second beep
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.4, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.4);
    }, 300);
  } catch {
    // Web Audio API não disponível
  }
}

function sendPushNotification(clienteNome: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🛒 Novo pedido online!', {
      body: `Cliente: ${clienteNome || 'Não identificado'}`,
      icon: '/favicon.ico',
      tag: 'novo-pedido',
    });
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function useOnlineOrders() {
  const { usuario } = useAuth();
  const [pedidosPendentes, setPedidosPendentes] = useState<PedidoOnline[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPedidosPendentes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('vendas')
      .select(`
        id, criado_em, nome_cliente, total, situacao, observacoes, forma_pagamento_id,
        formas_pagamento(nome),
        entregas(endereco, telefone, taxa)
      `)
      .eq('situacao', 'Aguardando confirmação')
      .order('criado_em', { ascending: true });

    if (data) {
      // Fetch items for each order
      const pedidosComItens = await Promise.all(
        (data as any[]).map(async (v) => {
          const { data: itens } = await supabase
            .from('itens_venda')
            .select('nome_produto, quantidade, preco_unitario')
            .eq('venda_id', v.id);
          return { ...v, itens: itens || [] };
        })
      );
      setPedidosPendentes(pedidosComItens as PedidoOnline[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!usuario) return;

    fetchPedidosPendentes();

    const channelName = `pedidos-online-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vendas',
        },
        (payload) => {
          // Quando houver inserção, sempre atualizamos e tocamos o bip
          // Isso resolve o problema de colunas faltando no payload (Replication Default vs Full)
          playBeep();
          sendPushNotification('Novo pedido recebido');
          fetchPedidosPendentes();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vendas',
        },
        () => {
          fetchPedidosPendentes();
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [usuario, fetchPedidosPendentes]);

  return {
    pedidosPendentes,
    pendingCount: pedidosPendentes.length,
    loading,
    refresh: fetchPedidosPendentes,
  };
}
