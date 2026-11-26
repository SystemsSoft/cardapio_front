import type { Adicional, Produto } from './tipos';

/** Adicionais escolhidos que ainda existem no produto (um adicional removido do cardápio some do carrinho). */
export function adicionaisEscolhidos(p: Produto, ids: number[] | undefined): Adicional[] {
  if (!ids?.length) return [];
  return (p.adicionais ?? []).filter((a) => ids.includes(a.id) && a.disponivel !== false);
}

/** Preço de uma unidade do produto com os adicionais escolhidos. */
export function precoComAdicionais(p: Produto, ids: number[] | undefined): number {
  return (p.preco ?? 0) + adicionaisEscolhidos(p, ids).reduce((s, a) => s + a.preco, 0);
}

/** "+ Molho especial, Bacon" (vazio sem adicionais). */
export function textoAdicionais(lista: { nome: string }[] | undefined): string {
  return lista?.length ? `+ ${lista.map((a) => a.nome).join(', ')}` : '';
}

/** Nome do item com os adicionais, para listas resumidas: "X-Burger + Molho especial". */
export function nomeComAdicionais(i: { nome: string; adicionais?: { nome: string }[] }): string {
  return i.adicionais?.length ? `${i.nome} ${textoAdicionais(i.adicionais)}` : i.nome;
}

/** Mesma escolha de adicionais (a ordem não importa): decide se junta no mesmo item do carrinho. */
export function mesmosAdicionais(a: number[] | undefined, b: number[] | undefined): boolean {
  const x = [...(a ?? [])].sort((m, n) => m - n);
  const y = [...(b ?? [])].sort((m, n) => m - n);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}
