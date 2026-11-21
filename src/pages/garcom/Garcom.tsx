import { Bell, BellOff, BellRing, CheckCheck, QrCode as QrCodeIcon, Receipt, Settings, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAgora } from '../../components/comuns';
import { JanelaFechamento } from '../../components/FechamentoConta';
import { PainelQrMesa, linkDaMesa } from '../../components/QrMesa';
import { Abas, Aviso, Botao, Campo, Carregando, Entrada, Janela, Selo, cx, useAvisos } from '../../components/ui';
import { api, mensagemDe, nomeSalvo } from '../../lib/api';
import { ROTULO_STATUS, reais, tempoDesde } from '../../lib/formato';
import { aplicarMarca } from '../../lib/marca';
import { liberarSom, tocar } from '../../lib/som';
import { useTempoReal } from '../../lib/tempoReal';
import type { Marca, MesaGestao, Pedido } from '../../lib/tipos';

interface Estado {
  restaurante: string;
  marca: Marca;
  chavePublica: string;
  caixaAberto?: boolean;
  mesas: MesaGestao[];
}

type Aba = 'agora' | 'mesas';
const COR_STATUS_GARCOM = { recebido: 'azul', preparando: 'amarelo', pronto: 'verde', entregue: 'cinza', cancelado: 'vermelho' } as const;
const TIPOS_AVISO = [
  ['pronto', 'Pedido pronto para servir'],
  ['garcom', 'Mesa chamando'],
  ['conta', 'Mesa pediu a conta'],
  ['novo', 'Novo pedido'],
] as const;

function base64ParaBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

export default function Garcom() {
  const { rid = '' } = useParams();
  const [busca] = useSearchParams();
  const token = busca.get('t') || '';
  const q = `?t=${encodeURIComponent(token)}`;
  const { avisar } = useAvisos();
  const agora = useAgora(20000);

  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('agora');
  const [fechar, setFechar] = useState<MesaGestao | null>(null);
  const [config, setConfig] = useState(false);
  const [opcoesMesa, setOpcoesMesa] = useState<MesaGestao | null>(null);
  const [escolherQr, setEscolherQr] = useState(false);
  const [qrMesa, setQrMesa] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const e = await api.get<Estado>(`/garcom/${rid}${q}`);
      setEstado(e);
      aplicarMarca(e.marca.cor);
      document.title = `Garçom · ${e.restaurante}`;
    } catch (e) {
      setErro(mensagemDe(e));
    }
  }, [rid, q]);

  useEffect(() => {
    carregar();
    // Manifesto do app (no iPhone, "Adicionar à Tela de Início" é o que libera as notificações).
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = `/api/garcom/${rid}/manifest.webmanifest${q}`;
    document.head.appendChild(link);
    navigator.serviceWorker?.register('/sw-garcom.js', { scope: '/garcom/' }).catch(() => {});
    const msg = (e: MessageEvent) => e.data?.tipo === 'push' && carregar();
    navigator.serviceWorker?.addEventListener('message', msg);
    window.addEventListener('pointerdown', liberarSom, { once: true });
    return () => {
      link.remove();
      navigator.serviceWorker?.removeEventListener('message', msg);
    };
  }, [carregar, rid, q]);

  useTempoReal(
    estado ? { evento: 'garcom:entrar', dados: { restauranteId: Number(rid), token } } : null,
    {
      'garcom:evento': (e: { tipo: string }) => {
        if (document.visibilityState === 'visible') {
          if (e.tipo === 'garcom-chamado') tocar('garcom');
          else if (e.tipo === 'fechamento-solicitado') tocar('conta');
        }
        carregar();
      },
      'restaurante:alterado': () => carregar(),
      'garcom:desconectado': () => setErro('O acesso dos garçons foi trocado pelo gerente. Leia o novo QR Code.'),
    },
  );

  // Toca quando aparece um pedido pronto novo.
  const prontos = useMemo(() => (estado?.mesas ?? []).flatMap((m) => (m.sessao?.pedidos ?? []).filter((p) => p.status === 'pronto')), [estado]);
  const [vistos, setVistos] = useState<Set<number>>(new Set());
  useEffect(() => {
    const novos = prontos.filter((p) => !vistos.has(p.id));
    if (novos.length && vistos.size) tocar('pronto');
    if (novos.length) setVistos(new Set(prontos.map((p) => p.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prontos]);

  if (erro)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold">Acesso indisponível</h1>
        <p className="max-w-sm text-stone-600">{erro}</p>
      </div>
    );
  if (!estado) return <Carregando tela />;

  const mesas = estado.mesas;
  const chamando = mesas.filter((m) => m.sessao?.garcomChamadoEm);
  const conta = mesas.filter((m) => m.sessao?.status === 'fechamento_solicitado');
  const pendencias = chamando.length + conta.length + prontos.length;

  const acao = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      avisar(msg);
      carregar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  const mesaDe = (p: Pedido) => p.mesa;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-10">
      <header className="pt-seguro sticky top-0 z-20 bg-marca text-white shadow">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium opacity-80">Garçom{nomeSalvo.ler() ? ` · ${nomeSalvo.ler()}` : ''}</p>
            <h1 className="truncate text-lg font-bold">{estado.restaurante}</h1>
          </div>
          <button
            type="button"
            onClick={() => setEscolherQr(true)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-semibold"
            aria-label="Mostrar QR Code de uma mesa"
          >
            <QrCodeIcon className="h-5 w-5" />
            QR da mesa
          </button>
          <button type="button" onClick={() => setConfig(true)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15" aria-label="Avisos e nome">
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <Abas<Aba>
            atual={aba}
            aoMudar={setAba}
            abas={[
              { valor: 'agora', rotulo: 'Agora', contador: pendencias },
              { valor: 'mesas', rotulo: 'Todas as mesas' },
            ]}
          />
        </div>
      </header>

      <AvisoNotificacoes rid={rid} q={q} chave={estado.chavePublica} />

      {aba === 'agora' ? (
        <div className="space-y-6 px-4 pt-4">
          {!pendencias && (
            <div className="py-16 text-center text-stone-500">
              <CheckCheck className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
              Tudo em dia! Nenhuma mesa esperando.
            </div>
          )}
          {chamando.length > 0 && (
            <Grupo titulo="Chamando" icone={<BellRing className="h-4 w-4 text-marca" />}>
              {chamando.map((m) => (
                <Linha key={m.numero} mesa={m.numero} detalhe={tempoDesde(m.sessao!.garcomChamadoEm, agora)} destaque>
                  <Botao tamanho="p" onClick={() => acao(() => api.post(`/garcom/${rid}/mesas/${m.numero}/atender${q}`), `Mesa ${m.numero}: atendida.`)}>
                    Atendi
                  </Botao>
                </Linha>
              ))}
            </Grupo>
          )}
          {prontos.length > 0 && (
            <Grupo titulo="Prontos para servir" icone={<UtensilsCrossed className="h-4 w-4 text-emerald-600" />}>
              {prontos.map((p) => (
                <Linha
                  key={p.id}
                  mesa={mesaDe(p)}
                  detalhe={
                    <>
                      {p.clienteNome && <b className="block text-stone-900">{p.clienteNome}</b>}
                      {p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}
                    </>
                  }
                >
                  <Botao tamanho="p" variante="sucesso" onClick={() => acao(() => api.post(`/garcom/${rid}/pedidos/${p.id}/entregue${q}`), `Pedido #${p.id} entregue.`)}>
                    Entreguei
                  </Botao>
                </Linha>
              ))}
            </Grupo>
          )}
          {conta.length > 0 && (
            <Grupo titulo="Pediram a conta" icone={<Receipt className="h-4 w-4 text-sky-600" />}>
              {conta.map((m) => (
                <Linha key={m.numero} mesa={m.numero} detalhe={`${reais(m.sessao!.total)} · ${tempoDesde(m.sessao!.fechamentoSolicitadoEm, agora)}`}>
                  <Botao tamanho="p" variante="escuro" onClick={() => setFechar(m)}>
                    Fechar
                  </Botao>
                </Linha>
              ))}
            </Grupo>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 px-4 pt-4 sm:grid-cols-4">
          {mesas.map((m) => {
            const s = m.sessao;
            return (
              <button
                key={m.numero}
                type="button"
                onClick={() => setOpcoesMesa(m)}
                className={cx(
                  'flex aspect-square flex-col items-center justify-center rounded-2xl border-2 p-2',
                  !s ? 'border-dashed border-stone-300 text-stone-400' : s.garcomChamadoEm ? 'border-marca bg-marca-clara' : s.status === 'fechamento_solicitado' ? 'border-sky-300 bg-sky-50' : 'border-stone-200 bg-white',
                )}
              >
                <span className="text-2xl font-extrabold">{m.numero}</span>
                {s ? <span className="text-xs font-semibold">{reais(s.total)}</span> : <span className="text-xs">Livre</span>}
              </button>
            );
          })}
        </div>
      )}

      {fechar?.sessao && (
        <JanelaFechamento
          titulo={`Fechar conta · Mesa ${fechar.numero}`}
          sessao={fechar.sessao}
          caixaAberto={estado.caixaAberto !== false}
          avisoCaixaFechado={
            <Aviso tipo="alerta" titulo="O caixa está fechado">
              Peça ao gerente para abrir o caixa antes de fechar a conta.
            </Aviso>
          }
          aoFechar={() => setFechar(null)}
          aoConfirmar={async (dados) => {
            try {
              await api.post(`/garcom/${rid}/mesas/${fechar.numero}/fechar${q}`, { ...dados, garcom: nomeSalvo.ler() || '' });
              avisar(`Mesa ${fechar.numero} fechada.`);
              setFechar(null);
              carregar();
            } catch (e) {
              avisar(mensagemDe(e), 'erro');
            }
          }}
        />
      )}
      {config && <Configuracoes rid={rid} q={q} chave={estado.chavePublica} aoFechar={() => setConfig(false)} />}

      {opcoesMesa && (
        <Janela aberta aoFechar={() => setOpcoesMesa(null)} titulo={`Mesa ${opcoesMesa.numero}`} largura="max-w-sm">
          <div className="space-y-2 pb-2">
            {opcoesMesa.sessao && (
              <>
                <p className="text-sm text-stone-600">
                  Conta em aberto: <b>{reais(opcoesMesa.sessao.total)}</b>
                </p>
                {opcoesMesa.sessao.pedidos.length > 0 && (
                  <ul className="mb-3 max-h-60 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-3 text-sm">
                    {opcoesMesa.sessao.pedidos.map((p) => (
                      <li key={p.id} className={cx(p.status === 'cancelado' && 'opacity-50 line-through')}>
                        <div className="flex items-center justify-between gap-2">
                          <b className="truncate">{p.clienteNome || `Pedido #${p.id}`}</b>
                          <Selo cor={COR_STATUS_GARCOM[p.status]}>{ROTULO_STATUS[p.status]}</Selo>
                        </div>
                        <p className="text-stone-600">{p.itens.map((i) => `${i.quantidade}× ${i.nome}`).join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <Botao
              largo
              tamanho="g"
              icone={<QrCodeIcon className="h-5 w-5" />}
              onClick={() => {
                setQrMesa(opcoesMesa.numero);
                setOpcoesMesa(null);
              }}
            >
              Mostrar QR Code da mesa
            </Botao>
            {opcoesMesa.sessao && (
              <Botao
                largo
                tamanho="g"
                variante="escuro"
                icone={<Receipt className="h-5 w-5" />}
                onClick={() => {
                  setFechar(opcoesMesa);
                  setOpcoesMesa(null);
                }}
              >
                Fechar conta
              </Botao>
            )}
          </div>
        </Janela>
      )}

      {escolherQr && (
        <Janela aberta aoFechar={() => setEscolherQr(false)} titulo="QR Code de qual mesa?" largura="max-w-sm">
          <p className="mb-4 text-sm text-stone-600">Para mesas sem QR Code impresso: mostre o código na sua tela para o cliente ler com a câmera.</p>
          <div className="grid grid-cols-4 gap-2 pb-2">
            {mesas.map((m) => (
              <button
                key={m.numero}
                type="button"
                onClick={() => {
                  setQrMesa(m.numero);
                  setEscolherQr(false);
                }}
                className={cx(
                  'flex aspect-square items-center justify-center rounded-xl border-2 text-xl font-extrabold transition active:scale-95',
                  m.sessao ? 'border-stone-200 bg-white' : 'border-dashed border-stone-300 text-stone-500',
                )}
              >
                {m.numero}
              </button>
            ))}
          </div>
        </Janela>
      )}

      {qrMesa != null && <QrDaMesa rid={rid} q={q} numero={qrMesa} restaurante={estado.restaurante} aoFechar={() => setQrMesa(null)} />}
    </div>
  );
}

/** QR Code da mesa em tela cheia: o cliente lê direto da tela do garçom (mesa sem QR impresso). */
function QrDaMesa({ rid, q, numero, restaurante, aoFechar }: { rid: string; q: string; numero: number; restaurante: string; aoFechar: () => void }) {
  const [link, setLink] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get<{ numero: number; token: string }>(`/garcom/${rid}/mesas/${numero}/qrcode${q}`)
      .then((m) => setLink(linkDaMesa(rid, m.numero, m.token)))
      .catch((e) => setErro(mensagemDe(e)));
  }, [rid, q, numero]);

  return (
    <Janela aberta aoFechar={aoFechar} titulo={`QR Code · Mesa ${numero}`} largura="max-w-md">
      {erro ? (
        <Aviso tipo="erro">{erro}</Aviso>
      ) : !link ? (
        <Carregando />
      ) : (
        <PainelQrMesa
          link={link}
          restaurante={restaurante}
          numero={numero}
          instrucao="Peça para o cliente apontar a câmera do celular para este código. O cardápio da mesa abre na hora."
        />
      )}
    </Janela>
  );
}

function Grupo({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500">
        {icone}
        {titulo}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Linha({ mesa, detalhe, destaque, children }: { mesa: number; detalhe: ReactNode; destaque?: boolean; children: ReactNode }) {
  return (
    <div className={cx('cartao flex items-center gap-3 p-3', destaque && 'ring-2 ring-marca')}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-lg font-extrabold text-white">{mesa}</span>
      <p className="min-w-0 flex-1 text-sm text-stone-700">{detalhe}</p>
      {children}
    </div>
  );
}

function suportaPush() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function inscrever(rid: string, q: string, chave: string, nome: string, avisos: string[]) {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Permissão de notificação negada. Libere nas configurações do navegador.');
  const reg = await navigator.serviceWorker.register('/sw-garcom.js', { scope: '/garcom/' });
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave) }));
  await api.post(`/garcom/${rid}/inscricao${q}`, { inscricao: sub.toJSON(), nome, avisos });
}

function AvisoNotificacoes({ rid, q, chave }: { rid: string; q: string; chave: string }) {
  const [estado, setEstado] = useState<'carregando' | 'ativo' | 'inativo' | 'sem-suporte'>('carregando');
  const [ativando, setAtivando] = useState(false);
  const { avisar } = useAvisos();
  const ios = /iphone|ipad/i.test(navigator.userAgent);
  const instalado = window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    if (!suportaPush()) return setEstado('sem-suporte');
    navigator.serviceWorker
      .getRegistration('/garcom/')
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => setEstado(s && Notification.permission === 'granted' ? 'ativo' : 'inativo'))
      .catch(() => setEstado('inativo'));
  }, []);

  if (estado === 'carregando' || estado === 'ativo') return null;
  if (estado === 'sem-suporte')
    return (
      <div className="px-4 pt-4">
        <Aviso tipo="alerta" titulo="Notificações indisponíveis neste navegador">
          {ios && !instalado ? 'No iPhone: toque em Compartilhar → Adicionar à Tela de Início e abra pelo ícone.' : 'Deixe esta tela aberta para ver os avisos.'}
        </Aviso>
      </div>
    );
  return (
    <div className="px-4 pt-4">
      <Aviso
        tipo="info"
        titulo="Receba avisos com o celular bloqueado"
        acao={
          <Botao
            tamanho="p"
            icone={<Bell className="h-4 w-4" />}
            carregando={ativando}
            onClick={async () => {
              setAtivando(true);
              try {
                await inscrever(rid, q, chave, nomeSalvo.ler() || '', TIPOS_AVISO.map(([t]) => t).filter((t) => t !== 'novo'));
                setEstado('ativo');
                avisar('Avisos ativados neste celular!');
              } catch (e) {
                avisar(mensagemDe(e), 'erro');
              } finally {
                setAtivando(false);
              }
            }}
          >
            Ativar avisos
          </Botao>
        }
      >
        Pedido pronto, mesa chamando e conta.
      </Aviso>
    </div>
  );
}

function Configuracoes({ rid, q, chave, aoFechar }: { rid: string; q: string; chave: string; aoFechar: () => void }) {
  const { avisar } = useAvisos();
  const [nome, setNome] = useState(nomeSalvo.ler() || '');
  const [avisos, setAvisos] = useState<string[]>(['pronto', 'garcom', 'conta']);
  const [salvando, setSalvando] = useState(false);
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Seu celular"
      rodape={
        <div className="flex flex-wrap gap-2">
          {suportaPush() && (
            <Botao
              variante="fantasma"
              icone={<BellOff className="h-4 w-4" />}
              onClick={async () => {
                const reg = await navigator.serviceWorker.getRegistration('/garcom/');
                const sub = await reg?.pushManager.getSubscription();
                if (sub) {
                  await api.post(`/garcom/${rid}/inscricao/remover${q}`, { endpoint: sub.endpoint }).catch(() => {});
                  await sub.unsubscribe();
                }
                avisar('Avisos desativados neste celular.', 'info');
                aoFechar();
              }}
            >
              Desativar avisos
            </Botao>
          )}
          <Botao
            className="flex-1"
            carregando={salvando}
            onClick={async () => {
              setSalvando(true);
              nomeSalvo.salvar(nome.trim());
              try {
                if (suportaPush()) await inscrever(rid, q, chave, nome.trim(), avisos);
                avisar('Preferências salvas.');
                aoFechar();
              } catch (e) {
                avisar(mensagemDe(e), 'erro');
              } finally {
                setSalvando(false);
              }
            }}
          >
            Salvar
          </Botao>
        </div>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Seu nome" dica="Aparece para o gerente quando você fecha uma mesa.">
          <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        </Campo>
        <div>
          <p className="rotulo">Quero ser avisado quando</p>
          <div className="space-y-2">
            {TIPOS_AVISO.map(([t, rotulo]) => (
              <label key={t} className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[rgb(var(--marca))]"
                  checked={avisos.includes(t)}
                  onChange={(e) => setAvisos((a) => (e.target.checked ? [...a, t] : a.filter((x) => x !== t)))}
                />
                {rotulo}
                {t === 'novo' && <Selo className="ml-auto">muitos avisos</Selo>}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Janela>
  );
}
