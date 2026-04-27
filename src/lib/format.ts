export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDateTime(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatTime(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getCategoriaBadgeClass(categoria: string): string {
  const map: Record<string, string> = {
    Lanches: "category-badge-lanches",
    Lançamentos: "category-badge-lancamentos",
    Éxodo: "category-badge-exodo",
    Porções: "category-badge-porcoes",
    Sobremesas: "category-badge-sobremesas",
  };
  return map[categoria] || "category-badge-lanches";
}
