import { ArrowDownCircle, ArrowUpCircle, Boxes, History, Scale, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagemProduto } from '../../components/comuns';
import { Abas, Aviso, Botao, Campo, Carregando, Entrada, Interruptor, Janela, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { dataHora } from '../../lib/formato';
import type { ItemEstoque, MovimentoEstoque } from '../../lib/tipos';
import { useGestao } from './contexto';

type Filtro = 'todos' | 'controlados' | 'alerta' | 'livres';
type TipoMov = 'entrada' | 'perda' | 'ajuste';

export default function Estoque() {
  const { versaoCardapio } = useGestao();
  const { avisar } = useAvisos();
  const [itens, setItens] = useState<ItemEstoque[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [termo, setTermo] = useState('');
  const [mov, setMov] = useState<{ item: ItemEstoque; tipo: TipoMov } | null>(null);
  const [ativando, setAtivando] = useState<ItemEstoque | null>(null);
  const [historico, setHistorico] = useState<ItemEstoque | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await gestao.get<ItemEstoque[]>('/estoque'));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [avisar]);

  useEffect(() => {
    carregar();
  }, [carregar, versaoCardapio]);

  const lista = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (itens ?? []).filter((i) => {
      if (t && !i.nome.toLowerCase().includes(t)) return false;
      if (filtro === 'controlados') return i.controlaEstoque;
      if (filtro === 'alerta') return i.esgotado || i.estoqueBaixo;
      if (filtro === 'livres') return !i.controlaEstoque;
      return true;
    });
  }, [itens, filtro, termo]);

  if (!itens) return <Carregando />;
  const alerta = itens.filter((i) => i.esgotado || i.estoqueBaixo).length;

  const desativar = async (i: ItemEstoque) => {
    try {
      await gestao.patch(`/produtos/${i.id}/estoque`, { controlar: false });
      avisar(`${i.nome}: venda livre (sem controle de estoque).`);
      carregar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  return (
    <>
      <Titulo titulo="Estoque" subtitulo="Cada pedido dá baixa na hora. Ao zerar, o item aparece como esgotado para os clientes." />

      {alerta > 0 && (
        <Aviso tipo="alerta" className="mb-4" titulo={`${alerta} ${alerta === 1 ? 'produto precisa' : 'produtos precisam'} de reposição`}>
          Itens esgotados ou abaixo do mínimo.
        </Aviso>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Entrada value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar produto" className="pl-10" type="search" />
        </div>
        <Abas<Filtro>
          atual={filtro}
          aoMudar={setFiltro}
          abas={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'controlados', rotulo: 'Com controle', contador: itens.filter((i) => i.controlaEstoque).length },
            { valor: 'alerta', rotulo: 'Repor', contador: alerta },
            { valor: 'livres', rotulo: 'Venda livre' },
          ]}
        />
      </div>

      {!itens.length ? (
        <Vazio icone={<Boxes />} titulo="Nenhum produto no cardápio" />
      ) : (
        <div className="cartao divide-y divide-stone-100 overflow-hidden">
          {lista.map((i) => (
            <div key={i.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ImagemProduto imagem={i.imagem} nome={i.nome} className="h-12 w-12 shrink-0 rounded-xl text-[0.8rem]" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{i.nome}</p>
                  <p className="text-xs text-stone-500">
                    {i.categoria} · vendidos no período: <b>{i.vendidosHoje}</b>
                  </p>
                </div>
              </div>
              {i.controlaEstoque ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="mr-2 text-right">
                    <p className={cx('text-xl font-extrabold tabular-nums', i.esgotado ? 'text-red-600' : i.estoqueBaixo ? 'text-amber-600' : 'text-stone-900')}>{i.estoque}</p>
                    <p className="text-[11px] text-stone-500">mín. {i.estoqueMinimo}</p>
                  </div>
                  {i.esgotado ? <Selo cor="vermelho">Esgotado</Selo> : i.estoqueBaixo && <Selo cor="amarelo">Baixo</Selo>}
                  <Botao tamanho="p" variante="sucesso" icone={<ArrowUpCircle className="h-4 w-4" />} onClick={() => setMov({ item: i, tipo: 'entrada' })}>
                    Entrada
                  </Botao>
                  <Botao tamanho="p" variante="secundario" icone={<ArrowDownCircle className="h-4 w-4" />} onClick={() => setMov({ item: i, tipo: 'perda' })}>
                    Perda
                  </Botao>
                  <Botao tamanho="p" variante="secundario" icone={<Scale className="h-4 w-4" />} onClick={() => setMov({ item: i, tipo: 'ajuste' })}>
                    Contagem
                  </Botao>
                  <Botao tamanho="p" variante="fantasma" icone={<History className="h-4 w-4" />} onClick={() => setHistorico(i)}>
                    <span className="sr-only sm:not-sr-only">Histórico</span>
                  </Botao>
                  <Interruptor ligado rotulo="Controlar estoque" aoMudar={() => desativar(i)} />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-500">Venda livre</span>
                  <Interruptor ligado={false} rotulo="Controlar estoque" aoMudar={() => setAtivando(i)} />
                </div>
              )}
            </div>
          ))}
          {!lista.length && <p className="py-10 text-center text-sm text-stone-500">Nenhum produto neste filtro.</p>}
        </div>
      )}

      {mov && <JanelaMovimento {...mov} aoFechar={() => setMov(null)} aoSalvar={carregar} />}
      {ativando && <JanelaAtivar item={ativando} aoFechar={() => setAtivando(null)} aoSalvar={carregar} />}
      {historico && <JanelaHistorico item={historico} aoFechar={() => setHistorico(null)} />}
    </>
  );
}

const TITULOS: Record<TipoMov, { titulo: string; rotulo: string; dica: string }> = {
  entrada: { titulo: 'Entrada no estoque', rotulo: 'Quantidade que chegou', dica: 'Soma ao estoque atual.' },
  perda: { titulo: 'Registrar perda', rotulo: 'Quantidade perdida', dica: 'Quebra, vencimento, consumo interno… Subtrai do estoque.' },
  ajuste: { titulo: 'Contagem do estoque', rotulo: 'Quantidade contada', dica: 'Substitui o estoque atual pelo valor contado.' },
};

function JanelaMovimento({ item, tipo, aoFechar, aoSalvar }: { item: ItemEstoque; tipo: TipoMov; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useAvisos();
  const [qtd, setQtd] = useState('');
  const [obs, setObs] = useState('');
  const [minimo, setMinimo] = useState(String(item.estoqueMinimo));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const t = TITULOS[tipo];
  const n = Number(qtd);
  const novo = tipo === 'entrada' ? (item.estoque ?? 0) + n : tipo === 'perda' ? (item.estoque ?? 0) - n : n;

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={t.titulo}
      largura="max-w-md"
      rodape={
        <Botao
          largo
          carregando={salvando}
          disabled={qtd === '' || !Number.isInteger(n) || n < 0}
          onClick={async () => {
            setSalvando(true);
            setErro('');
            try {
              await gestao.post(`/produtos/${item.id}/estoque/movimentos`, { tipo, quantidade: n, observacao: obs });
              if (Number(minimo) !== item.estoqueMinimo) await gestao.patch(`/produtos/${item.id}/estoque`, { estoqueMinimo: Number(minimo) });
              avisar(`${item.nome}: estoque agora é ${novo}.`);
              aoSalvar();
              aoFechar();
            } catch (e) {
              setErro(mensagemDe(e));
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar
        </Botao>
      }
    >
      <p className="mb-4 font-semibold">
        {item.nome} <span className="font-normal text-stone-500">· estoque atual {item.estoque}</span>
      </p>
      <div className="space-y-4">
        <Campo rotulo={t.rotulo} dica={qtd !== '' && Number.isInteger(n) ? `Estoque passa a ser ${novo}.` : t.dica}>
          <Entrada type="number" inputMode="numeric" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)} autoFocus />
        </Campo>
        <Campo rotulo="Observação (opcional)">
          <Entrada value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder={tipo === 'entrada' ? 'Ex.: nota do fornecedor 123' : 'Ex.: garrafa quebrada'} />
        </Campo>
        <Campo rotulo="Avisar quando ficar abaixo de" dica="Estoque mínimo para o alerta de reposição.">
          <Entrada type="number" inputMode="numeric" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

function JanelaAtivar({ item, aoFechar, aoSalvar }: { item: ItemEstoque; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar } = useAvisos();
  const [qtd, setQtd] = useState('');
  const [minimo, setMinimo] = useState('5');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Controlar estoque"
      largura="max-w-md"
      rodape={
        <Botao
          largo
          carregando={salvando}
          disabled={qtd === ''}
          onClick={async () => {
            setSalvando(true);
            setErro('');
            try {
              await gestao.patch(`/produtos/${item.id}/estoque`, { controlar: true, quantidade: Number(qtd), estoqueMinimo: Number(minimo) || 0 });
              avisar(`Controle de estoque ativado para ${item.nome}.`);
              aoSalvar();
              aoFechar();
            } catch (e) {
              setErro(mensagemDe(e));
            } finally {
              setSalvando(false);
            }
          }}
        >
          Ativar controle
        </Botao>
      }
    >
      <p className="mb-4 text-sm text-stone-600">
        A partir de agora cada pedido de <b>{item.nome}</b> dá baixa no estoque. Quando chegar a zero, ele aparece como esgotado.
      </p>
      <div className="space-y-4">
        <Campo rotulo="Quantidade em estoque agora">
          <Entrada type="number" inputMode="numeric" min={0} value={qtd} onChange={(e) => setQtd(e.target.value)} autoFocus />
        </Campo>
        <Campo rotulo="Estoque mínimo (alerta)">
          <Entrada type="number" inputMode="numeric" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

const ROTULO_MOV: Record<MovimentoEstoque['tipo'], string> = {
  venda: 'Venda',
  cancelamento: 'Cancelamento',
  entrada: 'Entrada',
  perda: 'Perda',
  ajuste: 'Contagem',
  controle: 'Controle',
};

function JanelaHistorico({ item, aoFechar }: { item: ItemEstoque; aoFechar: () => void }) {
  const [movs, setMovs] = useState<MovimentoEstoque[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    gestao
      .get<MovimentoEstoque[]>(`/produtos/${item.id}/estoque/movimentos?limite=100`)
      .then(setMovs)
      .catch((e) => setErro(mensagemDe(e)));
  }, [item.id]);
  return (
    <Janela aberta aoFechar={aoFechar} titulo={`Histórico · ${item.nome}`}>
      {erro ? (
        <Aviso tipo="erro">{erro}</Aviso>
      ) : !movs ? (
        <Carregando />
      ) : !movs.length ? (
        <Vazio titulo="Nenhuma movimentação" />
      ) : (
        <ul className="divide-y divide-stone-100">
          {movs.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={cx('w-12 text-right font-bold tabular-nums', m.quantidade > 0 ? 'text-emerald-600' : m.quantidade < 0 ? 'text-red-600' : 'text-stone-500')}>
                {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ROTULO_MOV[m.tipo]}</p>
                <p className="truncate text-xs text-stone-500">{m.observacao || dataHora(m.criadoEm)}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{m.saldo}</p>
                <p className="text-[11px] text-stone-500">{dataHora(m.criadoEm)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Janela>
  );
}
