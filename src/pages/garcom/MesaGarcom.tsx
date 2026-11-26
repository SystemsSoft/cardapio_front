import { ArrowLeft, BellRing, Check, ChevronDown, NotebookPen, QrCode as QrCodeIcon, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgora } from '../../components/comuns';
import { Aviso, Botao, Selo, cx, useAvisos } from '../../components/ui';
import { api, mensagemDe } from '../../lib/api';
import { nomeComAdicionais, textoAdicionais } from '../../lib/adicionais';
import { ROTULO_STATUS, reais, tempoDesde } from '../../lib/formato';
import type { MesaGestao, Pedido } from '../../lib/tipos';

const COR_STATUS = { recebido: 'azul', preparando: 'amarelo', pronto: 'verde', entregue: 'cinza', cancelado: 'vermelho' } as const;

/**
 * Mesa ocupada em tela cheia: todos os pedidos da conta, com cada item marcável como entregue.
 * Em andamento primeiro (o mais antigo no topo, que é quem espera há mais tempo), depois os já entregues.
 */
export default function MesaGarcom({
  rid,
  q,
  mesa,
  recarregar,
  aoSair,
  aoFazerPedido,
  aoMostrarQr,
  aoFecharConta,
}: {
  rid: string;
  q: string;
  mesa: MesaGestao;
  recarregar: () => Promise<void>;
  aoSair: () => void;
  aoFazerPedido: () => void;
  aoMostrarQr: () => void;
  aoFecharConta: () => void;
}) {
  const { avisar } = useAvisos();
  const agora = useAgora(20000);
  // Marcação otimista: o item muda na hora; a lista do servidor confirma em seguida.
  const [otimista, setOtimista] = useState<Record<number, boolean>>({});
  const [verEntregues, setVerEntregues] = useState(false);

  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"]') && aoSair();
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [aoSair]);

  const sessao = mesa.sessao;
  const pedidos = sessao?.pedidos ?? [];
  const entregue = (id: number, servidor: boolean | undefined) => otimista[id] ?? !!servidor;
  const pendentes = (p: Pedido) => p.itens.filter((i) => !entregue(i.id, i.entregue));

  const ativos = pedidos.filter((p) => p.status !== 'cancelado');
  const emAndamento = ativos.filter((p) => pendentes(p).length > 0);
  const concluidos = ativos.filter((p) => pendentes(p).length === 0);
  const cancelados = pedidos.filter((p) => p.status === 'cancelado');
  const totalItens = ativos.reduce((s, p) => s + p.itens.reduce((n, i) => n + i.quantidade, 0), 0);
  const itensEntregues = ativos.reduce((s, p) => s + p.itens.filter((i) => entregue(i.id, i.entregue)).reduce((n, i) => n + i.quantidade, 0), 0);

  const marcar = async (ids: number[], valor: boolean) => {
    setOtimista((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, valor])) }));
    try {
      for (const id of ids) await api.post(`/garcom/${rid}/itens/${id}/entregue${q}`, { entregue: valor });
      await recarregar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
      await recarregar();
    } finally {
      setOtimista((o) => {
        const resto = { ...o };
        ids.forEach((id) => delete resto[id]);
        return resto;
      });
    }
  };

  const atender = async () => {
    try {
      await api.post(`/garcom/${rid}/mesas/${mesa.numero}/atender${q}`);
      avisar(`Mesa ${mesa.numero}: atendida.`);
      recarregar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-fundo" role="region" aria-label={`Mesa ${mesa.numero}`}>
      <div className="mx-auto min-h-full max-w-2xl pb-32">
        <header className="pt-seguro sticky top-0 z-10 bg-marca text-white shadow">
          <div className="flex items-center gap-3 px-4 py-3">
            <button type="button" onClick={aoSair} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15" aria-label="Voltar para as mesas">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">Mesa {mesa.numero}</h1>
              <p className="truncate text-xs font-medium opacity-80">
                {sessao ? `Aberta ${tempoDesde(sessao.abertaEm, agora)} · ${ativos.length} ${ativos.length === 1 ? 'pedido' : 'pedidos'}` : 'Mesa livre'}
              </p>
            </div>
            {sessao && (
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">Conta</p>
                <p className="text-lg font-extrabold tabular-nums">{reais(sessao.total)}</p>
              </div>
            )}
          </div>
          {totalItens > 0 && (
            <div className="px-4 pb-3">
              <div className="mb-1 flex justify-between text-xs font-medium opacity-90">
                <span>Entregues na mesa</span>
                <span className="tabular-nums">
                  {itensEntregues} de {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${(itensEntregues / totalItens) * 100}%` }} />
              </div>
            </div>
          )}
        </header>

        <div className="space-y-4 px-4 pt-4">
          {sessao?.garcomChamadoEm && (
            <Aviso
              tipo="alerta"
              titulo={`Chamando o garçom ${tempoDesde(sessao.garcomChamadoEm, agora)}`}
              acao={
                <Botao tamanho="p" icone={<BellRing className="h-4 w-4" />} onClick={atender}>
                  Atendi
                </Botao>
              }
            >
              A mesa pediu atendimento.
            </Aviso>
          )}
          {sessao?.status === 'fechamento_solicitado' && (
            <Aviso
              tipo="info"
              titulo={`Pediu a conta ${tempoDesde(sessao.fechamentoSolicitadoEm, agora)}`}
              acao={
                <Botao tamanho="p" variante="escuro" onClick={aoFecharConta}>
                  Fechar
                </Botao>
              }
            >
              Total de {reais(sessao.total)}.
            </Aviso>
          )}

          {!sessao ? (
            <p className="py-16 text-center text-stone-500">Esta mesa foi liberada.</p>
          ) : !ativos.length && !cancelados.length ? (
            <p className="py-16 text-center text-stone-500">Nenhum pedido nesta mesa ainda.</p>
          ) : (
            <>
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Em andamento{emAndamento.length ? ` · ${emAndamento.length}` : ''}</h2>
                {emAndamento.length ? (
                  <div className="space-y-3">
                    {emAndamento.map((p) => (
                      <CartaoPedido key={p.id} pedido={p} agora={agora} entregue={entregue} aoMarcar={marcar} />
                    ))}
                  </div>
                ) : (
                  <p className="cartao flex items-center gap-2 p-4 text-sm text-stone-600">
                    <Check className="h-5 w-5 text-emerald-600" />
                    Tudo entregue nesta mesa.
                  </p>
                )}
              </section>

              {concluidos.length > 0 && (
                <section>
                  <button
                    type="button"
                    onClick={() => setVerEntregues((v) => !v)}
                    className="mb-2 flex w-full items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-500"
                    aria-expanded={verEntregues}
                  >
                    Entregues · {concluidos.length}
                    <ChevronDown className={cx('h-4 w-4 transition', verEntregues && 'rotate-180')} />
                  </button>
                  {verEntregues && (
                    <div className="space-y-3">
                      {concluidos.map((p) => (
                        <CartaoPedido key={p.id} pedido={p} agora={agora} entregue={entregue} aoMarcar={marcar} />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {cancelados.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">Cancelados · {cancelados.length}</h2>
                  <ul className="cartao divide-y divide-stone-100 opacity-60">
                    {cancelados.map((p) => (
                      <li key={p.id} className="px-4 py-2.5 text-sm line-through">
                        <b>{p.clienteNome || `Pedido #${p.id}`}</b> · {p.itens.map((i) => `${i.quantidade}× ${nomeComAdicionais(i)}`).join(', ')}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <div className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
          <Botao tamanho="g" className="min-w-0 flex-1" icone={<NotebookPen className="h-5 w-5" />} onClick={aoFazerPedido}>
            Fazer pedido
          </Botao>
          <button
            type="button"
            onClick={aoMostrarQr}
            aria-label="Mostrar QR Code da mesa"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-800 shadow-sm transition active:scale-[.98]"
          >
            <QrCodeIcon className="h-5 w-5" />
          </button>
          {sessao && (
            <Botao tamanho="g" variante="escuro" className="shrink-0" icone={<Receipt className="h-5 w-5" />} onClick={aoFecharConta}>
              Conta
            </Botao>
          )}
        </div>
      </div>
    </div>
  );
}

function CartaoPedido({
  pedido: p,
  agora,
  entregue,
  aoMarcar,
}: {
  pedido: Pedido;
  agora: number;
  entregue: (id: number, servidor: boolean | undefined) => boolean;
  aoMarcar: (ids: number[], valor: boolean) => void;
}) {
  const faltam = p.itens.filter((i) => !entregue(i.id, i.entregue));
  const parcial = faltam.length > 0 && faltam.length < p.itens.length;
  return (
    <article className={cx('cartao overflow-hidden', p.status === 'pronto' && faltam.length > 0 && 'ring-2 ring-emerald-400')}>
      <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{p.clienteNome || `Pedido #${p.id}`}</p>
          <p className="text-xs text-stone-500">
            #{p.id} · {tempoDesde(p.criadoEm, agora)} · {reais(p.total)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Selo cor={COR_STATUS[p.status]}>{p.status === 'pronto' && faltam.length ? 'Pronto para servir' : ROTULO_STATUS[p.status]}</Selo>
          {parcial && (
            <span className="text-[11px] font-semibold text-stone-500">
              {p.itens.length - faltam.length} de {p.itens.length} entregues
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y divide-stone-100">
        {p.itens.map((i) => {
          const ok = entregue(i.id, i.entregue);
          return (
            <li key={i.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={ok}
                onClick={() => aoMarcar([i.id], !ok)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition active:bg-stone-50"
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition',
                    ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white',
                  )}
                >
                  {ok && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block font-semibold leading-tight', ok && 'text-stone-400 line-through')}>
                    {i.quantidade}× {i.nome}
                  </span>
                  {!!i.adicionais?.length && <span className={cx('block text-xs font-semibold text-sky-800', ok && 'text-stone-400')}>{textoAdicionais(i.adicionais)}</span>}
                  {i.observacao && <span className="block truncate text-xs text-amber-700">“{i.observacao}”</span>}
                </span>
                <span className={cx('text-xs font-semibold', ok ? 'text-emerald-700' : 'text-stone-400')}>{ok ? 'Entregue' : 'Entregar'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {p.observacao && <p className="border-t border-stone-100 bg-amber-50/60 px-4 py-2 text-xs text-amber-800">Obs.: {p.observacao}</p>}
      {faltam.length > 1 && (
        <div className="border-t border-stone-100 px-4 py-2.5">
          <Botao tamanho="p" variante="sucesso" icone={<Check className="h-4 w-4" />} onClick={() => aoMarcar(faltam.map((i) => i.id), true)}>
            Marcar tudo como entregue
          </Botao>
        </div>
      )}
    </article>
  );
}
