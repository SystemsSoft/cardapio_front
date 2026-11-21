import { BellRing, Clock, Lock, Receipt, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAgora } from '../../components/comuns';
import { Abas, Aviso, Botao, Carregando, Janela, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { FORMAS_PAGAMENTO, dataHora, plural, reais, tempoDesde } from '../../lib/formato';
import type { ConfigFiscal, Fechamento, MesaGestao, Sessao } from '../../lib/tipos';
import { CartaoPedido, JanelaEmitirNota } from './compartilhado';
import { useGestao } from './contexto';

type Filtro = 'todas' | 'ocupadas' | 'alertas' | 'livres';

function situacao(m: MesaGestao) {
  const s = m.sessao;
  if (!s) return { tipo: 'livre' as const, rotulo: 'Livre' };
  if (s.garcomChamadoEm) return { tipo: 'chamando' as const, rotulo: 'Chamando' };
  if (s.status === 'fechamento_solicitado') return { tipo: 'conta' as const, rotulo: 'Pediu a conta' };
  if (s.pedidos.some((p) => p.status === 'pronto')) return { tipo: 'pronto' as const, rotulo: 'Pedido pronto' };
  return { tipo: 'ocupada' as const, rotulo: 'Ocupada' };
}

const ESTILO = {
  livre: 'border-dashed border-stone-300 bg-white/60 text-stone-400',
  ocupada: 'border-stone-200 bg-white',
  pronto: 'border-emerald-300 bg-emerald-50',
  conta: 'border-sky-300 bg-sky-50',
  chamando: 'border-marca bg-marca-clara animate-pulsar',
};

export default function Mesas() {
  const { estado, recarregarEstado } = useGestao();
  const { avisar, confirmar } = useAvisos();
  const agora = useAgora();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [aberta, setAberta] = useState<number | null>(null);
  const [notaPara, setNotaPara] = useState<Sessao | null>(null);
  const [fechandoCaixa, setFechandoCaixa] = useState(false);
  const [fiscalPronto, setFiscalPronto] = useState(false);

  // Só oferece a NFC-e ao fechar a conta se a nota fiscal já estiver configurada.
  useEffect(() => {
    gestao
      .get<ConfigFiscal>('/fiscal')
      .then((c) => setFiscalPronto(!c.pendencias.length))
      .catch(() => setFiscalPronto(false));
  }, []);

  if (!estado) return <Carregando />;

  const mesas = estado.mesas;
  const ocupadas = mesas.filter((m) => m.sessao);
  const alertas = mesas.filter((m) => ['chamando', 'conta'].includes(situacao(m).tipo));
  const lista = { todas: mesas, ocupadas, alertas, livres: mesas.filter((m) => !m.sessao) }[filtro];
  const mesaAberta = mesas.find((m) => m.numero === aberta) ?? null;
  const emAberto = ocupadas.reduce((s, m) => s + (m.sessao?.total ?? 0), 0);
  const r = estado.resumoDoDia;

  const fecharCaixa = async () => {
    if (
      !(await confirmar({
        titulo: 'Fechar o caixa?',
        texto: (
          <>
            O período atual ({plural(r.mesasFechadas, 'mesa fechada', 'mesas fechadas')}, {reais(r.faturamentoSubtotal)}) fica salvo em
            Fechamentos de caixa e a contagem recomeça do zero agora.
            {ocupadas.length > 0 && <b className="mt-2 block text-amber-700">Ainda há {plural(ocupadas.length, 'mesa aberta', 'mesas abertas')} — elas entram no próximo período.</b>}
          </>
        ),
        confirmar: 'Fechar caixa',
      }))
    )
      return;
    setFechandoCaixa(true);
    try {
      const f = await gestao.post<Fechamento>('/turno/fechar');
      avisar(`Caixa fechado: ${reais(f.faturamentoSubtotal)} em ${plural(f.mesasFechadas, 'mesa', 'mesas')}.`);
      recarregarEstado();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setFechandoCaixa(false);
    }
  };

  return (
    <>
      <Titulo titulo="Mesas" subtitulo={`${ocupadas.length} de ${mesas.length} ocupadas`} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Resumo rotulo="Vendido no período" valor={reais(r.faturamentoSubtotal)} detalhe={`${plural(r.mesasFechadas, 'mesa fechada', 'mesas fechadas')} · desde ${dataHora(r.abertoEm)}`} />
        <Resumo rotulo="Em aberto nas mesas" valor={reais(emAberto)} detalhe={plural(ocupadas.length, 'mesa ocupada', 'mesas ocupadas')} />
        <div className="cartao flex flex-col justify-between gap-3 p-4">
          <p className="text-sm text-stone-500">Caixa</p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="escuro" icone={<Lock className="h-4 w-4" />} carregando={fechandoCaixa} onClick={fecharCaixa}>
              Fechar caixa
            </Botao>
            <Link to="../caixa">
              <Botao variante="secundario" icone={<Wallet className="h-4 w-4" />}>
                Anteriores
              </Botao>
            </Link>
          </div>
        </div>
      </div>

      <Abas<Filtro>
        className="mb-4"
        atual={filtro}
        aoMudar={setFiltro}
        abas={[
          { valor: 'todas', rotulo: 'Todas', contador: mesas.length },
          { valor: 'ocupadas', rotulo: 'Ocupadas', contador: ocupadas.length },
          { valor: 'alertas', rotulo: 'Precisam de atenção', contador: alertas.length },
          { valor: 'livres', rotulo: 'Livres' },
        ]}
      />

      {!mesas.length ? (
        <Vazio titulo="Nenhuma mesa cadastrada">
          Crie mesas em <Link to="../qrcodes" className="font-semibold text-marca">QR Codes</Link>.
        </Vazio>
      ) : !lista.length ? (
        <Vazio titulo="Nenhuma mesa aqui" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {lista.map((m) => {
            const st = situacao(m);
            const s = m.sessao;
            const itens = s?.pedidos.filter((p) => p.status !== 'cancelado').reduce((n, p) => n + p.itens.reduce((a, i) => a + i.quantidade, 0), 0) ?? 0;
            return (
              <button
                key={m.numero}
                type="button"
                onClick={() => setAberta(m.numero)}
                className={cx('flex min-h-[120px] flex-col rounded-2xl border-2 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-cartao', ESTILO[st.tipo])}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={cx('text-2xl font-extrabold', !s && 'text-stone-400')}>{m.numero}</span>
                  {st.tipo === 'chamando' && <BellRing className="h-5 w-5 text-marca" />}
                  {st.tipo === 'conta' && <Receipt className="h-5 w-5 text-sky-600" />}
                </div>
                <span className={cx('text-xs font-bold uppercase tracking-wide', { livre: 'text-stone-400', ocupada: 'text-stone-500', pronto: 'text-emerald-700', conta: 'text-sky-700', chamando: 'text-marca-escura' }[st.tipo])}>
                  {st.rotulo}
                </span>
                {s && (
                  <div className="mt-auto pt-2">
                    <p className="font-bold text-stone-900">{reais(s.total)}</p>
                    <p className="flex items-center gap-1 text-xs text-stone-500">
                      <Clock className="h-3 w-3" />
                      {tempoDesde(s.abertaEm, agora)} · {plural(itens, 'item', 'itens')}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {mesaAberta && (
        <DetalheMesa
          mesa={mesaAberta}
          aoFechar={() => setAberta(null)}
          aoFecharConta={(s) => {
            setAberta(null);
            if (fiscalPronto) setNotaPara(s);
          }}
        />
      )}
      <JanelaEmitirNota sessao={notaPara} aoFechar={() => setNotaPara(null)} />
    </>
  );
}

function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-sm text-stone-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{valor}</p>
      <p className="mt-0.5 text-xs text-stone-500">{detalhe}</p>
    </div>
  );
}

function DetalheMesa({ mesa, aoFechar, aoFecharConta }: { mesa: MesaGestao; aoFechar: () => void; aoFecharConta: (s: Sessao) => void }) {
  const { avisar } = useAvisos();
  const [forma, setForma] = useState<string>('');
  const [fechando, setFechando] = useState(false);
  const [modoFechar, setModoFechar] = useState(false);
  const s = mesa.sessao;

  const atender = async () => {
    try {
      await gestao.post(`/mesas/${mesa.numero}/atender`);
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  const fechar = async () => {
    setFechando(true);
    try {
      const resumo = await gestao.post<Sessao>(`/mesas/${mesa.numero}/fechar`, { formaPagamento: forma });
      avisar(`Mesa ${mesa.numero} fechada · ${reais(resumo.total)}`);
      aoFecharConta(resumo);
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setFechando(false);
    }
  };

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Mesa ${mesa.numero}`}
      largura="max-w-2xl"
      rodape={
        s &&
        (modoFechar ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FORMAS_PAGAMENTO.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForma(f)}
                  className={cx('rounded-xl border px-2 py-2 text-sm font-semibold transition', forma === f ? 'border-marca bg-marca-clara text-marca-escura' : 'border-stone-200 hover:bg-stone-50')}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setModoFechar(false)}>
                Voltar
              </Botao>
              <Botao largo variante="sucesso" disabled={!forma} carregando={fechando} onClick={fechar}>
                Confirmar · {reais(s.total)}
              </Botao>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {s.garcomChamadoEm && (
              <Botao variante="secundario" icone={<BellRing className="h-4 w-4" />} onClick={atender}>
                Chamado atendido
              </Botao>
            )}
            <Botao className="flex-1" variante="escuro" icone={<Receipt className="h-4 w-4" />} onClick={() => setModoFechar(true)}>
              Fechar conta · {reais(s.total)}
            </Botao>
          </div>
        ))
      }
    >
      {!s ? (
        <Vazio titulo="Mesa livre">Quando um cliente fizer o primeiro pedido pelo QR Code, a comanda abre aqui.</Vazio>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Selo>Aberta {tempoDesde(s.abertaEm)}</Selo>
            {s.garcomChamadoEm && <Selo cor="marca">🙋 Chamando {tempoDesde(s.garcomChamadoEm)}</Selo>}
            {s.status === 'fechamento_solicitado' && <Selo cor="azul">🧾 Pediu a conta {tempoDesde(s.fechamentoSolicitadoEm)}</Selo>}
          </div>
          {!s.pedidos.length && <Aviso>Nenhum pedido ainda — a mesa chamou o garçom.</Aviso>}
          <div className="space-y-3">
            {[...s.pedidos].reverse().map((p) => (
              <CartaoPedido key={p.id} pedido={p} mostrarMesa={false} compacto />
            ))}
          </div>
          <dl className="space-y-1 rounded-xl bg-stone-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd>{reais(s.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Serviço ({s.taxaServicoPercentual}%)</dt>
              <dd>{reais(s.taxaServico)}</dd>
            </div>
            <div className="flex justify-between text-base font-bold">
              <dt>Total</dt>
              <dd>{reais(s.total)}</dd>
            </div>
          </dl>
        </div>
      )}
    </Janela>
  );
}
