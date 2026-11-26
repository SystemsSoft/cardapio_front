import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ImagemProduto } from '../../components/comuns';
import { AreaTexto, Aviso, Botao, Carregando, Entrada, Janela, useAvisos } from '../../components/ui';
import { api, mensagemDe, nomeSalvo } from '../../lib/api';
import { adicionaisEscolhidos, mesmosAdicionais, precoComAdicionais, textoAdicionais } from '../../lib/adicionais';
import { reais } from '../../lib/formato';
import type { Categoria, Produto } from '../../lib/tipos';
import { FolhaProduto, ListaCardapio } from '../cliente/Mesa';

interface Item {
  chave: string;
  produtoId: number;
  quantidade: number;
  observacao: string;
  adicionais: number[];
}

/**
 * Pedido lançado pelo garçom para uma mesa: o mesmo cardápio do cliente (busca, categorias, esgotados,
 * observações), com carrinho próprio. Vai para a cozinha marcado com o nome do garçom.
 */
export default function PedidoGarcom({
  rid,
  q,
  numero,
  aoSair,
  aoEnviar,
}: {
  rid: string;
  q: string;
  numero: number;
  aoSair: () => void;
  aoEnviar: () => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const [cardapio, setCardapio] = useState<Categoria[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<Produto | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [carrinho, setCarrinho] = useState(false);

  const carregar = () =>
    api
      .get<Categoria[]>(`/cliente/${rid}/cardapio`)
      .then(setCardapio)
      .catch((e) => setErro(mensagemDe(e)));
  useEffect(() => {
    carregar();
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  const produtos = useMemo(() => new Map((cardapio ?? []).flatMap((c) => c.produtos).map((p) => [p.id, p])), [cardapio]);
  const validos = itens.filter((i) => produtos.has(i.produtoId));
  const qtd = validos.reduce((s, i) => s + i.quantidade, 0);
  const total = validos.reduce((s, i) => s + precoComAdicionais(produtos.get(i.produtoId)!, i.adicionais) * i.quantidade, 0);

  const adicionar = (p: Produto, quantidade: number, observacao: string, adicionais: number[]) => {
    setItens((lista) => {
      const igual = lista.find((i) => i.produtoId === p.id && i.observacao === observacao && mesmosAdicionais(i.adicionais, adicionais));
      if (igual) return lista.map((i) => (i === igual ? { ...i, quantidade: Math.min(99, i.quantidade + quantidade) } : i));
      return [...lista, { chave: `${p.id}-${Date.now()}`, produtoId: p.id, quantidade, observacao, adicionais }];
    });
    avisar(`${quantidade}× ${p.nome} no pedido da mesa ${numero}.`);
  };

  const sair = async () => {
    if (validos.length && !(await confirmar({ titulo: 'Sair sem enviar?', texto: 'Os itens escolhidos para esta mesa serão descartados.', confirmar: 'Descartar', perigo: true }))) return;
    aoSair();
  };

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-28">
      <header className="pt-seguro bg-marca text-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <button type="button" onClick={sair} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium opacity-80">Novo pedido</p>
            <h1 className="truncate text-lg font-bold">Mesa {numero}</h1>
          </div>
        </div>
      </header>

      {erro ? (
        <div className="p-4">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      ) : !cardapio ? (
        <Carregando />
      ) : (
        <ListaCardapio cardapio={cardapio} aoAbrir={setAberto} />
      )}

      <FolhaProduto produto={aberto} aoFechar={() => setAberto(null)} aoAdicionar={adicionar} />

      {qtd > 0 && (
        <div className="pb-seguro fixed inset-x-0 bottom-4 z-30 mx-auto max-w-2xl px-4">
          <button
            type="button"
            onClick={() => {
              carregar(); // estoque e preços atualizados antes de enviar
              setCarrinho(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl bg-marca px-5 py-3.5 text-white shadow-flutuante shadow-marca/40 transition active:scale-[.99]"
          >
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold">{qtd}</span>
            <span className="flex-1 text-left font-semibold">Revisar pedido da mesa {numero}</span>
            <span className="font-bold">{reais(total)}</span>
          </button>
        </div>
      )}

      <CarrinhoGarcom
        aberto={carrinho}
        numero={numero}
        itens={validos}
        produtos={produtos}
        setItens={setItens}
        total={total}
        aoFechar={() => setCarrinho(false)}
        aoEnviar={async (cliente, observacao) => {
          await api.post(`/garcom/${rid}/mesas/${numero}/pedidos${q}`, {
            itens: validos.map((i) => ({
              produtoId: i.produtoId,
              quantidade: i.quantidade,
              observacao: i.observacao,
              adicionais: adicionaisEscolhidos(produtos.get(i.produtoId)!, i.adicionais).map((a) => a.id),
            })),
            clienteNome: cliente,
            observacao,
            garcom: nomeSalvo.ler() || '',
          });
          avisar(`Pedido da mesa ${numero} enviado para a cozinha.`);
          setItens([]);
          setCarrinho(false);
          aoEnviar();
        }}
      />
    </div>
  );
}

function CarrinhoGarcom({
  aberto,
  numero,
  itens,
  produtos,
  setItens,
  total,
  aoFechar,
  aoEnviar,
}: {
  aberto: boolean;
  numero: number;
  itens: Item[];
  produtos: Map<number, Produto>;
  setItens: (f: (i: Item[]) => Item[]) => void;
  total: number;
  aoFechar: () => void;
  aoEnviar: (cliente: string, observacao: string) => Promise<void>;
}) {
  const [cliente, setCliente] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const mudar = (chave: string, quantidade: number) =>
    setItens((lista) => (quantidade <= 0 ? lista.filter((i) => i.chave !== chave) : lista.map((i) => (i.chave === chave ? { ...i, quantidade } : i))));

  const enviar = async () => {
    setEnviando(true);
    setErro('');
    try {
      await aoEnviar(cliente.trim(), obs.trim());
      setCliente('');
      setObs('');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Janela
      aberta={aberto}
      aoFechar={aoFechar}
      titulo={`Pedido · Mesa ${numero}`}
      rodape={
        <Botao tamanho="g" largo disabled={!itens.length} carregando={enviando} onClick={enviar}>
          Enviar para a cozinha · {reais(total)}
        </Botao>
      }
    >
      {!itens.length ? (
        <p className="py-8 text-center text-stone-500">Nenhum item escolhido.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {itens.map((i) => {
            const p = produtos.get(i.produtoId)!;
            return (
              <li key={i.chave} className="flex items-center gap-3 py-3">
                <ImagemProduto imagem={p.imagem} nome={p.nome} className="h-14 w-14 shrink-0 rounded-xl text-[0.9rem]" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{p.nome}</p>
                  {adicionaisEscolhidos(p, i.adicionais).length > 0 && <p className="text-xs font-medium text-stone-600">{textoAdicionais(adicionaisEscolhidos(p, i.adicionais))}</p>}
                  {i.observacao && <p className="truncate text-xs text-stone-500">“{i.observacao}”</p>}
                  <p className="text-sm font-semibold text-stone-700">{reais(precoComAdicionais(p, i.adicionais) * i.quantidade)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => mudar(i.chave, i.quantidade - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100" aria-label="Diminuir">
                    {i.quantidade === 1 ? <Trash2 className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4" />}
                  </button>
                  <span className="w-6 text-center font-bold tabular-nums">{i.quantidade}</span>
                  <button type="button" onClick={() => mudar(i.chave, Math.min(99, i.quantidade + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100" aria-label="Aumentar">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="rotulo">Nome do cliente (opcional)</span>
          <Entrada value={cliente} onChange={(e) => setCliente(e.target.value)} maxLength={18} placeholder="Para saber de quem é na mesa" />
        </label>
        <label className="block">
          <span className="rotulo">Observação do pedido</span>
          <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: trazer tudo junto" />
        </label>
        <p className="text-xs text-stone-500">O pedido vai para a cozinha em nome do garçom{nomeSalvo.ler() ? ` ${nomeSalvo.ler()}` : ''}.</p>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
