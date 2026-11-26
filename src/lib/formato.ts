const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function reais(centavos: number | null | undefined): string {
  return moeda.format((centavos ?? 0) / 100);
}

/** "12,50" ou "12.5" → 1250 centavos. Vazio → null. */
export function centavosDoTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, '').trim();
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const valor = Number(normal);
  return Number.isFinite(valor) ? Math.round(valor * 100) : null;
}

export function textoDosCentavos(centavos: number | null | undefined): string {
  return centavos == null ? '' : (centavos / 100).toFixed(2).replace('.', ',');
}

export function dataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function data(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function tempoDesde(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return '';
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

export function minutosDesde(iso: string | null | undefined): number {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0;
}

/** Data local "AAAA-MM-DD" (para <input type="date">). */
export function hojeLocal(deslocamentoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Início ou fim do dia local, em ISO/UTC (o backend compara em UTC). */
export function limiteDoDia(dia: string, fim = false): string {
  const [a, m, d] = dia.split('-').map(Number);
  const dt = fim ? new Date(a, m - 1, d, 23, 59, 59, 999) : new Date(a, m - 1, d, 0, 0, 0, 0);
  return dt.toISOString();
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export function cpfValido(v: string): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function telefone(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function cpfOuCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formas de pagamento — os nomes batem com os códigos da NFC-e no backend. */
export const FORMAS_PAGAMENTO = [
  'Pix',
  'Cartão de crédito',
  'Cartão de débito',
  'Dinheiro',
  'Vale-refeição',
  'Vale-alimentação',
  'Outros',
] as const;

export const ROTULO_STATUS: Record<string, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
