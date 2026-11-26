import { ChevronDown, FileText, History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Botao, Carregando, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { nomeComAdicionais } from '../../lib/adicionais';
import { dataHora, hora, reais } from '../../lib/formato';
import type { ConfigFiscal, Sessao, SessaoHistorico } from '../../lib/tipos';
import { JanelaEmitirNota, STATUS_NOTA } from './compartilhado';
import { useGestao } from './contexto';

export default function Historico() {
  const { estado } = useGestao();
  const { avisar } = useAvisos();
  const [lista, setLista] = useState<SessaoHistorico[] | null>(null);
  const [limite, setLimite] = useState(30);
  const [aberta, setAberta] = useState<number | null>(null);
  const [notaPara, setNotaPara] = useState<Sessao | null>(null);
  const [fiscalPronto, setFiscalPronto] = useState(false);

  useEffect(() => {
    gestao
      .get<ConfigFiscal>('/fiscal')
      .then((c) => setFiscalPronto(!c.pendencias.length))
      .catch(() => setFiscalPronto(false));
  }, []);

  const carregar = useCallback(async () => {
    try {
      setLista(await gestao.get<SessaoHistorico[]>(`/historico?limite=${limite}`));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [limite, avisar]);

  // Recarrega quando alguma mesa é fechada (o estado da gestão muda).
  const fechadas = estado?.resumoDoDia.mesasFechadas;
  useEffect(() => {
    carregar();
  }, [carregar, fechadas]);

  if (!lista) return <Carregando />;

  return (
    <>
      <Titulo titulo="Histórico" subtitulo="Contas fechadas, da mais recente para a mais antiga." />
      {!lista.length ? (
        <Vazio icone={<History />} titulo="Nenhuma conta fechada ainda" />
      ) : (
        <div className="cartao divide-y divide-stone-100 overflow-hidden">
          {lista.map((s) => {
            const nota = s.nfce;
            const podeEmitir = !nota || ['rejeitada', 'cancelada', 'inutilizada', 'substituida'].includes(nota.status);
            return (
              <div key={s.id}>
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-sm font-bold text-white">{s.mesa}</span>
                    <div className="min-w-0">
                      <p className="font-semibold">{reais(s.total)}</p>
                      <p className="truncate text-xs text-stone-500">
                        {dataHora(s.fechadaEm)} · {s.formaPagamento || 'sem forma de pagamento'}
                      </p>
                    </div>
                    <ChevronDown className={cx('ml-auto h-4 w-4 shrink-0 text-stone-400 transition', aberta === s.id && 'rotate-180')} />
                  </button>
                  <div className="shrink-0 pl-[3.25rem] sm:pl-0">
                    {nota && !podeEmitir ? (
                      <Link to={`../notas?nota=${nota.id}`}>
                        <Selo cor={STATUS_NOTA[nota.status]?.cor}>
                          NFC-e {nota.numero} · {STATUS_NOTA[nota.status]?.rotulo}
                        </Selo>
                      </Link>
                    ) : (
                      fiscalPronto && (
                      <Botao tamanho="p" variante="secundario" icone={<FileText className="h-4 w-4" />} onClick={() => setNotaPara(s)}>
                        {nota ? 'Emitir de novo' : 'Emitir nota'}
                      </Botao>
                      )
                    )}
                  </div>
                </div>
                {aberta === s.id && (
                  <div className="bg-stone-50 px-4 py-3 text-sm">
                    {s.pedidos.map((p) => (
                      <div key={p.id} className={cx('mb-2', p.status === 'cancelado' && 'line-through opacity-50')}>
                        <p className="text-xs font-semibold text-stone-500">
                          Pedido #{p.id} · {hora(p.criadoEm)} {p.clienteNome && `· ${p.clienteNome}`}
                        </p>
                        {p.itens.map((i) => (
                          <p key={i.id} className="flex justify-between">
                            <span>
                              {i.quantidade}× {nomeComAdicionais(i)}
                            </span>
                            <span>{reais(i.total)}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                    <p className="flex justify-between border-t border-stone-200 pt-2 text-stone-600">
                      <span>Subtotal {reais(s.subtotal)} {s.taxaServico > 0 ? `+ serviço ${s.taxaServicoPercentual.toLocaleString('pt-BR')}% (${reais(s.taxaServico)})` : '· sem taxa de serviço'}</span>
                      <b className="text-stone-900">{reais(s.total)}</b>
                    </p>
                    {!!s.pagamentos?.length && (
                      <div className="mt-2 rounded-lg bg-white p-2.5">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Conta dividida</p>
                        {s.pagamentos.map((p, i) => (
                          <p key={i} className="flex justify-between gap-2">
                            <span>
                              {p.nome} <span className="text-stone-500">· {p.formaPagamento}</span>
                            </span>
                            <span className="font-semibold">{reais(p.valor)}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {lista.length >= limite && (
        <div className="mt-4 text-center">
          <Botao variante="secundario" onClick={() => setLimite((l) => Math.min(200, l + 50))} disabled={limite >= 200}>
            Carregar mais
          </Botao>
        </div>
      )}
      <JanelaEmitirNota sessao={notaPara} aoFechar={() => setNotaPara(null)} aoEmitir={carregar} />
    </>
  );
}
