import { Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Botao, Campo, Carregando, Entrada, Janela, Titulo, Vazio, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { dataHora, hojeLocal, limiteDoDia, plural, reais } from '../../lib/formato';
import type { Fechamento, Sessao } from '../../lib/tipos';

interface Lista {
  fechamentos: Fechamento[];
  totais: { fechamentos: number; mesasFechadas: number; faturamentoSubtotal: number };
}

export default function Caixa() {
  const { avisar } = useAvisos();
  const [de, setDe] = useState(hojeLocal(-30));
  const [ate, setAte] = useState(hojeLocal());
  const [dados, setDados] = useState<Lista | null>(null);
  const [aberto, setAberto] = useState<Fechamento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (de) q.set('de', limiteDoDia(de));
      if (ate) q.set('ate', limiteDoDia(ate, true));
      setDados(await gestao.get<Lista>(`/turnos?${q}`));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [de, ate, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <Titulo titulo="Fechamentos de caixa" subtitulo="Cada vez que você clica em “Fechar caixa” na tela de Mesas, o período fica registrado aqui." />
      <div className="cartao mb-5 flex flex-wrap items-end gap-3 p-4">
        <Campo rotulo="De">
          <Entrada type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </Campo>
        <Campo rotulo="Até">
          <Entrada type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </Campo>
        <div className="flex gap-1">
          {[
            ['Hoje', 0],
            ['7 dias', -7],
            ['30 dias', -30],
          ].map(([r, d]) => (
            <Botao
              key={r}
              tamanho="p"
              variante="fantasma"
              onClick={() => {
                setDe(hojeLocal(Number(d)));
                setAte(hojeLocal());
              }}
            >
              {r}
            </Botao>
          ))}
        </div>
      </div>

      {!dados ? (
        <Carregando />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Bloco rotulo="Faturamento (sem serviço)" valor={reais(dados.totais.faturamentoSubtotal)} />
            <Bloco rotulo="Mesas fechadas" valor={String(dados.totais.mesasFechadas)} />
            <Bloco rotulo="Fechamentos" valor={String(dados.totais.fechamentos)} />
          </div>
          {!dados.fechamentos.length ? (
            <Vazio icone={<Wallet />} titulo="Nenhum fechamento neste período" />
          ) : (
            <div className="cartao divide-y divide-stone-100 overflow-hidden">
              {dados.fechamentos.map((f) => (
                <button key={f.id} type="button" onClick={() => setAberto(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{reais(f.faturamentoSubtotal)}</p>
                    <p className="text-xs text-stone-500">
                      {dataHora(f.abertoEm)} → {dataHora(f.fechadoEm)}
                    </p>
                  </div>
                  <span className="text-sm text-stone-600">{plural(f.mesasFechadas, 'mesa', 'mesas')}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {aberto && <MesasDoFechamento fechamento={aberto} aoFechar={() => setAberto(null)} />}
    </>
  );
}

function Bloco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-sm text-stone-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-extrabold">{valor}</p>
    </div>
  );
}

function MesasDoFechamento({ fechamento, aoFechar }: { fechamento: Fechamento; aoFechar: () => void }) {
  const [mesas, setMesas] = useState<Sessao[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    gestao
      .get<Sessao[]>(`/turnos/${fechamento.id}/mesas`)
      .then(setMesas)
      .catch((e) => setErro(mensagemDe(e)));
  }, [fechamento.id]);

  const porForma = new Map<string, number>();
  mesas?.forEach((s) => porForma.set(s.formaPagamento || 'Não informado', (porForma.get(s.formaPagamento || 'Não informado') ?? 0) + s.total));

  return (
    <Janela aberta aoFechar={aoFechar} titulo={`Caixa de ${dataHora(fechamento.abertoEm)}`}>
      {erro ? (
        <p className="text-red-600">{erro}</p>
      ) : !mesas ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-stone-50 p-4">
            <p className="mb-2 text-sm font-semibold">Por forma de pagamento (com serviço)</p>
            {[...porForma].map(([f, v]) => (
              <p key={f} className="flex justify-between text-sm">
                <span>{f}</span>
                <b>{reais(v)}</b>
              </p>
            ))}
          </div>
          <ul className="divide-y divide-stone-100 text-sm">
            {mesas.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  Mesa {s.mesa} · {dataHora(s.fechadaEm)}
                </span>
                <span className="font-semibold">{reais(s.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Janela>
  );
}
