import { Bike, ChefHat, CheckCircle2, Copy, ExternalLink, MapPin, MessageCircle, Phone, Printer, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { QrCode } from '../../components/comuns';
import { Abas, Aviso, Botao, Carregando, Entrada, Interruptor, Janela, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { textoAdicionais } from '../../lib/adicionais';
import { gestao, mensagemDe, urlBaseSalva } from '../../lib/api';
import { centavosDoTexto, reais, telefone, tempoDesde, textoDosCentavos } from '../../lib/formato';
import type { ConfigEntregas, Entrega, StatusEntrega } from '../../lib/tipos';
import { useAgora } from '../../components/comuns';
import { useGestao } from './contexto';

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

  const por = (s: StatusEntrega) =>
    entregas.filter((e) => e.status === s).sort((a, b) => (s === 'entregue' ? b.atualizadoEm.localeCompare(a.atualizadoEm) : a.criadoEm.localeCompare(b.criadoEm)));
  const cancelados = entregas.filter((e) => e.status === 'cancelado');

  return (
    <>
      <Titulo
        titulo="Entregas"
        subtitulo="Pedidos de delivery feitos pelo link e pelo QR Code de entrega. Atualiza sozinho."
        acoes={
          <Botao variante="secundario" icone={<ExternalLink className="h-4 w-4" />} onClick={() => setDivulgar(true)}>
            Link e QR Code
          </Botao>
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
            <Coluna entregas={por(aba)} agora={agora} aoMudar={mudar} />
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
                  <Coluna entregas={lista} agora={agora} aoMudar={mudar} />
                </section>
              );
            })}
          </div>
          {cancelados.length > 0 && <p className="mt-4 text-sm text-stone-500">{cancelados.length} pedido(s) cancelado(s) nas últimas 24 horas.</p>}
        </>
      )}

      {divulgar && <JanelaDivulgar link={link} restaurante={restaurante.nome} aoFechar={() => setDivulgar(false)} />}
    </>
  );
}

function ConfiguracaoEntregas({ config, aoSalvar, aoDivulgar }: { config: ConfigEntregas; aoSalvar: (c: ConfigEntregas) => void; aoDivulgar: () => void }) {
  const { avisar } = useAvisos();
  const [taxa, setTaxa] = useState(config.taxaEntrega ? textoDosCentavos(config.taxaEntrega) : '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async (ativas: boolean) => {
    const centavos = taxa.trim() ? centavosDoTexto(taxa) : 0;
    if (centavos == null) return avisar('Taxa de entrega inválida.', 'erro');
    setSalvando(true);
    try {
      const c = await gestao.put<ConfigEntregas>('/entregas/config', { ativas, taxaEntrega: centavos });
      aoSalvar(c);
      avisar(c.ativas ? 'Entregas ativas: o link de delivery já recebe pedidos.' : 'Entregas pausadas: o link avisa que não está recebendo pedidos.');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="cartao mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Interruptor ligado={config.ativas} rotulo="Receber pedidos de entrega" aoMudar={(v) => salvar(v)} />
        <div className="min-w-0">
          <p className="font-semibold">{config.ativas ? 'Recebendo pedidos de entrega' : 'Entregas pausadas'}</p>
          <p className="text-xs text-stone-500">{config.ativas ? 'O link e o QR Code de entrega estão aceitando pedidos.' : 'Quem abrir o link vê que o restaurante não está entregando agora.'}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="rotulo">Taxa de entrega</span>
          <div className="relative w-32">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">R$</span>
            <Entrada id="taxa-entrega" value={taxa} onChange={(e) => setTaxa(e.target.value)} inputMode="decimal" placeholder="grátis" className="pl-9" />
          </div>
        </label>
        <Botao variante="secundario" carregando={salvando} onClick={() => salvar(config.ativas)}>
          Salvar taxa
        </Botao>
        <Botao variante="fantasma" onClick={aoDivulgar}>
          Ver link
        </Botao>
      </div>
    </section>
  );
}

function Coluna({ entregas, agora, aoMudar }: { entregas: Entrega[]; agora: number; aoMudar: (e: Entrega, s: StatusEntrega) => void }) {
  if (!entregas.length) return <p className="py-8 text-center text-sm text-stone-400">Nada por aqui</p>;
  return (
    <div className="space-y-3">
      {entregas.map((e) => (
        <CartaoEntrega key={e.id} entrega={e} agora={agora} aoMudar={aoMudar} />
      ))}
    </div>
  );
}

function CartaoEntrega({ entrega: e, agora, aoMudar }: { entrega: Entrega; agora: number; aoMudar: (e: Entrega, s: StatusEntrega) => void }) {
  const proximo = PROXIMO[e.status];
  const fone = e.telefone.replace(/\D/g, '');
  return (
    <article className="cartao overflow-hidden">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <span className="rounded-lg bg-violet-600 px-2 py-0.5 text-xs font-bold text-white">Entrega #{e.id}</span>
        <span className="ml-auto text-xs text-stone-500">{tempoDesde(e.criadoEm, agora)}</span>
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
          <span className="break-words">
            {e.endereco}
            {e.complemento && ` · ${e.complemento}`}
            {e.bairro && ` · ${e.bairro}`}
            {e.referencia && <span className="block text-xs text-stone-500">Ref.: {e.referencia}</span>}
          </span>
        </p>
      </div>
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
        {e.taxaEntrega > 0 && <span className="text-xs text-stone-500">inclui entrega {reais(e.taxaEntrega)}</span>}
      </div>
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
