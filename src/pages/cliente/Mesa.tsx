import {
  BellRing,
  ChefHat,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Receipt,
  Search,
  Share2,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Contador, ImagemProduto, useAgora } from '../../components/comuns';
import { PainelQrMesa, linkDaMesa } from '../../components/QrMesa';
import { AreaTexto, Aviso, Botao, Carregando, Entrada, Janela, Selo, cx, useAvisos } from '../../components/ui';
import { api, mensagemDe, nomeSalvo } from '../../lib/api';
import { adicionaisEscolhidos, mesmosAdicionais, nomeComAdicionais, precoComAdicionais, textoAdicionais } from '../../lib/adicionais';
import { reais, tempoDesde } from '../../lib/formato';
import { aplicarMarca } from '../../lib/marca';
import { useTempoReal } from '../../lib/tempoReal';
import type { Categoria, EstadoMesa, Pedido, Produto, RestaurantePublico, Sessao } from '../../lib/tipos';

interface ItemCarrinho {
  chave: string;
  produtoId: number;
  quantidade: number;
  observacao: string;
  /** Ids dos adicionais escolhidos (ex.: molho extra). */
  adicionais?: number[];
}

type Aba = 'cardapio' | 'pedidos' | 'conta';

function useCarrinho(chave: string) {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(chave) || '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(chave, JSON.stringify(itens));
    } catch {
      /* sem armazenamento */
    }
  }, [chave, itens]);
  return [itens, setItens] as const;
}

export default function Mesa() {
  const { rid = '', numero = '' } = useParams();
  const [busca] = useSearchParams();
  const token = busca.get('t') || '';
  const { avisar } = useAvisos();

  const [restaurante, setRestaurante] = useState<RestaurantePublico | null>(null);
  const [cardapio, setCardapio] = useState<Categoria[] | null>(null);
  const [estado, setEstado] = useState<EstadoMesa | null>(null);
  const [erro, setErro] = useState<{ status?: number; texto: string } | null>(null);
  const [fechada, setFechada] = useState<Sessao | null>(null);
  const [aba, setAba] = useState<Aba>('cardapio');
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [carrinho, setCarrinho] = useCarrinho(`cardapio:carrinho:${rid}:${numero}`);

  const q = `?t=${encodeURIComponent(token)}`;

  const carregarRestaurante = useCallback(async () => {
    const r = await api.get<RestaurantePublico>(`/cliente/${rid}`);
    setRestaurante(r);
    aplicarMarca(r.marca.cor);
    document.title = `${r.nome} · Mesa ${numero}`;
  }, [rid, numero]);

  const carregarCardapio = useCallback(async () => {
    setCardapio(await api.get<Categoria[]>(`/cliente/${rid}/cardapio`));
  }, [rid]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([carregarRestaurante(), carregarCardapio()]);
        setEstado(await api.get<EstadoMesa>(`/cliente/${rid}/mesas/${numero}${q}`));
      } catch (e) {
        setErro({ status: (e as { status?: number }).status, texto: mensagemDe(e) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid, numero, token]);

  useTempoReal(
    estado ? { evento: 'mesa:entrar', dados: { restauranteId: Number(rid), numero: Number(numero), token } } : null,
    {
      'mesa:estado': (e: EstadoMesa) => setEstado(e),
      'mesa:fechada': (s: Sessao) => {
        setFechada(s);
        setCarrinho([]);
      },
      'cardapio:alterado': () => void carregarCardapio(),
      'restaurante:alterado': () => void carregarRestaurante(),
    },
    (r) => {
      if (r.ok && r.estado) setEstado(r.estado as EstadoMesa);
    },
  );

  const produtos = useMemo(() => {
    const mapa = new Map<number, Produto>();
    cardapio?.forEach((c) => c.produtos.forEach((p) => mapa.set(p.id, p)));
    return mapa;
  }, [cardapio]);

  // Remove do carrinho o que saiu do cardápio, ficou indisponível ou esgotou.
  const carrinhoValido = carrinho.filter((i) => {
    const p = produtos.get(i.produtoId);
    return p && p.disponivel && !p.esgotado && p.preco != null;
  });
  const qtdCarrinho = carrinhoValido.reduce((s, i) => s + i.quantidade, 0);
  const totalCarrinho = carrinhoValido.reduce((s, i) => s + i.quantidade * precoComAdicionais(produtos.get(i.produtoId)!, i.adicionais), 0);

  const adicionar = (produto: Produto, quantidade: number, observacao: string, adicionais: number[]) => {
    setCarrinho((c) => {
      const igual = c.find((i) => i.produtoId === produto.id && i.observacao === observacao && mesmosAdicionais(i.adicionais, adicionais));
      if (igual) return c.map((i) => (i === igual ? { ...i, quantidade: Math.min(99, i.quantidade + quantidade) } : i));
      return [...c, { chave: `${produto.id}-${Date.now()}`, produtoId: produto.id, quantidade, observacao, adicionais }];
    });
    avisar(`${quantidade}× ${produto.nome} no carrinho`);
  };

  if (erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl">{erro.status === 403 ? '🔒' : '😕'}</div>
        <h1 className="text-xl font-bold">{erro.status === 403 ? 'QR Code expirado' : 'Não foi possível abrir a mesa'}</h1>
        <p className="max-w-sm text-stone-600">{erro.texto}</p>
        <Link to="/cliente">
          <Botao variante="secundario">Escanear o QR Code de novo</Botao>
        </Link>
      </div>
    );
  }
  if (!restaurante || !cardapio || !estado) return <Carregando tela texto="Abrindo o cardápio…" />;

  if (fechada) return <ContaFechada sessao={fechada} restaurante={restaurante} aoVoltar={() => setFechada(null)} />;

  const sessao = estado.sessao;
  const pedidosAtivos = sessao?.pedidos.filter((p) => !['entregue', 'cancelado'].includes(p.status)).length ?? 0;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-fundo pb-32">
      <Cabecalho restaurante={restaurante} numero={numero} aoCompartilhar={() => setCompartilhando(true)} />

      <Janela aberta={compartilhando} aoFechar={() => setCompartilhando(false)} titulo="Compartilhar cardápio" largura="max-w-md">
        <PainelQrMesa
          link={linkDaMesa(rid, numero, token)}
          restaurante={restaurante.nome}
          numero={numero}
          instrucao={`Quem está na mesa com você pode ler este código e pedir pelo próprio celular. Tudo vai para a mesma conta da mesa ${numero}.`}
        />
      </Janela>

      {sessao?.status === 'fechamento_solicitado' && (
        <div className="mx-4 mt-4">
          <Aviso tipo="info" titulo="Conta solicitada">
            O garçom já foi avisado e está trazendo a conta.
          </Aviso>
        </div>
      )}

      {aba === 'cardapio' && <ListaCardapio cardapio={cardapio} aoAbrir={setProdutoAberto} />}
      {aba === 'pedidos' && <MeusPedidos sessao={sessao} />}
      {aba === 'conta' && (
        <Conta
          sessao={sessao}
          caminho={`/cliente/${rid}/mesas/${numero}`}
          q={q}
          aoAtualizar={setEstado}
        />
      )}

      {/* Botão do carrinho */}
      {qtdCarrinho > 0 && aba === 'cardapio' && (
        <div className="fixed inset-x-0 bottom-[76px] z-30 mx-auto max-w-2xl px-4">
          <button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-marca px-5 py-3.5 text-white shadow-flutuante shadow-marca/40 transition active:scale-[.99]"
          >
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold">{qtdCarrinho}</span>
            <span className="flex-1 text-left font-semibold">Ver carrinho</span>
            <span className="font-bold">{reais(totalCarrinho)}</span>
          </button>
        </div>
      )}

      <BarraInferior
        aba={aba}
        setAba={setAba}
        pedidosAtivos={pedidosAtivos}
        chamado={!!sessao?.garcomChamadoEm}
        aoChamar={async () => {
          try {
            setEstado(await api.post<EstadoMesa>(`/cliente/${rid}/mesas/${numero}/garcom${q}`));
            avisar('Garçom chamado! Já já alguém vem até você.');
          } catch (e) {
            avisar(mensagemDe(e), 'erro');
          }
        }}
      />

      <FolhaProduto produto={produtoAberto} aoFechar={() => setProdutoAberto(null)} aoAdicionar={adicionar} />

      <Carrinho
        aberto={carrinhoAberto}
        aoFechar={() => setCarrinhoAberto(false)}
        itens={carrinhoValido}
        produtos={produtos}
        setItens={setCarrinho}
        total={totalCarrinho}
        aoEnviar={async (clienteNome, observacao) => {
          const r = await api.post<{ id: number; estado: EstadoMesa }>(`/cliente/${rid}/mesas/${numero}/pedidos${q}`, {
            itens: carrinhoValido.map(({ produtoId, quantidade, observacao, adicionais }) => ({
              produtoId,
              quantidade,
              observacao,
              adicionais: adicionaisEscolhidos(produtos.get(produtoId)!, adicionais).map((a) => a.id),
            })),
            clienteNome,
            observacao,
          });
          setEstado(r.estado);
          setCarrinho([]);
          setCarrinhoAberto(false);
          setAba('pedidos');
          avisar('Pedido enviado para a cozinha! 🎉');
        }}
      />
    </div>
  );
}

function Cabecalho({ restaurante, numero, aoCompartilhar }: { restaurante: RestaurantePublico; numero: string; aoCompartilhar: () => void }) {
  const { marca } = restaurante;
  return (
    <header>
      <div className="relative h-36 overflow-hidden bg-marca sm:h-44">
        {marca.capa ? (
          <img src={marca.capa} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-marca to-marca-escura" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <div className="pt-seguro absolute right-4 top-3 flex items-center gap-2">
          <button
            type="button"
            onClick={aoCompartilhar}
            className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm font-semibold text-stone-900 shadow transition active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar cardápio
          </button>
          <span className="rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-stone-900 shadow">Mesa {numero}</span>
        </div>
      </div>
      {/* Só a logo sobe sobre a capa; nome e frase ficam abaixo dela, sem cobrir a foto. */}
      <div className="relative flex gap-3 px-4">
        <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-fundo bg-white shadow-cartao">
          {marca.logo ? (
            <img src={marca.logo} alt={restaurante.nome} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-marca-clara text-3xl font-extrabold text-marca">
              {restaurante.nome.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 pt-2">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{restaurante.nome}</h1>
          {marca.frase && <p className="truncate text-sm text-stone-600">{marca.frase}</p>}
        </div>
      </div>
    </header>
  );
}

export function ListaCardapio({ cardapio, aoAbrir }: { cardapio: Categoria[]; aoAbrir: (p: Produto) => void }) {
  const [termo, setTermo] = useState('');
  const [ativa, setAtiva] = useState<number | null>(null);
  const secoes = useRef<Record<number, HTMLElement | null>>({});

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return cardapio
      .map((c) => ({
        ...c,
        produtos: c.produtos.filter((p) => !t || p.nome.toLowerCase().includes(t) || p.descricao.toLowerCase().includes(t)),
      }))
      .filter((c) => c.produtos.length);
  }, [cardapio, termo]);

  // Destaca a categoria visível ao rolar.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        const v = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (v) setAtiva(Number((v.target as HTMLElement).dataset.id));
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    Object.values(secoes.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [visiveis]);

  const irPara = (id: number) => {
    const el = secoes.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 112, behavior: 'smooth' });
  };

  if (!cardapio.some((c) => c.produtos.length)) {
    return (
      <div className="px-6 py-20 text-center text-stone-500">
        <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-stone-300" />O cardápio ainda está sendo montado.
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-20 mt-4 bg-fundo/95 pb-2 pt-2 backdrop-blur">
        <div className="relative px-4">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar no cardápio"
            className="campo rounded-full pl-10"
            type="search"
          />
        </div>
        {!termo && (
          <nav className="sem-rolagem mt-2 flex gap-2 overflow-x-auto px-4">
            {visiveis.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => irPara(c.id)}
                className={cx(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
                  ativa === c.id ? 'bg-marca text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200',
                )}
              >
                {c.nome}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="space-y-7 px-4 pt-3">
        {visiveis.map((c) => (
          <section key={c.id} data-id={c.id} ref={(el) => (secoes.current[c.id] = el)}>
            <h2 className="mb-3 text-lg font-bold">{c.nome}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {c.produtos.map((p) => (
                <CartaoProduto key={p.id} produto={p} aoAbrir={() => aoAbrir(p)} />
              ))}
            </div>
          </section>
        ))}
        {!visiveis.length && <p className="py-10 text-center text-stone-500">Nada encontrado para “{termo}”.</p>}
      </div>
    </>
  );
}

function CartaoProduto({ produto: p, aoAbrir }: { produto: Produto; aoAbrir: () => void }) {
  const indisponivel = !p.disponivel || p.esgotado || p.preco == null;
  return (
    <button
      type="button"
      onClick={aoAbrir}
      disabled={indisponivel}
      className={cx('cartao flex w-full gap-3 p-3 text-left transition active:scale-[.99]', indisponivel ? 'opacity-60' : 'hover:border-marca/40')}
    >
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug">{p.nome}</h3>
        {p.descricao && <p className="mt-1 line-clamp-2 text-sm text-stone-500">{p.descricao}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {p.preco != null && <span className="font-bold text-stone-900">{reais(p.preco)}</span>}
          {p.esgotado ? (
            <Selo cor="vermelho">Esgotado</Selo>
          ) : !p.disponivel ? (
            <Selo>Indisponível</Selo>
          ) : p.preco == null ? (
            <Selo>Em breve</Selo>
          ) : (
            p.estoqueBaixo && <Selo cor="amarelo">Últimas unidades</Selo>
          )}
        </div>
      </div>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl">
        <ImagemProduto imagem={p.imagem} nome={p.nome} className="h-full w-full text-[1rem]" />
        {!indisponivel && (
          <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-marca shadow">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  );
}

export function FolhaProduto({
  produto,
  aoFechar,
  aoAdicionar,
}: {
  produto: Produto | null;
  aoFechar: () => void;
  aoAdicionar: (p: Produto, qtd: number, obs: string, adicionais: number[]) => void;
}) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');
  const [escolhidos, setEscolhidos] = useState<number[]>([]);
  useEffect(() => {
    setQtd(1);
    setObs('');
    setEscolhidos([]);
  }, [produto?.id]);
  if (!produto) return null;
  const unitario = precoComAdicionais(produto, escolhidos);
  const limite = produto.controlaEstoque && produto.estoque != null ? Math.min(99, produto.estoque) : 99;
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      rodape={
        <div className="flex items-center gap-3">
          <Contador valor={qtd} aoMudar={setQtd} max={limite} />
          <Botao
            tamanho="g"
            largo
            onClick={() => {
              aoAdicionar(produto, qtd, obs.trim(), escolhidos);
              aoFechar();
            }}
          >
            Adicionar · {reais(unitario * qtd)}
          </Botao>
        </div>
      }
    >
      <div className="-mx-5 -mt-4 mb-4 aspect-[16/10] overflow-hidden">
        <ImagemProduto imagem={produto.imagem} nome={produto.nome} className="h-full w-full text-[2.5rem]" />
      </div>
      <h2 className="text-xl font-bold">{produto.nome}</h2>
      {produto.descricao && <p className="mt-1.5 text-stone-600">{produto.descricao}</p>}
      <p className="mt-3 text-lg font-bold">{reais(produto.preco)}</p>
      {produto.estoqueBaixo && <p className="mt-1 text-sm font-medium text-amber-700">Restam só {produto.estoque} unidades.</p>}
      {!!produto.adicionais?.length && (
        <fieldset className="mt-5">
          <legend className="rotulo">Adicionais</legend>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
            {produto.adicionais.map((a) => {
              const marcado = escolhidos.includes(a.id);
              return (
                <label key={a.id} className={cx('flex cursor-pointer items-center gap-3 px-3.5 py-3 transition', marcado ? 'bg-marca-clara' : 'hover:bg-stone-50')}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[rgb(var(--marca))]"
                    checked={marcado}
                    onChange={(e) => setEscolhidos((l) => (e.target.checked ? [...l, a.id] : l.filter((x) => x !== a.id)))}
                  />
                  <span className="min-w-0 flex-1 font-medium">{a.nome}</span>
                  <span className={cx('shrink-0 text-sm font-semibold', a.preco ? 'text-stone-700' : 'text-emerald-700')}>{a.preco ? `+ ${reais(a.preco)}` : 'grátis'}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <label className="mt-5 block">
        <span className="rotulo">Alguma observação?</span>
        <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Ex.: sem cebola, ponto da carne…" rows={2} />
      </label>
    </Janela>
  );
}

function Carrinho({
  aberto,
  aoFechar,
  itens,
  produtos,
  setItens,
  total,
  aoEnviar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  itens: ItemCarrinho[];
  produtos: Map<number, Produto>;
  setItens: (f: (i: ItemCarrinho[]) => ItemCarrinho[]) => void;
  total: number;
  aoEnviar: (nome: string, obs: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(() => nomeSalvo.ler() || '');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroNome, setErroNome] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const campoNome = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) setConfirmando(false);
  }, [aberto]);

  const mudar = (chave: string, quantidade: number) =>
    setItens((lista) => (quantidade <= 0 ? lista.filter((i) => i.chave !== chave) : lista.map((i) => (i.chave === chave ? { ...i, quantidade } : i))));

  const pedirConfirmacao = () => {
    setErro('');
    if (!nome.trim()) {
      setErroNome(true);
      campoNome.current?.focus();
      return;
    }
    setConfirmando(true);
  };

  const enviar = async () => {
    setEnviando(true);
    setErro('');
    try {
      nomeSalvo.salvar(nome.trim());
      await aoEnviar(nome.trim(), obs.trim());
      setObs('');
    } catch (e) {
      setErro(mensagemDe(e));
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Janela
      aberta={aberto}
      aoFechar={aoFechar}
      titulo="Seu pedido"
      rodape={
        confirmando ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-stone-600">
              O pedido vai para a cozinha em nome de <b className="text-base text-stone-900">{nome.trim()}</b>. Está certo?
            </p>
            <div className="flex gap-2">
              <Botao
                variante="secundario"
                tamanho="g"
                disabled={enviando}
                onClick={() => {
                  setConfirmando(false);
                  setTimeout(() => campoNome.current?.select(), 50);
                }}
              >
                Alterar nome
              </Botao>
              <Botao tamanho="g" largo className="flex-1" carregando={enviando} onClick={enviar}>
                Confirmar e enviar
              </Botao>
            </div>
          </div>
        ) : (
          <Botao tamanho="g" largo disabled={!itens.length} onClick={pedirConfirmacao}>
            Enviar pedido · {reais(total)}
          </Botao>
        )
      }
    >
      {!itens.length ? (
        <p className="py-8 text-center text-stone-500">Seu carrinho está vazio.</p>
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
          <span className="rotulo">Seu nome</span>
          <Entrada
            ref={campoNome}
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              setErroNome(false);
              setConfirmando(false);
            }}
            maxLength={40}
            autoComplete="given-name"
            placeholder="Para o garçom saber de quem é o pedido"
            className={cx(erroNome && 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200')}
          />
          {erroNome && <span className="mt-1 block text-xs font-medium text-red-600">Informe seu nome para enviar o pedido.</span>}
        </label>
        <label className="block">
          <span className="rotulo">Observação do pedido</span>
          <AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: trazer tudo junto" />
        </label>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

const PASSOS: { status: Pedido['status']; rotulo: string; icone: typeof Clock }[] = [
  { status: 'recebido', rotulo: 'Recebido', icone: Clock },
  { status: 'preparando', rotulo: 'Preparando', icone: ChefHat },
  { status: 'pronto', rotulo: 'Pronto', icone: BellRing },
  { status: 'entregue', rotulo: 'Entregue', icone: CheckCircle2 },
];

function MeusPedidos({ sessao }: { sessao: Sessao | null }) {
  const agora = useAgora();
  const pedidos = [...(sessao?.pedidos ?? [])].reverse();
  if (!pedidos.length) {
    return (
      <div className="px-6 py-20 text-center text-stone-500">
        <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-stone-300" />
        Você ainda não fez nenhum pedido nesta mesa.
      </div>
    );
  }
  return (
    <div className="space-y-3 px-4 pt-5">
      <h2 className="text-lg font-bold">Pedidos da mesa</h2>
      {pedidos.map((p) => {
        const indice = PASSOS.findIndex((x) => x.status === p.status);
        return (
          <article key={p.id} className="cartao p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">
                Pedido #{p.id}
                {p.clienteNome && <span className="font-normal text-stone-500"> · {p.clienteNome}</span>}
              </p>
              <span className="text-xs text-stone-500">{tempoDesde(p.criadoEm, agora)}</span>
            </div>
            {p.status === 'cancelado' ? (
              <Selo cor="vermelho" className="mt-2">
                Cancelado
              </Selo>
            ) : (
              <ol className="mt-3 grid grid-cols-4 gap-1">
                {PASSOS.map((passo, i) => {
                  const feito = i <= indice;
                  const Icone = passo.icone;
                  return (
                    <li key={passo.status} className="flex flex-col items-center gap-1 text-center">
                      <span
                        className={cx(
                          'flex h-9 w-9 items-center justify-center rounded-full transition',
                          feito ? 'bg-marca text-white' : 'bg-stone-100 text-stone-400',
                          i === indice && p.status !== 'entregue' && 'animate-pulsar',
                        )}
                      >
                        <Icone className="h-4 w-4" />
                      </span>
                      <span className={cx('text-[11px] font-medium', feito ? 'text-stone-900' : 'text-stone-400')}>{passo.rotulo}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
              {p.itens.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span>
                    <b>{i.quantidade}×</b> {i.nome}
                    {!!i.adicionais?.length && <span className="block text-xs font-medium text-stone-600">{textoAdicionais(i.adicionais)}</span>}
                    {i.observacao && <span className="block text-xs text-stone-500">“{i.observacao}”</span>}
                  </span>
                  <span className="shrink-0 text-stone-600">{reais(i.total)}</span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function Conta({
  sessao,
  caminho,
  q,
  aoAtualizar,
}: {
  sessao: Sessao | null;
  caminho: string;
  q: string;
  aoAtualizar: (e: EstadoMesa) => void;
}) {
  const { avisar, confirmar } = useAvisos();
  const [ocupado, setOcupado] = useState(false);
  if (!sessao || !sessao.pedidos.length) {
    return (
      <div className="px-6 py-20 text-center text-stone-500">
        <Receipt className="mx-auto mb-3 h-10 w-10 text-stone-300" />A conta aparece aqui depois do primeiro pedido.
      </div>
    );
  }
  const itens = new Map<string, { nome: string; quantidade: number; total: number }>();
  sessao.pedidos
    .filter((p) => p.status !== 'cancelado')
    .forEach((p) =>
      p.itens.forEach((i) => {
        const nome = nomeComAdicionais(i);
        const k = `${nome}|${i.precoUnitario + (i.precoAdicionais ?? 0)}`;
        const atual = itens.get(k) ?? { nome, quantidade: 0, total: 0 };
        itens.set(k, { ...atual, quantidade: atual.quantidade + i.quantidade, total: atual.total + i.total });
      }),
    );
  const solicitada = sessao.status === 'fechamento_solicitado';

  const agir = async (metodo: 'post' | 'del') => {
    setOcupado(true);
    try {
      const r = await (metodo === 'post' ? api.post<EstadoMesa>(`${caminho}/fechamento${q}`) : api.del<EstadoMesa>(`${caminho}/fechamento${q}`));
      aoAtualizar(r);
      avisar(metodo === 'post' ? 'Pronto! O garçom está trazendo a conta.' : 'Pedido da conta cancelado.');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="px-4 pt-5">
      <div className="cartao overflow-hidden">
        <div className="border-b border-dashed border-stone-200 bg-stone-50 px-5 py-4">
          <p className="text-sm text-stone-500">Conta da mesa {sessao.mesa}</p>
          <p className="text-3xl font-extrabold tracking-tight">{reais(sessao.total)}</p>
        </div>
        <ul className="space-y-1.5 px-5 py-4 text-sm">
          {[...itens.values()].map((i) => (
            <li key={i.nome + i.total} className="flex justify-between gap-2">
              <span>
                {i.quantidade}× {i.nome}
              </span>
              <span className="text-stone-600">{reais(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-stone-100 px-5 py-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Subtotal</dt>
            <dd>{reais(sessao.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-500">Taxa de serviço ({sessao.taxaServicoPercentual}%)</dt>
            <dd>{reais(sessao.taxaServico)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <dt>Total</dt>
            <dd>{reais(sessao.total)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4">
        {solicitada ? (
          <Botao variante="secundario" largo tamanho="g" carregando={ocupado} onClick={() => agir('del')} icone={<X className="h-4 w-4" />}>
            Cancelar pedido da conta
          </Botao>
        ) : (
          <Botao
            largo
            tamanho="g"
            carregando={ocupado}
            icone={<Receipt className="h-5 w-5" />}
            onClick={async () => {
              if (await confirmar({ titulo: 'Pedir a conta?', texto: `Total de ${reais(sessao.total)}. O garçom vai até a sua mesa.`, confirmar: 'Pedir a conta' })) agir('post');
            }}
          >
            Pedir a conta
          </Botao>
        )}
        <p className="mt-3 text-center text-xs text-stone-500">O pagamento é feito com o garçom ou no caixa.</p>
      </div>
    </div>
  );
}

function BarraInferior({
  aba,
  setAba,
  pedidosAtivos,
  chamado,
  aoChamar,
}: {
  aba: Aba;
  setAba: (a: Aba) => void;
  pedidosAtivos: number;
  chamado: boolean;
  aoChamar: () => void;
}) {
  const item = (valor: Aba, rotulo: string, Icone: typeof Receipt, contador = 0) => (
    <button
      type="button"
      onClick={() => {
        setAba(valor);
        window.scrollTo({ top: 0 });
      }}
      className={cx('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', aba === valor ? 'text-marca' : 'text-stone-500')}
    >
      <Icone className="h-6 w-6" strokeWidth={aba === valor ? 2.4 : 2} />
      {rotulo}
      {contador > 0 && (
        <span className="absolute right-[calc(50%-20px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-marca px-1 text-[10px] text-white">{contador}</span>
      )}
    </button>
  );
  return (
    <nav className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch">
        {item('cardapio', 'Cardápio', UtensilsCrossed)}
        {item('pedidos', 'Pedidos', ShoppingBag, pedidosAtivos)}
        <button
          type="button"
          onClick={aoChamar}
          className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', chamado ? 'text-emerald-600' : 'text-stone-500')}
        >
          <BellRing className={cx('h-6 w-6', chamado && 'animate-pulsar')} />
          {chamado ? 'Garçom avisado' : 'Chamar garçom'}
        </button>
        {item('conta', 'Conta', Receipt)}
      </div>
    </nav>
  );
}

function ContaFechada({ sessao, restaurante, aoVoltar }: { sessao: Sessao; restaurante: RestaurantePublico; aoVoltar: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">✓</div>
      <h1 className="text-2xl font-extrabold">Conta fechada</h1>
      <p className="text-stone-600">
        Total de <b>{reais(sessao.total)}</b>
        {sessao.formaPagamento && <> · {sessao.formaPagamento}</>}
      </p>
      <p className="max-w-xs text-stone-600">
        Obrigado pela visita! <b>{restaurante.nome}</b> agradece. Volte sempre. 💛
      </p>
      <Botao variante="secundario" onClick={aoVoltar}>
        Fazer um novo pedido
      </Botao>
    </div>
  );
}
