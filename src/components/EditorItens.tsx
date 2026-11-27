import { ArrowLeft, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { adicionaisEscolhidos, precoComAdicionais, textoAdicionais } from '../lib/adicionais';
import { api, mensagemDe } from '../lib/api';
import { reais } from '../lib/formato';
import type { Categoria, ItemPedido, Produto } from '../lib/tipos';
import { FolhaProduto } from '../pages/cliente/Mesa';
import { ImagemProduto } from './comuns';
import { Aviso, Carregando, Entrada, cx } from './ui';

/** Uma linha do pedido em edição. Com `id`, é um item que já estava no pedido (preço e adicionais da época). */
export interface LinhaEdicao {
  chave: string;
  id?: number;
  produtoId: number;
  nome: string;
  unitario: number; // preço de uma unidade, já com adicionais
  quantidade: number;
  observacao: string;
  adicionais: number[]; // ids escolhidos (só para itens novos)
  textoAdicionais: string;
}

export const linhasDoPedido = (itens: ItemPedido[]): LinhaEdicao[] =>
  itens.map((i) => ({
    chave: `i${i.id}`,
    id: i.id,
    produtoId: i.produtoId,
    nome: i.nome,
    unitario: i.precoUnitario + (i.precoAdicionais ?? 0),
    quantidade: i.quantidade,
    observacao: i.observacao,
    adicionais: [],
    textoAdicionais: textoAdicionais(i.adicionais),
  }));

export const itensParaEnviar = (linhas: LinhaEdicao[]) =>
  linhas.map((l) => ({ id: l.id, produtoId: l.produtoId, quantidade: l.quantidade, observacao: l.observacao.trim(), adicionais: l.adicionais }));

export const totalDasLinhas = (linhas: LinhaEdicao[]) => linhas.reduce((s, l) => s + l.unitario * l.quantidade, 0);

/** Itens de um pedido para o restaurante corrigir: quantidade, observação, remover e incluir produtos do cardápio. */
export function EditorItens({ rid, linhas, aoMudar }: { rid: number; linhas: LinhaEdicao[]; aoMudar: (l: LinhaEdicao[]) => void }) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [cardapio, setCardapio] = useState<Categoria[] | null>(null);
  const [erro, setErro] = useState('');
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState<Produto | null>(null);

  useEffect(() => {
    if (escolhendo && !cardapio)
      api
        .get<Categoria[]>(`/cliente/${rid}/cardapio`)
        .then(setCardapio)
        .catch((e) => setErro(mensagemDe(e)));
  }, [escolhendo, cardapio, rid]);

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (cardapio ?? [])
      .map((c) => ({ ...c, produtos: c.produtos.filter((p) => p.preco != null && (!t || p.nome.toLowerCase().includes(t))) }))
      .filter((c) => c.produtos.length);
  }, [cardapio, termo]);

  const mudar = (chave: string, campo: Partial<LinhaEdicao>) => aoMudar(linhas.map((l) => (l.chave === chave ? { ...l, ...campo } : l)));
  const remover = (chave: string) => aoMudar(linhas.filter((l) => l.chave !== chave));
  const incluir = (p: Produto, quantidade: number, observacao: string, adicionais: number[]) => {
    aoMudar([
      ...linhas,
      {
        chave: `n${p.id}-${Date.now()}`,
        produtoId: p.id,
        nome: p.nome,
        unitario: precoComAdicionais(p, adicionais),
        quantidade,
        observacao,
        adicionais,
        textoAdicionais: textoAdicionais(adicionaisEscolhidos(p, adicionais)),
      },
    ]);
    setEscolhendo(false);
    setTermo('');
  };

  if (escolhendo)
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setEscolhendo(false)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900">
          <ArrowLeft className="h-4 w-4" /> Voltar aos itens do pedido
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Entrada autoFocus value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar produto" className="pl-9" aria-label="Buscar produto" />
        </div>
        {erro ? (
          <Aviso tipo="erro">{erro}</Aviso>
        ) : !cardapio ? (
          <Carregando />
        ) : !visiveis.length ? (
          <p className="py-6 text-center text-sm text-stone-500">Nenhum produto encontrado.</p>
        ) : (
          visiveis.map((c) => (
            <section key={c.id}>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">{c.nome}</h4>
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
                {c.produtos.map((p) => {
                  const fora = !p.disponivel || p.esgotado;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={fora}
                        onClick={() => setAberto(p)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-stone-50 disabled:opacity-50"
                      >
                        <ImagemProduto imagem={p.imagem} nome={p.nome} className="h-10 w-10 shrink-0 rounded-lg text-[0.7rem]" />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                        <span className="text-sm font-semibold text-stone-700">{fora ? 'esgotado' : reais(p.preco)}</span>
                        {!fora && <Plus className="h-4 w-4 text-marca" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        <FolhaProduto produto={aberto} aoFechar={() => setAberto(null)} aoAdicionar={incluir} />
      </div>
    );

  return (
    <div className="space-y-2">
      {!linhas.length && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">O pedido está sem itens. Adicione um produto ou exclua o pedido.</p>}
      <ul className="space-y-2">
        {linhas.map((l) => (
          <li key={l.chave} className={cx('rounded-xl border bg-white p-3', l.id ? 'border-stone-200' : 'border-emerald-300 ring-1 ring-emerald-100')}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">
                  {l.nome}
                  {!l.id && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">novo</span>}
                </p>
                {l.textoAdicionais && <p className="text-xs font-semibold text-sky-800">{l.textoAdicionais}</p>}
                <p className="text-sm text-stone-600">
                  {reais(l.unitario)} · <span className="font-semibold text-stone-800">{reais(l.unitario * l.quantidade)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => (l.quantidade <= 1 ? remover(l.chave) : mudar(l.chave, { quantidade: l.quantidade - 1 }))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
                  aria-label={l.quantidade <= 1 ? `Remover ${l.nome}` : `Diminuir ${l.nome}`}
                >
                  {l.quantidade <= 1 ? <Trash2 className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4" />}
                </button>
                <span className="w-7 text-center font-bold tabular-nums">{l.quantidade}</span>
                <button
                  type="button"
                  onClick={() => mudar(l.chave, { quantidade: Math.min(99, l.quantidade + 1) })}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200"
                  aria-label={`Aumentar ${l.nome}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
                {l.quantidade > 1 && (
                  <button type="button" onClick={() => remover(l.chave)} className="ml-1 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remover ${l.nome}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Entrada
              value={l.observacao}
              onChange={(e) => mudar(l.chave, { observacao: e.target.value })}
              maxLength={200}
              placeholder="Observação (ex.: sem cebola)"
              aria-label={`Observação de ${l.nome}`}
              className="mt-2 h-9 text-sm"
            />
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setEscolhendo(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-300 py-2.5 text-sm font-semibold text-stone-600 hover:border-marca hover:text-marca"
      >
        <Plus className="h-4 w-4" /> Adicionar produto
      </button>
    </div>
  );
}
