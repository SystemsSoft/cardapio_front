import { ArrowLeft, Bike, CheckCircle2, ChefHat, Clock, LocateFixed, MapPin, Minus, Phone, Plus, Trash2, XCircle } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImagemProduto, useAgora } from '../../components/comuns';
import { AreaTexto, Aviso, Botao, Carregando, Entrada, Janela, cx, useAvisos } from '../../components/ui';
import { adicionaisEscolhidos, mesmosAdicionais, precoComAdicionais, textoAdicionais } from '../../lib/adicionais';
import { api, mensagemDe } from '../../lib/api';
import { centavosDoTexto, reais, telefone, tempoDesde } from '../../lib/formato';
import { enderecoDaPosicao, obterPosicao } from '../../lib/geo';
import { aplicarMarca } from '../../lib/marca';
import type { Categoria, Entrega as PedidoEntrega, Produto, RestaurantePublico, StatusEntrega } from '../../lib/tipos';
import { FolhaProduto, ListaCardapio } from '../cliente/Mesa';

const Mapa = lazy(() => import('../../components/Mapa'));

type Info = RestaurantePublico & { ativas: boolean; taxaEntrega: number; formasPagamento: string[]; liberado: boolean };
interface Item {
  chave: string;
  produtoId: number;
  quantidade: number;
  observacao: string;
  adicionais: number[];
}
interface Dados {
  nome: string;
  telefone: string;
  endereco: string;
  complemento: string;
  bairro: string;
  referencia: string;
  latitude?: number | null;
  longitude?: number | null;
}

function guardado<T>(chave: string, inicial: T) {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : inicial;
  } catch {
    return inicial;
  }
}
function guardar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* navegador sem armazenamento: segue sem lembrar */
  }
}

function Cabecalho({ info }: { info: Info }) {
  const { marca } = info;
  return (
    <header>
      <div className="relative h-36 overflow-hidden bg-marca sm:h-44">
        {marca.capa ? <img src={marca.capa} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-marca to-marca-escura" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        <span className="pt-seguro absolute right-4 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-stone-900 shadow">
          <Bike className="h-4 w-4" /> Entrega
        </span>
      </div>
      <div className="relative flex gap-3 px-4">
        <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-fundo bg-white shadow-cartao">
          {marca.logo ? (
            <img src={marca.logo} alt={info.nome} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-marca-clara text-3xl font-extrabold text-marca">{info.nome.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        <div className="min-w-0 pt-2">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{info.nome}</h1>
          <p className="truncate text-sm text-stone-600">{info.taxaEntrega ? `Taxa de entrega ${reais(info.taxaEntrega)}` : 'Entrega grátis'}</p>
        </div>
      </div>
    </header>
  );
}

/** Delivery: cardápio + carrinho + dados de entrega. Endereço: /entrega/:rid (link e QR Code de entrega). */
export default function Entrega() {
  const { rid = '' } = useParams();
  const navegar = useNavigate();
  const { avisar } = useAvisos();
  const [info, setInfo] = useState<Info | null>(null);
  const [cardapio, setCardapio] = useState<Categoria[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<Produto | null>(null);
  const [itens, setItens] = useState<Item[]>(() => guardado(`entrega:${rid}:carrinho`, []));
  const [finalizar, setFinalizar] = useState(false);
  const ultimo = guardado<string | null>(`entrega:${rid}:ultimo`, null);

  const carregar = useCallback(() => {
    api
      .get<Info>(`/entrega/${rid}`)
      .then((i) => {
        setInfo(i);
        aplicarMarca(i.marca.cor);
        document.title = `${i.nome} · Entrega`;
      })
      .catch((e) => setErro(mensagemDe(e)));
    api.get<Categoria[]>(`/cliente/${rid}/cardapio`).then(setCardapio).catch((e) => setErro(mensagemDe(e)));
  }, [rid]);
  useEffect(() => carregar(), [carregar]);
  useEffect(() => guardar(`entrega:${rid}:carrinho`, itens), [rid, itens]);

  const produtos = useMemo(() => new Map((cardapio ?? []).flatMap((c) => c.produtos).map((p) => [p.id, p])), [cardapio]);
  const validos = itens.filter((i) => {
    const p = produtos.get(i.produtoId);
    return p && p.disponivel && !p.esgotado && p.preco != null;
  });
  const qtd = validos.reduce((s, i) => s + i.quantidade, 0);
  const subtotal = validos.reduce((s, i) => s + precoComAdicionais(produtos.get(i.produtoId)!, i.adicionais) * i.quantidade, 0);

  const adicionar = (p: Produto, quantidade: number, observacao: string, adicionais: number[]) => {
    setItens((l) => {
      const igual = l.find((i) => i.produtoId === p.id && i.observacao === observacao && mesmosAdicionais(i.adicionais, adicionais));
      if (igual) return l.map((i) => (i === igual ? { ...i, quantidade: Math.min(99, i.quantidade + quantidade) } : i));
      return [...l, { chave: `${p.id}-${Date.now()}`, produtoId: p.id, quantidade, observacao, adicionais }];
    });
    avisar(`${quantidade}× ${p.nome} no pedido`);
  };

  if (erro)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">😕</div>
        <h1 className="text-xl font-bold">Não foi possível abrir o cardápio</h1>
        <p className="max-w-sm text-stone-600">{erro}</p>
      </div>
    );
  if (!info || !cardapio) return <Carregando tela />;
  const fechado = !info.ativas || !info.liberado;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-28">
      <Cabecalho info={info} />
      <div className="space-y-3 px-4 pt-4">
        {fechado && (
          <Aviso tipo="alerta" titulo="Não estamos recebendo pedidos de entrega agora">
            Dá para ver o cardápio, mas os pedidos estão pausados. {info.telefone && `Fale com a gente: ${info.telefone}.`}
          </Aviso>
        )}
        {ultimo && (
          <Link to={`/entrega/${rid}/pedido/${ultimo}`} className="cartao flex items-center gap-3 px-4 py-3 text-sm font-semibold">
            <Clock className="h-5 w-5 text-marca" />
            <span className="flex-1">Acompanhar o seu último pedido</span>
            <span className="text-marca">Ver</span>
          </Link>
        )}
      </div>
      <ListaCardapio cardapio={cardapio} aoAbrir={(p) => (fechado ? avisar('Os pedidos de entrega estão pausados agora.', 'info') : setAberto(p))} />
      <FolhaProduto produto={aberto} aoFechar={() => setAberto(null)} aoAdicionar={adicionar} />

      {qtd > 0 && !fechado && (
        <div className="pb-seguro fixed inset-x-0 bottom-4 z-30 mx-auto max-w-2xl px-4">
          <button
            type="button"
            onClick={() => {
              carregar();
              setFinalizar(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl bg-marca px-5 py-3.5 text-white shadow-flutuante shadow-marca/40 transition active:scale-[.99]"
          >
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold">{qtd}</span>
            <span className="flex-1 text-left font-semibold">Finalizar pedido</span>
            <span className="font-bold">{reais(subtotal)}</span>
          </button>
        </div>
      )}

      {finalizar && (
        <Finalizar
          rid={rid}
          info={info}
          itens={validos}
          produtos={produtos}
          setItens={setItens}
          subtotal={subtotal}
          aoFechar={() => setFinalizar(false)}
          aoConcluir={(codigo) => {
            guardar(`entrega:${rid}:ultimo`, codigo);
            // Grava já: a navegação desmonta a página antes do efeito que salva o carrinho rodar.
            guardar(`entrega:${rid}:carrinho`, []);
            setItens([]);
            navegar(`/entrega/${rid}/pedido/${codigo}`);
          }}
        />
      )}
    </div>
  );
}

function Finalizar({
  rid,
  info,
  itens,
  produtos,
  setItens,
  subtotal,
  aoFechar,
  aoConcluir,
}: {
  rid: string;
  info: Info;
  itens: Item[];
  produtos: Map<number, Produto>;
  setItens: (f: (i: Item[]) => Item[]) => void;
  subtotal: number;
  aoFechar: () => void;
  aoConcluir: (codigo: string) => void;
}) {
  const [d, setD] = useState<Dados>(() => guardado(`entrega:dados`, { nome: '', telefone: '', endereco: '', complemento: '', bairro: '', referencia: '' }));
  const [forma, setForma] = useState('');
  const [troco, setTroco] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const total = subtotal + info.taxaEntrega;
  const mudar = (campo: keyof Dados, v: string) => setD((x) => ({ ...x, [campo]: v }));
  const [localizando, setLocalizando] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<{ texto: string; erro?: boolean } | null>(null);
  const temLocal = d.latitude != null && d.longitude != null;

  const usarLocalizacao = async () => {
    setAvisoLocal(null);
    setLocalizando(true);
    try {
      const p = await obterPosicao();
      setD((x) => ({ ...x, latitude: p.latitude, longitude: p.longitude }));
      const achado = await enderecoDaPosicao(p.latitude, p.longitude);
      if (achado?.rua) {
        setD((x) => ({ ...x, endereco: achado.numero ? `${achado.rua}, ${achado.numero}` : `${achado.rua}, `, bairro: achado.bairro || x.bairro }));
      }
      const impreciso = p.precisao != null && p.precisao > 80;
      setAvisoLocal({
        texto: !achado?.rua
          ? 'Localização marcada no mapa. Preencha a rua e o número abaixo.'
          : !achado.numero
            ? 'Endereço preenchido pela localização. Confira e complete o número da casa.'
            : impreciso
              ? `Localização aproximada (cerca de ${Math.round(p.precisao!)} m). Confira o endereço e ajuste o pino no mapa.`
              : 'Endereço preenchido pela localização. Confira se está certo.',
      });
    } catch (e) {
      setAvisoLocal({ texto: e instanceof Error ? e.message : 'Não foi possível achar a sua localização.', erro: true });
    } finally {
      setLocalizando(false);
    }
  };
  const mudarQtd = (chave: string, q: number) => setItens((l) => (q <= 0 ? l.filter((i) => i.chave !== chave) : l.map((i) => (i.chave === chave ? { ...i, quantidade: q } : i))));

  const enviar = async () => {
    setErro('');
    if (!itens.length) return setErro('O pedido está vazio.');
    if (d.nome.trim().length < 2) return setErro('Informe o seu nome.');
    if (d.telefone.replace(/\D/g, '').length < 10) return setErro('Informe o telefone com DDD.');
    if (d.endereco.trim().length < 5) return setErro('Informe o endereço (rua e número).');
    if (!forma) return setErro('Escolha a forma de pagamento.');
    const trocoPara = forma === 'Dinheiro' && troco.trim() ? centavosDoTexto(troco) : null;
    if (forma === 'Dinheiro' && troco.trim() && (trocoPara == null || trocoPara < total)) return setErro('O troco precisa ser para um valor maior que o total.');
    setEnviando(true);
    try {
      guardar('entrega:dados', d);
      const r = await api.post<{ codigo: string }>(`/entrega/${rid}/pedidos`, {
        ...d,
        latitude: temLocal ? d.latitude : null,
        longitude: temLocal ? d.longitude : null,
        formaPagamento: forma,
        trocoPara,
        observacao: obs,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          observacao: i.observacao,
          adicionais: adicionaisEscolhidos(produtos.get(i.produtoId)!, i.adicionais).map((a) => a.id),
        })),
      });
      aoConcluir(r.codigo);
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Finalizar pedido"
      cheiaNoCelular
      rodape={
        <Botao tamanho="g" largo carregando={enviando} disabled={!itens.length} onClick={enviar}>
          Fazer pedido · {reais(total)}
        </Botao>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Seu pedido</h3>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
            {itens.map((i) => {
              const p = produtos.get(i.produtoId)!;
              const ad = adicionaisEscolhidos(p, i.adicionais);
              return (
                <li key={i.chave} className="flex items-center gap-3 px-3 py-2.5">
                  <ImagemProduto imagem={p.imagem} nome={p.nome} className="h-12 w-12 shrink-0 rounded-xl text-[0.8rem]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{p.nome}</p>
                    {ad.length > 0 && <p className="text-xs font-medium text-stone-600">{textoAdicionais(ad)}</p>}
                    {i.observacao && <p className="truncate text-xs text-stone-500">“{i.observacao}”</p>}
                    <p className="text-sm font-semibold text-stone-700">{reais(precoComAdicionais(p, i.adicionais) * i.quantidade)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => mudarQtd(i.chave, i.quantidade - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100" aria-label="Diminuir">
                      {i.quantidade === 1 ? <Trash2 className="h-4 w-4 text-red-600" /> : <Minus className="h-4 w-4" />}
                    </button>
                    <span className="w-6 text-center font-bold tabular-nums">{i.quantidade}</span>
                    <button type="button" onClick={() => mudarQtd(i.chave, Math.min(99, i.quantidade + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100" aria-label="Aumentar">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="mt-2 space-y-1 px-1 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd>{reais(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Entrega</dt><dd>{info.taxaEntrega ? reais(info.taxaEntrega) : 'grátis'}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{reais(total)}</dd></div>
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500">Dados da entrega</h3>
          <label className="block"><span className="rotulo">Seu nome</span><Entrada id="ent-nome" value={d.nome} onChange={(e) => mudar('nome', e.target.value)} maxLength={60} autoComplete="name" /></label>
          <label className="block">
            <span className="rotulo">Telefone (WhatsApp)</span>
            <Entrada id="ent-telefone" value={d.telefone} onChange={(e) => mudar('telefone', telefone(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(21) 99999-0000" />
          </label>
          <div className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
            {temLocal ? (
              <>
                <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-stone-200" />}>
                  <Mapa latitude={d.latitude!} longitude={d.longitude!} editavel className="h-52" aoMudar={(lat, lng) => setD((x) => ({ ...x, latitude: lat, longitude: lng }))} />
                </Suspense>
                <p className="text-xs text-stone-600">Se o pino não estiver na sua porta, arraste-o ou toque no lugar certo do mapa.</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                  <button type="button" className="text-marca disabled:opacity-50" disabled={localizando} onClick={usarLocalizacao}>
                    {localizando ? 'Localizando…' : 'Localizar de novo'}
                  </button>
                  <button type="button" className="text-stone-500" onClick={() => { setD((x) => ({ ...x, latitude: null, longitude: null })); setAvisoLocal(null); }}>
                    Remover localização
                  </button>
                </div>
              </>
            ) : (
              <>
                <Botao variante="secundario" largo carregando={localizando} icone={<LocateFixed className="h-4 w-4" />} onClick={usarLocalizacao}>
                  Usar minha localização
                </Botao>
                <p className="text-center text-xs text-stone-500">Preenche o endereço e mostra ao restaurante onde entregar.</p>
              </>
            )}
            {avisoLocal && <p className={cx('text-sm', avisoLocal.erro ? 'text-red-700' : 'text-emerald-800')}>{avisoLocal.texto}</p>}
          </div>
          <label className="block"><span className="rotulo">Endereço (rua e número)</span><Entrada id="ent-endereco" value={d.endereco} onChange={(e) => mudar('endereco', e.target.value)} maxLength={120} autoComplete="street-address" placeholder="Rua das Flores, 120" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="rotulo">Complemento</span><Entrada id="ent-complemento" value={d.complemento} onChange={(e) => mudar('complemento', e.target.value)} maxLength={60} placeholder="Apto, bloco…" /></label>
            <label className="block"><span className="rotulo">Bairro</span><Entrada id="ent-bairro" value={d.bairro} onChange={(e) => mudar('bairro', e.target.value)} maxLength={60} /></label>
          </div>
          <label className="block"><span className="rotulo">Ponto de referência (opcional)</span><Entrada id="ent-referencia" value={d.referencia} onChange={(e) => mudar('referencia', e.target.value)} maxLength={120} /></label>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500">Pagamento na entrega</h3>
          <div className="grid grid-cols-2 gap-2">
            {info.formasPagamento.map((f) => (
              <button key={f} type="button" onClick={() => setForma(f)} className={cx('rounded-xl border px-2 py-2.5 text-sm font-semibold transition', forma === f ? 'border-marca bg-marca-clara text-marca-escura' : 'border-stone-200 hover:bg-stone-50')}>
                {f}
              </button>
            ))}
          </div>
          {forma === 'Dinheiro' && (
            <label className="block"><span className="rotulo">Troco para quanto? (opcional)</span><Entrada id="ent-troco" value={troco} onChange={(e) => setTroco(e.target.value)} inputMode="decimal" placeholder="Ex.: 100,00" /></label>
          )}
          <label className="block"><span className="rotulo">Observação (opcional)</span><AreaTexto value={obs} onChange={(e) => setObs(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: interfone com defeito, ligar ao chegar" /></label>
        </section>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

const PASSOS: { status: StatusEntrega; rotulo: string; icone: typeof Clock }[] = [
  { status: 'recebido', rotulo: 'Recebido', icone: Clock },
  { status: 'preparando', rotulo: 'Preparando', icone: ChefHat },
  { status: 'saiu', rotulo: 'Saiu para entrega', icone: Bike },
  { status: 'entregue', rotulo: 'Entregue', icone: CheckCircle2 },
];
const FRASE: Record<StatusEntrega, string> = {
  recebido: 'Recebemos o seu pedido! Já já ele vai para a cozinha.',
  preparando: 'O seu pedido está sendo preparado.',
  saiu: 'O seu pedido saiu para entrega. Fique de olho!',
  entregue: 'Pedido entregue. Bom apetite! 😋',
  cancelado: 'Este pedido foi cancelado pelo restaurante.',
};

/** Acompanhamento do pedido de entrega (/entrega/:rid/pedido/:codigo). Atualiza sozinho. */
export function AcompanharEntrega() {
  const { rid = '', codigo = '' } = useParams();
  const agora = useAgora(20000);
  const [info, setInfo] = useState<Info | null>(null);
  const [pedido, setPedido] = useState<PedidoEntrega | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get<Info>(`/entrega/${rid}`)
      .then((i) => {
        setInfo(i);
        aplicarMarca(i.marca.cor);
        document.title = `${i.nome} · Seu pedido`;
      })
      .catch(() => {});
    const buscar = () =>
      api
        .get<PedidoEntrega>(`/entrega/${rid}/pedidos/${codigo}`)
        .then(setPedido)
        .catch((e) => setErro(mensagemDe(e)));
    buscar();
    const t = setInterval(buscar, 10000);
    return () => clearInterval(t);
  }, [rid, codigo]);

  if (erro && !pedido)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">🔎</div>
        <h1 className="text-xl font-bold">Pedido não encontrado</h1>
        <p className="max-w-sm text-stone-600">{erro}</p>
        <Link to={`/entrega/${rid}`} className="font-semibold text-marca">Ver o cardápio</Link>
      </div>
    );
  if (!pedido) return <Carregando tela />;
  const indice = PASSOS.findIndex((p) => p.status === pedido.status);
  const cancelado = pedido.status === 'cancelado';

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-16">
      <header className="pt-seguro flex items-center gap-3 py-4">
        <Link to={`/entrega/${rid}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-cartao" aria-label="Voltar ao cardápio">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500">{info?.nome}</p>
          <h1 className="text-lg font-extrabold">Pedido #{pedido.id}</h1>
        </div>
      </header>

      <section className="cartao p-5">
        {cancelado ? (
          <p className="flex items-center gap-2 font-semibold text-red-700"><XCircle className="h-5 w-5" /> {FRASE.cancelado}</p>
        ) : (
          <>
            <p className="text-lg font-bold">{FRASE[pedido.status]}</p>
            <p className="mt-0.5 text-sm text-stone-500">Feito {tempoDesde(pedido.criadoEm, agora)} · atualiza sozinho</p>
            <ol className="mt-5 grid grid-cols-4 gap-1">
              {PASSOS.map((p, k) => {
                const feito = k <= indice;
                return (
                  <li key={p.status} className="flex flex-col items-center gap-1.5 text-center">
                    <span className={cx('flex h-10 w-10 items-center justify-center rounded-full transition', feito ? 'bg-marca text-white' : 'bg-stone-100 text-stone-400', k === indice && 'ring-4 ring-marca/20')}>
                      <p.icone className="h-5 w-5" />
                    </span>
                    <span className={cx('text-[11px] font-semibold leading-tight', feito ? 'text-stone-900' : 'text-stone-400')}>{p.rotulo}</span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>

      <section className="cartao mt-4 p-5 text-sm">
        <h2 className="mb-2 font-bold">Itens</h2>
        <ul className="space-y-1.5">
          {pedido.itens.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span>
                <b>{i.quantidade}×</b> {i.nome}
                {!!i.adicionais?.length && <span className="block text-xs font-medium text-stone-600">{textoAdicionais(i.adicionais)}</span>}
              </span>
              <span className="shrink-0 text-stone-600">{reais(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-stone-100 pt-3">
          <div className="flex justify-between"><dt className="text-stone-500">Entrega</dt><dd>{pedido.taxaEntrega ? reais(pedido.taxaEntrega) : 'grátis'}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd>{reais(pedido.total)}</dd></div>
          <div className="flex justify-between text-stone-600"><dt>Pagamento</dt><dd>{pedido.formaPagamento}{pedido.trocoPara ? ` · troco para ${reais(pedido.trocoPara)}` : ''}</dd></div>
        </dl>
      </section>

      <section className="cartao mt-4 space-y-1.5 p-5 text-sm">
        <h2 className="mb-1 font-bold">Entrega</h2>
        <p className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" /><span className="break-words">{pedido.endereco}{pedido.complemento && ` · ${pedido.complemento}`}{pedido.bairro && ` · ${pedido.bairro}`}</span></p>
        <p className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />{pedido.clienteNome} · {telefone(pedido.telefone)}</p>
        {info?.telefone && <p className="pt-2 text-stone-500">Dúvidas? Fale com o restaurante: <a href={`tel:${info.telefone.replace(/\D/g, '')}`} className="font-semibold text-marca">{info.telefone}</a></p>}
      </section>
    </div>
  );
}
