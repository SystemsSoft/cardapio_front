import { Ban, Download, FileText, Printer, RefreshCw, Search, Send, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { QrCode } from '../../components/comuns';
import { Abas, AreaTexto, Aviso, Botao, Campo, Carregando, Entrada, Janela, Selo, Titulo, Vazio, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { dataHora, hojeLocal, limiteDoDia, reais } from '../../lib/formato';
import type { Cupom, Nota } from '../../lib/tipos';
import { STATUS_NOTA } from './compartilhado';

interface Lista {
  notas: Nota[];
  totais: { autorizadas: number; valor: number };
  atencao: number;
}
type Filtro = '' | 'autorizada' | 'atencao' | 'cancelada';

export default function Notas() {
  const { avisar } = useAvisos();
  const [busca, setBusca] = useSearchParams();
  const [de, setDe] = useState(hojeLocal(-7));
  const [ate, setAte] = useState(hojeLocal());
  const [filtro, setFiltro] = useState<Filtro>('');
  const [dados, setDados] = useState<Lista | null>(null);
  const [inutilizar, setInutilizar] = useState(false);
  const notaAberta = Number(busca.get('nota')) || null;

  const carregar = useCallback(async () => {
    try {
      const q = new URLSearchParams({ de: limiteDoDia(de), ate: limiteDoDia(ate, true), status: filtro });
      setDados(await gestao.get<Lista>(`/nfce?${q}`));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [de, ate, filtro, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = (id: number | null) => setBusca(id ? { nota: String(id) } : {}, { replace: true });

  return (
    <>
      <Titulo
        titulo="Notas fiscais"
        subtitulo="NFC-e emitidas direto na Sefaz."
        acoes={
          <>
            <Botao variante="secundario" icone={<Ban className="h-4 w-4" />} onClick={() => setInutilizar(true)}>
              Inutilizar números
            </Botao>
            <Link to="../nota-fiscal">
              <Botao variante="secundario">Configurar</Botao>
            </Link>
          </>
        }
      />

      <div className="cartao mb-4 flex flex-wrap items-end gap-3 p-4">
        <Campo rotulo="De">
          <Entrada type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo rotulo="Até">
          <Entrada type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <Botao variante="fantasma" icone={<Search className="h-4 w-4" />} onClick={carregar}>
          Atualizar
        </Botao>
      </div>

      <Abas<Filtro>
        className="mb-4"
        atual={filtro}
        aoMudar={setFiltro}
        abas={[
          { valor: '', rotulo: 'Todas' },
          { valor: 'autorizada', rotulo: 'Autorizadas' },
          { valor: 'atencao', rotulo: 'Precisam de atenção', contador: dados?.atencao },
          { valor: 'cancelada', rotulo: 'Canceladas' },
        ]}
      />

      {!dados ? (
        <Carregando />
      ) : (
        <>
          {dados.atencao > 0 && filtro !== 'atencao' && (
            <Aviso tipo="alerta" className="mb-4" titulo={`${dados.atencao} nota(s) precisam de atenção`} acao={<Botao tamanho="p" variante="secundario" onClick={() => setFiltro('atencao')}>Ver</Botao>}>
              Recusadas pela Sefaz ou aguardando envio.
            </Aviso>
          )}
          <p className="mb-3 text-sm text-stone-600">
            <b>{dados.totais.autorizadas}</b> autorizadas no período · <b>{reais(dados.totais.valor)}</b>
          </p>
          {!dados.notas.length ? (
            <Vazio icone={<FileText />} titulo="Nenhuma nota neste período" />
          ) : (
            <div className="cartao divide-y divide-stone-100 overflow-hidden">
              {dados.notas.map((n) => (
                <button key={n.id} type="button" onClick={() => abrir(n.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      Nº {n.numero} <span className="font-normal text-stone-500">série {n.serie}</span>
                      {n.mesa != null && <span className="font-normal text-stone-500"> · Mesa {n.mesa}</span>}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {dataHora(n.criadaEm)}
                      {n.motivo && n.status !== 'autorizada' && ` · ${n.motivo}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold">{reais(n.valor)}</span>
                    <div className="flex gap-1">
                      {n.ambiente === 2 && <Selo cor="roxo">Homologação</Selo>}
                      <Selo cor={STATUS_NOTA[n.status]?.cor}>{STATUS_NOTA[n.status]?.rotulo ?? n.status}</Selo>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {notaAberta && <DetalheNota id={notaAberta} aoFechar={() => abrir(null)} aoMudar={carregar} />}
      {inutilizar && <JanelaInutilizar aoFechar={() => setInutilizar(false)} />}
    </>
  );
}

function DetalheNota({ id, aoFechar, aoMudar }: { id: number; aoFechar: () => void; aoMudar: () => void }) {
  const { avisar, confirmar } = useAvisos();
  const [nota, setNota] = useState<(Nota & { cupom: Cupom | null }) | null>(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  const carregar = useCallback(() => {
    gestao
      .get<Nota & { cupom: Cupom | null }>(`/nfce/${id}`)
      .then(setNota)
      .catch((e) => setErro(mensagemDe(e)));
  }, [id]);
  useEffect(carregar, [carregar]);

  const acao = async (nome: string, fn: () => Promise<unknown>, msg: string) => {
    setOcupado(nome);
    try {
      await fn();
      avisar(msg);
      carregar();
      aoMudar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado('');
    }
  };

  const c = nota?.cupom;

  return (
    <Janela aberta aoFechar={aoFechar} titulo={nota ? `NFC-e nº ${nota.numero}` : 'Nota fiscal'} largura="max-w-xl">
      {erro ? (
        <Aviso tipo="erro">{erro}</Aviso>
      ) : !nota ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Selo cor={STATUS_NOTA[nota.status]?.cor}>{STATUS_NOTA[nota.status]?.rotulo ?? nota.status}</Selo>
            {nota.ambiente === 2 && <Selo cor="roxo">Homologação (sem valor fiscal)</Selo>}
            {nota.teste && <Selo>Nota de teste</Selo>}
          </div>
          {nota.motivo && nota.status !== 'autorizada' && <Aviso tipo={nota.status === 'rejeitada' ? 'erro' : 'alerta'}>{nota.cStat ? `${nota.cStat} · ` : ''}{nota.motivo}</Aviso>}
          {nota.cancelamentoMotivo && <Aviso>Cancelada: {nota.cancelamentoMotivo}</Aviso>}

          {c && (
            <div id="cupom" className="mx-auto max-w-[340px] rounded-xl border border-stone-200 bg-white p-4 font-mono text-[11px] leading-relaxed text-stone-800">
              <p className="text-center font-bold">{c.emitente.nomeFantasia || c.emitente.razaoSocial}</p>
              <p className="text-center">{c.emitente.razaoSocial}</p>
              <p className="text-center">CNPJ {c.emitente.cnpj} · IE {c.emitente.ie}</p>
              <p className="text-center">{c.emitente.endereco}</p>
              <p className="my-2 border-y border-dashed border-stone-300 py-1 text-center font-bold">DANFE NFC-e — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
              {c.itens.map((i, k) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="truncate">
                    {i.quantidade} {i.unidade} {i.nome}
                  </span>
                  <span>{reais(i.total)}</span>
                </div>
              ))}
              <div className="mt-2 border-t border-dashed border-stone-300 pt-1">
                <p className="flex justify-between">
                  <span>Qtd. itens</span>
                  <span>{c.itens.length}</span>
                </p>
                {c.totais.outros > 0 && (
                  <p className="flex justify-between">
                    <span>Taxa de serviço</span>
                    <span>{reais(c.totais.outros)}</span>
                  </p>
                )}
                <p className="flex justify-between font-bold">
                  <span>VALOR TOTAL</span>
                  <span>{reais(c.totais.total)}</span>
                </p>
                {c.pagamentos.map((p, k) => (
                  <p key={k} className="flex justify-between">
                    <span>{p.forma}</span>
                    <span>{reais(p.valor)}</span>
                  </p>
                ))}
                {c.troco > 0 && (
                  <p className="flex justify-between">
                    <span>Troco</span>
                    <span>{reais(c.troco)}</span>
                  </p>
                )}
                {c.totais.tributos > 0 && <p className="mt-1">Tributos aprox.: {reais(c.totais.tributos)}</p>}
              </div>
              <p className="mt-2 border-t border-dashed border-stone-300 pt-1 text-center">
                NFC-e nº {c.numero} série {c.serie} · {dataHora(c.emissao)}
              </p>
              {c.urlConsulta && <p className="break-all text-center">Consulte em {c.urlConsulta}</p>}
              <p className="break-all text-center">{c.chave.replace(/(\d{4})/g, '$1 ')}</p>
              <p className="text-center">{c.cpf ? `CONSUMIDOR CPF ${c.cpf}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</p>
              {c.protocolo && (
                <p className="text-center">
                  Protocolo {c.protocolo} · {dataHora(c.autorizadaEm)}
                </p>
              )}
              {c.qrcode && (
                <div className="mt-2 flex justify-center">
                  <QrCode texto={c.qrcode} tamanho={140} />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {c && (
              <Botao variante="secundario" tamanho="p" icone={<Printer className="h-4 w-4" />} onClick={() => imprimirCupom()}>
                Imprimir
              </Botao>
            )}
            {nota.chave && (
              <Botao variante="secundario" tamanho="p" icone={<Download className="h-4 w-4" />} onClick={() => gestao.baixar(`/nfce/${nota.id}/xml`, `NFCe${nota.chave}.xml`).catch((e) => avisar(mensagemDe(e), 'erro'))}>
                XML
              </Botao>
            )}
            {['enviando', 'incerta', 'contingencia'].includes(nota.status) && (
              <Botao variante="secundario" tamanho="p" icone={<RefreshCw className="h-4 w-4" />} carregando={ocupado === 'consultar'} onClick={() => acao('consultar', () => gestao.post(`/nfce/${nota.id}/consultar`), 'Situação consultada na Sefaz.')}>
                Consultar Sefaz
              </Botao>
            )}
            {nota.status === 'contingencia' && (
              <Botao tamanho="p" icone={<Send className="h-4 w-4" />} carregando={ocupado === 'transmitir'} onClick={() => acao('transmitir', () => gestao.post(`/nfce/${nota.id}/transmitir`), 'Nota transmitida.')}>
                Transmitir agora
              </Botao>
            )}
            {nota.status === 'rejeitada' && (
              <>
                <Botao tamanho="p" icone={<RefreshCw className="h-4 w-4" />} carregando={ocupado === 'reemitir'} onClick={() => acao('reemitir', () => gestao.post(`/nfce/${nota.id}/reemitir`), 'Nova tentativa enviada.')}>
                  Tentar de novo
                </Botao>
                <Botao
                  variante="secundario"
                  tamanho="p"
                  icone={<Ban className="h-4 w-4" />}
                  carregando={ocupado === 'inutilizar'}
                  onClick={async () => {
                    if (await confirmar({ titulo: `Inutilizar o número ${nota.numero}?`, texto: 'Desiste desta nota e avisa a Sefaz que o número não será usado.', confirmar: 'Inutilizar', perigo: true }))
                      acao('inutilizar', () => gestao.post(`/nfce/${nota.id}/inutilizar`, {}), 'Número inutilizado.');
                  }}
                >
                  Inutilizar número
                </Botao>
              </>
            )}
            {nota.status === 'autorizada' && (
              <Botao variante="perigo" tamanho="p" icone={<XCircle className="h-4 w-4" />} onClick={() => setCancelando(true)}>
                Cancelar nota
              </Botao>
            )}
          </div>

          {cancelando && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
              <Campo rotulo="Motivo do cancelamento" dica="Mínimo de 15 caracteres. A Sefaz só aceita o cancelamento dentro do prazo legal após a autorização.">
                <AreaTexto value={justificativa} onChange={(e) => setJustificativa(e.target.value)} maxLength={255} rows={2} placeholder="Ex.: Cliente desistiu da compra, nota emitida por engano" />
              </Campo>
              <Botao
                variante="perigo"
                disabled={justificativa.trim().length < 15}
                carregando={ocupado === 'cancelar'}
                onClick={() => acao('cancelar', () => gestao.post(`/nfce/${nota.id}/cancelar`, { justificativa: justificativa.trim() }), 'Nota cancelada na Sefaz.').then(() => setCancelando(false))}
              >
                Confirmar cancelamento
              </Botao>
            </div>
          )}
        </div>
      )}
    </Janela>
  );
}

function imprimirCupom() {
  const el = document.getElementById('cupom');
  if (!el) return;
  const janela = window.open('', '_blank', 'width=420,height=700');
  if (!janela) return;
  janela.document.write(
    `<html><head><title>NFC-e</title><style>body{font:11px/1.45 monospace;margin:8px;width:300px}p{margin:0}.flex{display:flex;justify-content:space-between;gap:8px}.text-center{text-align:center}.font-bold{font-weight:700}img{display:block;margin:6px auto}</style></head><body>${el.innerHTML}</body></html>`,
  );
  janela.document.close();
  janela.onload = () => {
    janela.print();
    janela.close();
  };
}

function JanelaInutilizar({ aoFechar }: { aoFechar: () => void }) {
  const { avisar } = useAvisos();
  const [serie, setSerie] = useState('1');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [just, setJust] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Inutilizar números"
      largura="max-w-md"
      rodape={
        <Botao
          largo
          variante="perigo"
          carregando={enviando}
          disabled={!inicio || just.trim().length < 15}
          onClick={async () => {
            setEnviando(true);
            setErro('');
            try {
              const r = await gestao.post<{ protocolo: string }>('/nfce/inutilizar', { serie: Number(serie), inicio: Number(inicio), fim: Number(fim || inicio), justificativa: just.trim() });
              avisar(`Números inutilizados. Protocolo ${r.protocolo}.`);
              aoFechar();
            } catch (e) {
              setErro(mensagemDe(e));
            } finally {
              setEnviando(false);
            }
          }}
        >
          Inutilizar na Sefaz
        </Botao>
      }
    >
      <p className="mb-4 text-sm text-stone-600">Use quando uma sequência de números foi pulada e nunca será usada (ex.: falha do sistema).</p>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Campo rotulo="Série">
            <Entrada type="number" value={serie} onChange={(e) => setSerie(e.target.value)} />
          </Campo>
          <Campo rotulo="Do número">
            <Entrada type="number" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
          <Campo rotulo="Até">
            <Entrada type="number" value={fim} onChange={(e) => setFim(e.target.value)} placeholder={inicio} />
          </Campo>
        </div>
        <Campo rotulo="Justificativa" dica="Mínimo de 15 caracteres.">
          <AreaTexto value={just} onChange={(e) => setJust(e.target.value)} rows={2} maxLength={255} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
