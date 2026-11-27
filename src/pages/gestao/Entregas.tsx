import { BarChart3, Bike, ChefHat, CheckCircle2, CircleDollarSign, Copy, ExternalLink, LocateFixed, Map as IconeMapa, MapPin, MessageCircle, Navigation, Pencil, Phone, Plus, Printer, Radar, Search, Trash2, X } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { QrCode } from '../../components/comuns';
import { Abas, Aviso, Botao, Carregando, Entrada, Interruptor, Janela, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { textoAdicionais } from '../../lib/adicionais';
import { gestao, mensagemDe, urlBaseSalva } from '../../lib/api';
import { centavosDoTexto, reais, telefone, tempoDesde, textoDosCentavos } from '../../lib/formato';
import { CORES_FAIXAS, km, kmFaixa, linkBusca, linkMapa, linkRota, obterPosicao, posicaoDoEndereco } from '../../lib/geo';
import type { ConfigEntregas, Entrega, StatusEntrega } from '../../lib/tipos';
import { useAgora } from '../../components/comuns';
import { useGestao } from './contexto';
import { EditorItens, itensParaEnviar, linhasDoPedido, totalDasLinhas, type LinhaEdicao } from '../../components/EditorItens';

const Mapa = lazy(() => import('../../components/Mapa'));

const COLUNAS: { status: StatusEntrega; titulo: string; cor: string }[] = [
  { status: 'recebido', titulo: 'Novos', cor: 'bg-sky-500' },
  { status: 'preparando', titulo: 'Preparando', cor: 'bg-amber-500' },
  { status: 'saiu', titulo: 'Saiu para entrega', cor: 'bg-violet-500' },
  { status: 'entregue', titulo: 'Entregues', cor: 'bg-emerald-500' },
];

/** Próximo passo de cada status (botão principal do cartão). */
const PROXIMO: Partial<Record<StatusEntrega, { status: StatusEntrega; rotulo: string; icone: typeof Bike }>> = {
  recebido: { status: 'preparando', rotulo: 'Começar preparo', icone: ChefHat },
  preparando: { status: 'saiu', rotulo: 'Saiu para entrega', icone: Bike },
  saiu: { status: 'entregue', rotulo: 'Marcar como entregue', icone: CheckCircle2 },
};

export function linkDeEntrega(rid: string | number) {
  const base = (urlBaseSalva.ler() || window.location.origin).replace(/\/$/, '');
  return `${base}/entrega/${rid}`;
}

/** Área de delivery da gestão: quadro dos pedidos de entrega + link/QR e configuração. */
export default function Entregas() {
  const { restaurante, estado } = useGestao();
  const { avisar, confirmar } = useAvisos();
  const agora = useAgora(30000);
  const [dados, setDados] = useState<{ entregas: Entrega[]; config: ConfigEntregas } | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<StatusEntrega>('recebido');
  const [divulgar, setDivulgar] = useState(false);
  const [relatorio, setRelatorio] = useState(false);

  const carregar = useCallback(
    () =>
      gestao
        .get<{ entregas: Entrega[]; config: ConfigEntregas }>('/entregas')
        .then(setDados)
        .catch((e) => setErro(mensagemDe(e))),
    [],
  );
  // Recarrega a cada aviso em tempo real (o contador entregasNovas do estado muda junto).
  useEffect(() => {
    carregar();
  }, [carregar, estado]);

  if (erro) return <Aviso tipo="erro">{erro}</Aviso>;
  if (!dados || !restaurante) return <Carregando />;
  const { entregas, config } = dados;
  const link = linkDeEntrega(restaurante.id);

  const mudar = async (e: Entrega, status: StatusEntrega) => {
    if (status === 'cancelado' && !(await confirmar({ titulo: `Cancelar o pedido de ${e.clienteNome}?`, texto: 'Os itens voltam para o estoque. O cliente vê o pedido como cancelado.', confirmar: 'Cancelar pedido', perigo: true })))
      return;
    try {
      await gestao.patch(`/entregas/${e.id}`, { status });
      carregar();
    } catch (er) {
      avisar(mensagemDe(er), 'erro');
    }
  };

  const mudarTaxa = async (e: Entrega, cobrar: boolean) => {
    try {
      await gestao.put(`/entregas/${e.id}/taxa`, { cobrar });
      avisar(cobrar ? `Entrega #${e.id}: taxa de entrega cobrada.` : `Entrega #${e.id}: sem taxa de entrega.`);
      carregar();
    } catch (er) {
      avisar(mensagemDe(er), 'erro');
    }
  };

  const por = (s: StatusEntrega) =>
    entregas.filter((e) => e.status === s).sort((a, b) => (s === 'entregue' ? b.atualizadoEm.localeCompare(a.atualizadoEm) : a.criadoEm.localeCompare(b.criadoEm)));
  const cancelados = entregas.filter((e) => e.status === 'cancelado');

  return (
    <>
      <Titulo
        titulo="Entregas"
        subtitulo="Pedidos de delivery feitos pelo link e pelo QR Code de entrega. Atualiza sozinho."
        acoes={
          <div className="flex flex-wrap gap-2">
            <Botao icone={<BarChart3 className="h-4 w-4" />} onClick={() => setRelatorio(true)}>
              Relatório do período
            </Botao>
            <Botao variante="secundario" icone={<ExternalLink className="h-4 w-4" />} onClick={() => setDivulgar(true)}>
              Link e QR Code
            </Botao>
          </div>
        }
      />

      <ConfiguracaoEntregas config={config} aoSalvar={(c) => setDados({ ...dados, config: c })} aoDivulgar={() => setDivulgar(true)} />

      {!entregas.length ? (
        <Vazio icone={<Bike />} titulo="Nenhum pedido de entrega ainda">
          {config.ativas ? 'Divulgue o link ou o QR Code de entrega: os pedidos aparecem aqui na hora, com aviso sonoro.' : 'Ative o recebimento de entregas acima para começar.'}
        </Vazio>
      ) : (
        <>
          <div className="md:hidden">
            <Abas<StatusEntrega> className="mb-4" atual={aba} aoMudar={setAba} abas={COLUNAS.map((c) => ({ valor: c.status, rotulo: c.titulo, contador: por(c.status).length }))} />
            <Coluna entregas={por(aba)} agora={agora} aoMudar={mudar} taxaPadrao={config.modoTaxa === 'distancia' ? Math.max(0, ...config.faixas.map((f) => f.taxa)) : config.taxaEntrega} aoTaxa={mudarTaxa} />
          </div>
          <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
            {COLUNAS.map((c) => {
              const lista = por(c.status);
              return (
                <section key={c.status} className="flex flex-col rounded-2xl bg-stone-100/70 p-3">
                  <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-bold">
                    <span className={cx('h-2.5 w-2.5 rounded-full', c.cor)} />
                    {c.titulo}
                    <span className="ml-auto rounded-full bg-white px-2 text-xs text-stone-600">{lista.length}</span>
                  </h2>
                  <Coluna entregas={lista} agora={agora} aoMudar={mudar} taxaPadrao={config.modoTaxa === 'distancia' ? Math.max(0, ...config.faixas.map((f) => f.taxa)) : config.taxaEntrega} aoTaxa={mudarTaxa} />
                </section>
              );
            })}
          </div>
          {cancelados.length > 0 && <p className="mt-4 text-sm text-stone-500">{cancelados.length} pedido(s) cancelado(s) nas últimas 24 horas.</p>}
        </>
      )}

      {relatorio && <JanelaRelatorio aoFechar={() => setRelatorio(false)} />}
      {divulgar && <JanelaDivulgar link={link} restaurante={restaurante.nome} aoFechar={() => setDivulgar(false)} />}
    </>
  );
}

function resumoTaxa(c: ConfigEntregas) {
  if (c.modoTaxa === 'distancia' && c.faixas.length) {
    const valores = c.faixas.map((f) => f.taxa);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const faixa = min === max ? (min ? reais(min) : 'grátis') : `${min ? reais(min) : 'grátis'} a ${reais(max)}`;
    return `Por distância · ${faixa} · até ${kmFaixa(c.faixas[c.faixas.length - 1].ateKm)}`;
  }
  return c.taxaEntrega ? `${reais(c.taxaEntrega)} para qualquer endereço` : 'Entrega grátis';
}

function ConfiguracaoEntregas({ config, aoSalvar, aoDivulgar }: { config: ConfigEntregas; aoSalvar: (c: ConfigEntregas) => void; aoDivulgar: () => void }) {
  const { avisar } = useAvisos();
  const [taxa, setTaxa] = useState(false);

  const ativar = async (ativas: boolean) => {
    try {
      const c = await gestao.put<ConfigEntregas>('/entregas/config', { ativas, taxaEntrega: config.taxaEntrega });
      aoSalvar(c);
      avisar(c.ativas ? 'Entregas ativas: o link de delivery já recebe pedidos.' : 'Entregas pausadas: o link avisa que não está recebendo pedidos.');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  return (
    <section className="cartao mb-5 flex flex-col gap-4 p-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Interruptor ligado={config.ativas} rotulo="Receber pedidos de entrega" aoMudar={(v) => ativar(v)} />
        <div className="min-w-0">
          <p className="font-semibold">{config.ativas ? 'Recebendo pedidos de entrega' : 'Entregas pausadas'}</p>
          <p className="text-xs text-stone-500">{config.ativas ? 'O link e o QR Code de entrega estão aceitando pedidos.' : 'Quem abrir o link vê que o restaurante não está entregando agora.'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Taxa de entrega</p>
          <p className="text-sm font-semibold text-stone-800">{resumoTaxa(config)}</p>
        </div>
        <Botao variante="secundario" icone={<Radar className="h-4 w-4" />} onClick={() => setTaxa(true)}>
          {config.modoTaxa === 'distancia' ? 'Ajustar taxa' : 'Taxa por distância'}
        </Botao>
        <Botao variante="fantasma" onClick={aoDivulgar}>
          Ver link
        </Botao>
      </div>
      {taxa && (
        <JanelaTaxa
          config={config}
          aoFechar={() => setTaxa(false)}
          aoSalvar={(c) => {
            aoSalvar(c);
            setTaxa(false);
          }}
        />
      )}
    </section>
  );
}

interface LinhaFaixa {
  id: number;
  km: string;
  taxa: string;
}

const FAIXAS_INICIAIS: LinhaFaixa[] = [
  { id: 1, km: '1', taxa: '5,00' },
  { id: 2, km: '3', taxa: '8,00' },
  { id: 3, km: '5', taxa: '12,00' },
];
const numeroKm = (s: string) => Number(s.replace(',', '.'));

/** Taxa fixa ou por distância: o restaurante marca onde fica no mapa e define faixas de raio (a partir de 1 km). */
function JanelaTaxa({ config, aoFechar, aoSalvar }: { config: ConfigEntregas; aoFechar: () => void; aoSalvar: (c: ConfigEntregas) => void }) {
  const { restaurante } = useGestao();
  const { avisar } = useAvisos();
  const [modo, setModo] = useState(config.modoTaxa);
  const [fixa, setFixa] = useState(config.taxaEntrega ? textoDosCentavos(config.taxaEntrega) : '');
  const [faixas, setFaixas] = useState<LinhaFaixa[]>(() =>
    config.faixas.length ? config.faixas.map((f, i) => ({ id: i + 1, km: String(f.ateKm).replace('.', ','), taxa: f.taxa ? textoDosCentavos(f.taxa) : '' })) : FAIXAS_INICIAIS,
  );
  const [origem, setOrigem] = useState(config.origem);
  const [buscando, setBuscando] = useState<'' | 'aparelho' | 'endereco'>('');
  const [dica, setDica] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const ordenadas = [...faixas].filter((f) => numeroKm(f.km) > 0).sort((a, b) => numeroKm(a.km) - numeroKm(b.km));
  const corDe = (f: LinhaFaixa) => CORES_FAIXAS[Math.max(0, ordenadas.indexOf(f)) % CORES_FAIXAS.length];
  const circulos = ordenadas.map((f) => ({ raioKm: numeroKm(f.km), cor: corDe(f) }));
  const maior = ordenadas[ordenadas.length - 1];

  const buscarEndereco = async () => {
    if (!restaurante?.endereco) return setDica({ texto: 'Cadastre o endereço do restaurante em Dados e assinatura, ou use a localização deste aparelho.', erro: true });
    setBuscando('endereco');
    setDica(null);
    const p = await posicaoDoEndereco(restaurante.endereco);
    setBuscando('');
    if (!p) return setDica({ texto: `Não achamos "${restaurante.endereco}" no mapa. Use a localização deste aparelho ou toque no mapa no lugar certo.`, erro: true });
    setOrigem(p);
    setDica({ texto: 'Achamos o endereço cadastrado. Confira se o pino está na porta do restaurante; se não, arraste-o.' });
  };
  const usarAparelho = async () => {
    setBuscando('aparelho');
    setDica(null);
    try {
      const p = await obterPosicao();
      setOrigem({ latitude: p.latitude, longitude: p.longitude });
      setDica({ texto: 'Pino colocado onde este aparelho está. Confira se é a porta do restaurante.' });
    } catch (e) {
      setDica({ texto: e instanceof Error ? e.message : 'Não foi possível achar a localização.', erro: true });
    } finally {
      setBuscando('');
    }
  };

  // Primeira vez por distância: já procura o endereço cadastrado para o restaurante não começar do zero.
  useEffect(() => {
    if (modo === 'distancia' && !origem && !buscando) buscarEndereco();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

  const mudarFaixa = (id: number, campo: 'km' | 'taxa', v: string) => setFaixas((l) => l.map((f) => (f.id === id ? { ...f, [campo]: v } : f)));
  const adicionar = () => {
    const ultimo = maior ? numeroKm(maior.km) : 0;
    const taxaUltima = maior ? centavosDoTexto(maior.taxa) ?? 0 : 500;
    setFaixas((l) => [...l, { id: Math.max(0, ...l.map((f) => f.id)) + 1, km: String(Math.min(50, Math.floor(ultimo) + 2)), taxa: textoDosCentavos(taxaUltima + 300) }]);
  };

  const salvar = async () => {
    const taxaFixa = fixa.trim() ? centavosDoTexto(fixa) : 0;
    if (taxaFixa == null) return avisar('Taxa fixa inválida.', 'erro');
    const lista = [];
    for (const f of faixas) {
      const k = numeroKm(f.km);
      if (!f.km.trim() || !Number.isFinite(k) || k < 1 || k > 50) return avisar('Cada faixa precisa ter uma distância de 1 a 50 km.', 'erro');
      const v = f.taxa.trim() ? centavosDoTexto(f.taxa) : 0;
      if (v == null) return avisar(`Confira o valor da faixa de até ${f.km} km.`, 'erro');
      lista.push({ ateKm: k, taxa: v });
    }
    if (new Set(lista.map((f) => f.ateKm)).size !== lista.length) return avisar('Há duas faixas com a mesma distância.', 'erro');
    if (modo === 'distancia') {
      if (!origem) return avisar('Marque no mapa onde fica o restaurante.', 'erro');
      if (!lista.length) return avisar('Adicione pelo menos uma faixa de distância.', 'erro');
    }
    setSalvando(true);
    try {
      const c = await gestao.put<ConfigEntregas>('/entregas/taxa', {
        modoTaxa: modo,
        taxaEntrega: taxaFixa,
        faixas: lista,
        latitude: origem?.latitude ?? null,
        longitude: origem?.longitude ?? null,
      });
      avisar(c.modoTaxa === 'distancia' ? 'Taxa por distância salva: o cliente vê o valor pela localização dele.' : 'Taxa de entrega salva.');
      aoSalvar(c);
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  const opcao = (valor: 'fixa' | 'distancia', icone: ReactNode, titulo: string, texto: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={modo === valor}
      onClick={() => setModo(valor)}
      className={cx(
        'flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition sm:p-4',
        modo === valor ? 'border-marca bg-marca-clara' : 'border-stone-200 bg-white hover:border-stone-300',
      )}
    >
      <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', modo === valor ? 'bg-marca text-white' : 'bg-stone-100 text-stone-600')}>{icone}</span>
      <span className="min-w-0">
        <span className="block font-bold leading-tight">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-snug text-stone-600">{texto}</span>
      </span>
    </button>
  );

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Taxa de entrega"
      largura="max-w-4xl"
      cheiaNoCelular
      rodape={
        <Botao tamanho="g" largo carregando={salvando} onClick={salvar}>
          Salvar taxa de entrega
        </Botao>
      }
    >
      <div className="space-y-5">
        <div role="radiogroup" aria-label="Como cobrar a entrega" className="grid gap-2 sm:grid-cols-2">
          {opcao('fixa', <CircleDollarSign className="h-5 w-5" />, 'Taxa fixa', 'O mesmo valor para qualquer endereço.')}
          {opcao('distancia', <Radar className="h-5 w-5" />, 'Por distância', 'O valor muda conforme a distância entre o restaurante e o cliente.')}
        </div>

        {modo === 'fixa' ? (
          <section className="rounded-2xl border border-stone-200 p-4">
            <label className="block max-w-xs">
              <span className="rotulo">Valor da entrega</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">R$</span>
                <Entrada id="taxa-fixa" value={fixa} onChange={(e) => setFixa(e.target.value)} inputMode="decimal" placeholder="grátis" className="pl-9" />
              </div>
            </label>
            <p className="mt-2 text-sm text-stone-500">Deixe em branco para entrega grátis.</p>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <section className="min-w-0 space-y-2">
              <h3 className="flex items-center gap-2 font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs text-white">1</span>
                Onde fica o restaurante
              </h3>
              {origem ? (
                <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-stone-200 lg:h-96" />}>
                  <Mapa
                    latitude={origem.latitude}
                    longitude={origem.longitude}
                    editavel
                    circulos={circulos}
                    className="h-72 lg:h-96"
                    aoMudar={(lat, lng) => setOrigem({ latitude: lat, longitude: lng })}
                  />
                </Suspense>
              ) : (
                <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-500 lg:h-96">
                  <MapPin className="h-8 w-8 text-stone-300" />
                  {buscando ? 'Procurando o restaurante no mapa…' : 'Marque a localização do restaurante para desenhar as faixas.'}
                </div>
              )}
              <p className="text-xs text-stone-500">Arraste o pino ou toque no mapa para colocar na porta do restaurante. Os círculos são as faixas de distância.</p>
              <div className="flex flex-wrap gap-2">
                <Botao tamanho="p" variante="secundario" carregando={buscando === 'endereco'} icone={<Search className="h-4 w-4" />} onClick={buscarEndereco}>
                  Buscar pelo endereço cadastrado
                </Botao>
                <Botao tamanho="p" variante="secundario" carregando={buscando === 'aparelho'} icone={<LocateFixed className="h-4 w-4" />} onClick={usarAparelho}>
                  Usar a localização deste aparelho
                </Botao>
              </div>
              {dica && <p className={cx('text-sm', dica.erro ? 'text-red-700' : 'text-emerald-800')}>{dica.texto}</p>}
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 font-bold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs text-white">2</span>
                Faixas de distância
              </h3>
              <p className="text-xs text-stone-500">Distância em linha reta, a partir do restaurante. Deixe o valor em branco para entrega grátis na faixa.</p>
              <ul className="space-y-2">
                {faixas.map((f) => {
                  const i = ordenadas.indexOf(f);
                  const de = i > 0 ? numeroKm(ordenadas[i - 1].km) : 0;
                  return (
                    <li key={f.id} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-2 pl-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: corDe(f) }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{i >= 0 ? `de ${kmFaixa(de)} até` : 'até'}</p>
                        <div className="flex items-center gap-1">
                          <Entrada
                            aria-label="Distância máxima da faixa, em km"
                            value={f.km}
                            onChange={(e) => mudarFaixa(f.id, 'km', e.target.value.replace(/[^\d,.]/g, ''))}
                            inputMode="decimal"
                            className="h-9 w-16 px-2 text-center"
                          />
                          <span className="text-sm text-stone-600">km</span>
                        </div>
                      </div>
                      <div className="relative w-28">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-500">R$</span>
                        <Entrada aria-label="Taxa da faixa" value={f.taxa} onChange={(e) => mudarFaixa(f.id, 'taxa', e.target.value)} inputMode="decimal" placeholder="grátis" className="h-9 pl-8" />
                      </div>
                      <button type="button" onClick={() => setFaixas((l) => l.filter((x) => x.id !== f.id))} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Remover faixa">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {faixas.length < 12 && (
                <button type="button" onClick={adicionar} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-300 py-2.5 text-sm font-semibold text-stone-600 hover:border-marca hover:text-marca">
                  <Plus className="h-4 w-4" /> Adicionar faixa
                </button>
              )}
              {maior && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Acima de <strong>{kmFaixa(numeroKm(maior.km))}</strong>, o cliente vê que o endereço está fora da área de entrega.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </Janela>
  );
}

interface AcoesTaxa {
  /** Taxa configurada agora no restaurante (o valor que volta ao marcar "cobrar"). */
  taxaPadrao: number;
  aoTaxa: (e: Entrega, cobrar: boolean) => void;
}

function Coluna({ entregas, agora, aoMudar, taxaPadrao, aoTaxa }: { entregas: Entrega[]; agora: number; aoMudar: (e: Entrega, s: StatusEntrega) => void } & AcoesTaxa) {
  if (!entregas.length) return <p className="py-8 text-center text-sm text-stone-400">Nada por aqui</p>;
  return (
    <div className="space-y-3">
      {entregas.map((e) => (
        <CartaoEntrega key={e.id} entrega={e} agora={agora} aoMudar={aoMudar} taxaPadrao={taxaPadrao} aoTaxa={aoTaxa} />
      ))}
    </div>
  );
}

function CartaoEntrega({ entrega: e, agora, aoMudar, taxaPadrao, aoTaxa }: { entrega: Entrega; agora: number; aoMudar: (e: Entrega, s: StatusEntrega) => void } & AcoesTaxa) {
  const aberto = e.status !== 'entregue' && e.status !== 'cancelado';
  const proximo = PROXIMO[e.status];
  const fone = e.telefone.replace(/\D/g, '');
  const [verMapa, setVerMapa] = useState(false);
  const [editando, setEditando] = useState(false);
  const { avisar, confirmar } = useAvisos();
  const temLocal = e.latitude != null && e.longitude != null;
  const excluir = async () => {
    if (
      !(await confirmar({
        titulo: `Excluir a entrega #${e.id} de ${e.clienteNome}?`,
        texto: 'O pedido some do quadro e os itens voltam para o estoque. O cliente deixa de ver o acompanhamento. Não dá para desfazer.',
        confirmar: 'Excluir pedido',
        perigo: true,
      }))
    )
      return;
    try {
      await gestao.del(`/entregas/${e.id}`);
      avisar(`Entrega #${e.id} excluída.`);
    } catch (er) {
      avisar(mensagemDe(er), 'erro');
    }
  };
  return (
    <article className="cartao overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <span className="rounded-lg bg-violet-600 px-2 py-0.5 text-xs font-bold text-white">Entrega #{e.id}</span>
        <span className="ml-auto text-xs text-stone-500">{tempoDesde(e.criadoEm, agora)}</span>
        {aberto && (
          <button type="button" onClick={() => setEditando(true)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800" aria-label="Editar pedido" title="Editar pedido">
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {e.status !== 'entregue' && (
          <button type="button" onClick={excluir} className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Excluir pedido" title="Excluir pedido">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="space-y-1 px-4 pt-3 text-sm">
        <p className="font-bold">{e.clienteNome}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-700">
          <a href={`tel:${fone}`} className="inline-flex items-center gap-1 font-medium text-marca">
            <Phone className="h-3.5 w-3.5" />
            {telefone(fone)}
          </a>
          <a href={`https://wa.me/55${fone}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </p>
        <p className="flex gap-1 text-stone-700">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
          <EnderecoEntrega entrega={e} />
        </p>
        {temLocal && (
          <span className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setVerMapa(true)} className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100">
            <IconeMapa className="h-3.5 w-3.5" /> Ver no mapa
          </button>
          {e.distanciaM != null && <span className="text-xs font-semibold text-stone-500">{km(e.distanciaM)} do restaurante</span>}
          </span>
        )}
      </div>
      {verMapa && temLocal && <JanelaMapa entrega={e} aoFechar={() => setVerMapa(false)} />}
      {editando && <JanelaEditarEntrega entrega={e} aoFechar={() => setEditando(false)} />}
      <ul className="space-y-1 px-4 py-3 text-sm">
        {e.itens.map((i) => (
          <li key={i.id}>
            <span className="font-bold">{i.quantidade}×</span> {i.nome}
            {i.observacao && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-900">{i.observacao}</span>}
            {!!i.adicionais?.length && <span className="block pl-5 text-sm font-semibold text-sky-800">{textoAdicionais(i.adicionais)}</span>}
          </li>
        ))}
        {e.observacao && <li className="pt-1 text-sm italic text-stone-600">“{e.observacao}”</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 px-4 py-2.5 text-sm">
        <span className="font-bold">{reais(e.total)}</span>
        <Selo>{e.formaPagamento}</Selo>
        {e.trocoPara ? <span className="text-xs text-stone-600">Troco para {reais(e.trocoPara)} ({reais(e.trocoPara - e.total)})</span> : null}
        {!aberto && e.taxaEntrega > 0 && <span className="text-xs text-stone-500">inclui entrega {reais(e.taxaEntrega)}</span>}
      </div>
      {aberto && (taxaPadrao > 0 || e.taxaEntrega > 0) && (
        <label className="flex cursor-pointer items-center gap-2 border-t border-stone-100 px-4 py-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--marca))]" checked={e.taxaEntrega > 0} onChange={(ev) => aoTaxa(e, ev.target.checked)} />
          <span className="flex-1">Cobrar taxa de entrega</span>
          <span className={cx('font-semibold', e.taxaEntrega > 0 ? 'text-stone-800' : 'text-emerald-700')}>{e.taxaEntrega > 0 ? reais(e.taxaEntrega) : 'grátis'}</span>
        </label>
      )}
      {(proximo || e.status !== 'entregue') && e.status !== 'cancelado' && (
        <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-2.5">
          {proximo && (
            <Botao tamanho="p" variante={proximo.status === 'entregue' ? 'sucesso' : 'primario'} icone={<proximo.icone className="h-4 w-4" />} onClick={() => aoMudar(e, proximo.status)}>
              {proximo.rotulo}
            </Botao>
          )}
          <button type="button" onClick={() => aoMudar(e, 'cancelado')} className="ml-auto rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Cancelar pedido">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </article>
  );
}

/** Endereço clicável: abre o ponto marcado pelo cliente, ou a busca do endereço, no OpenStreetMap. */
function EnderecoEntrega({ entrega: e }: { entrega: Entrega }) {
  const texto = [e.endereco, e.complemento, e.bairro].filter(Boolean).join(' · ');
  const href = e.latitude != null && e.longitude != null ? linkMapa(e.latitude, e.longitude) : linkBusca([e.endereco, e.bairro].filter(Boolean).join(', '));
  return (
    <span className="break-words">
      <a href={href} target="_blank" rel="noopener" title="Abrir no OpenStreetMap" className="underline decoration-stone-300 underline-offset-2 hover:text-marca hover:decoration-marca">
        {texto}
      </a>
      {e.referencia && <span className="block text-xs text-stone-500">Ref.: {e.referencia}</span>}
    </span>
  );
}

const FORMAS_ENTREGA = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Vale-refeição', 'Vale-alimentação'];

/** Restaurante corrige um pedido de entrega: itens, dados do cliente, endereço e pagamento. */
function JanelaEditarEntrega({ entrega: e, aoFechar }: { entrega: Entrega; aoFechar: () => void }) {
  const { restaurante } = useGestao();
  const { avisar } = useAvisos();
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(() => linhasDoPedido(e.itens));
  const [d, setD] = useState({
    nome: e.clienteNome,
    telefone: telefone(e.telefone),
    endereco: e.endereco,
    complemento: e.complemento,
    bairro: e.bairro,
    referencia: e.referencia,
    observacao: e.observacao,
  });
  const [forma, setForma] = useState(e.formaPagamento);
  const [troco, setTroco] = useState(e.trocoPara ? textoDosCentavos(e.trocoPara) : '');
  const [salvando, setSalvando] = useState(false);
  const subtotal = totalDasLinhas(linhas);
  const campo = (k: keyof typeof d) => ({ value: d[k], onChange: (ev: { target: { value: string } }) => setD((x) => ({ ...x, [k]: k === 'telefone' ? telefone(ev.target.value) : ev.target.value })) });

  const salvar = async () => {
    if (!linhas.length) return avisar('O pedido precisa ter pelo menos um item. Para tirar tudo, exclua o pedido.', 'erro');
    const trocoPara = forma === 'Dinheiro' && troco.trim() ? centavosDoTexto(troco) : null;
    if (forma === 'Dinheiro' && troco.trim() && trocoPara == null) return avisar('Valor do troco inválido.', 'erro');
    setSalvando(true);
    try {
      await gestao.put(`/entregas/${e.id}`, { ...d, formaPagamento: forma, trocoPara, itens: itensParaEnviar(linhas) });
      avisar(`Entrega #${e.id} atualizada.`);
      aoFechar();
    } catch (er) {
      avisar(mensagemDe(er), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Editar entrega #${e.id}`}
      largura="max-w-2xl"
      cheiaNoCelular
      rodape={
        <Botao tamanho="g" largo carregando={salvando} disabled={!linhas.length} onClick={salvar}>
          Salvar alterações · {reais(subtotal + e.taxaEntrega)}
        </Botao>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Itens</h3>
          {restaurante && <EditorItens rid={restaurante.id} linhas={linhas} aoMudar={setLinhas} />}
          <dl className="mt-2 space-y-1 px-1 text-sm">
            <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd>{reais(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-500">Entrega</dt><dd>{e.taxaEntrega ? reais(e.taxaEntrega) : 'grátis'}</dd></div>
            <div className="flex justify-between font-bold"><dt>Total</dt><dd>{reais(subtotal + e.taxaEntrega)}</dd></div>
          </dl>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500">Cliente e endereço</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="rotulo">Nome</span><Entrada {...campo('nome')} maxLength={60} /></label>
            <label className="block"><span className="rotulo">Telefone</span><Entrada {...campo('telefone')} inputMode="tel" /></label>
          </div>
          <label className="block"><span className="rotulo">Endereço (rua e número)</span><Entrada {...campo('endereco')} maxLength={120} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="rotulo">Complemento</span><Entrada {...campo('complemento')} maxLength={60} /></label>
            <label className="block"><span className="rotulo">Bairro</span><Entrada {...campo('bairro')} maxLength={60} /></label>
          </div>
          <label className="block"><span className="rotulo">Ponto de referência</span><Entrada {...campo('referencia')} maxLength={120} /></label>
          <label className="block"><span className="rotulo">Observação do pedido</span><Entrada {...campo('observacao')} maxLength={300} /></label>
        </section>
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-stone-500">Pagamento na entrega</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FORMAS_ENTREGA.map((f) => (
              <button key={f} type="button" onClick={() => setForma(f)} className={cx('rounded-xl border px-2 py-2.5 text-sm font-semibold transition', forma === f ? 'border-marca bg-marca-clara text-marca-escura' : 'border-stone-200 hover:bg-stone-50')}>
                {f}
              </button>
            ))}
          </div>
          {forma === 'Dinheiro' && (
            <label className="block max-w-xs"><span className="rotulo">Troco para quanto? (opcional)</span><Entrada value={troco} onChange={(ev) => setTroco(ev.target.value)} inputMode="decimal" placeholder="Ex.: 100,00" /></label>
          )}
        </section>
      </div>
    </Janela>
  );
}

function JanelaMapa({ entrega: e, aoFechar }: { entrega: Entrega; aoFechar: () => void }) {
  const lat = e.latitude!;
  const lng = e.longitude!;
  return (
    <Janela aberta aoFechar={aoFechar} titulo={`Entrega #${e.id} · ${e.clienteNome}`} largura="max-w-2xl" cheiaNoCelular>
      <div className="space-y-3">
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl bg-stone-200" />}>
          <Mapa latitude={lat} longitude={lng} className="h-80 sm:h-96" />
        </Suspense>
        <p className="flex gap-1.5 text-sm text-stone-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
          <EnderecoEntrega entrega={e} />
        </p>
        <p className="text-xs text-stone-500">Ponto marcado pelo cliente com a localização do celular.</p>
        <div className="flex flex-wrap gap-2">
          <a href={linkRota(lat, lng)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-xl bg-marca px-3 py-2 text-sm font-semibold text-white hover:bg-marca-escura">
            <Navigation className="h-4 w-4" /> Traçar rota
          </a>
          <a href={linkMapa(lat, lng)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50">
            <ExternalLink className="h-4 w-4" /> Abrir no OpenStreetMap
          </a>
        </div>
      </div>
    </Janela>
  );
}

function JanelaDivulgar({ link, restaurante, aoFechar }: { link: string; restaurante: string; aoFechar: () => void }) {
  const { avisar } = useAvisos();
  return (
    <Janela aberta aoFechar={aoFechar} titulo="Link e QR Code de entrega" largura="max-w-md">
      <div className="space-y-4 text-center">
        <div className="mx-auto w-fit rounded-2xl border border-stone-200 bg-white p-5" id="qr-entrega">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{restaurante}</p>
          <p className="text-xl font-extrabold">Peça em casa 🛵</p>
          <QrCode texto={link} tamanho={210} className="mx-auto my-3" />
          <p className="text-xs text-stone-500">Aponte a câmera para fazer o seu pedido de entrega</p>
        </div>
        <p className="break-all rounded-xl bg-stone-50 px-3 py-2 text-sm font-medium">{link}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Botao
            variante="secundario"
            icone={<Copy className="h-4 w-4" />}
            onClick={() =>
              navigator.clipboard
                .writeText(link)
                .then(() => avisar('Link copiado.'))
                .catch(() => avisar('Não deu para copiar. Selecione o link acima.', 'erro'))
            }
          >
            Copiar link
          </Botao>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Peça no ${restaurante} pelo nosso cardápio online: ${link}`)}`} target="_blank" rel="noopener">
            <Botao variante="secundario" icone={<MessageCircle className="h-4 w-4" />}>
              Enviar no WhatsApp
            </Botao>
          </a>
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Imprimir
          </Botao>
        </div>
        <p className="text-xs text-stone-500">Coloque o link na bio do Instagram, no WhatsApp do restaurante e o QR Code nos panfletos e nas embalagens.</p>
      </div>
    </Janela>
  );
}

interface Relatorio {
  caixaAberto: boolean;
  abertoEm?: string;
  ultimoFechamentoEm?: string | null;
  entregues?: number;
  vendido?: number;
  taxas?: number;
  total?: number;
  ticketMedio?: number;
  porForma?: { forma: string; valor: number }[];
  emAndamento?: { quantidade: number; valor: number };
  cancelados?: { quantidade: number; valor: number };
  pedidos?: { id: number; clienteNome: string; bairro: string; formaPagamento: string; total: number; taxaEntrega: number; entregueEm: string }[];
}

/** Quanto foi vendido em entregas desde a abertura do caixa (o mesmo período de "Vendido no período" em Mesas). */
function JanelaRelatorio({ aoFechar }: { aoFechar: () => void }) {
  const [r, setR] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    gestao
      .get<Relatorio>('/entregas/relatorio')
      .then(setR)
      .catch((e) => setErro(mensagemDe(e)));
  }, []);

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Entregas do período" largura="max-w-xl" cheiaNoCelular>
      {erro ? (
        <Aviso tipo="erro">{erro}</Aviso>
      ) : !r ? (
        <Carregando />
      ) : !r.caixaAberto ? (
        <Aviso tipo="info" titulo="O caixa está fechado">
          O relatório mostra as entregas desde a abertura do caixa. Abra o caixa na tela de Mesas para começar um novo período.
          {r.ultimoFechamentoEm && ` O último período foi fechado em ${dataHoraCurta(r.ultimoFechamentoEm)} e está em Fechamentos de caixa.`}
        </Aviso>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-stone-500">Desde a abertura do caixa, em {dataHoraCurta(r.abertoEm!)}, até agora.</p>
          <div className="grid grid-cols-2 gap-3">
            <Numero rotulo="Total recebido" valor={reais(r.total)} destaque />
            <Numero rotulo="Pedidos entregues" valor={String(r.entregues)} />
            <Numero rotulo="Vendido em itens" valor={reais(r.vendido)} />
            <Numero rotulo="Taxas de entrega" valor={reais(r.taxas)} />
            <Numero rotulo="Ticket médio" valor={reais(r.ticketMedio)} />
            <Numero rotulo="Em andamento" valor={`${r.emAndamento!.quantidade} · ${reais(r.emAndamento!.valor)}`} />
          </div>
          {!!r.porForma?.length && (
            <div className="rounded-xl bg-stone-50 p-4">
              <p className="mb-2 text-sm font-semibold">Por forma de pagamento</p>
              {r.porForma.map((f) => (
                <p key={f.forma} className="flex justify-between text-sm">
                  <span>{f.forma}</span>
                  <b>{reais(f.valor)}</b>
                </p>
              ))}
            </div>
          )}
          {r.cancelados!.quantidade > 0 && (
            <p className="text-sm text-stone-500">
              {r.cancelados!.quantidade} cancelado(s) no período ({reais(r.cancelados!.valor)}), fora dos valores acima.
            </p>
          )}
          <div>
            <p className="mb-1 text-sm font-semibold">Pedidos entregues</p>
            {!r.pedidos?.length ? (
              <p className="py-4 text-center text-sm text-stone-500">Nenhuma entrega concluída neste período ainda.</p>
            ) : (
              <ul className="divide-y divide-stone-100 text-sm">
                {r.pedidos.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0">
                      #{p.id} · {p.clienteNome}
                      <span className="block text-xs text-stone-500">
                        {dataHoraCurta(p.entregueEm)} · {p.formaPagamento}
                        {p.bairro && ` · ${p.bairro}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{reais(p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Janela>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={cx('rounded-xl border p-3', destaque ? 'border-marca/30 bg-marca-clara' : 'border-stone-200 bg-white')}>
      <p className="text-xs text-stone-500">{rotulo}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{valor}</p>
    </div>
  );
}

const dataHoraCurta = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
