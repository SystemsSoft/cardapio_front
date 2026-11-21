import { Plus, Split, Trash2, Users } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { FORMAS_PAGAMENTO, centavosDoTexto, reais, textoDosCentavos } from '../lib/formato';
import type { Sessao } from '../lib/tipos';
import { Abas, Aviso, Botao, Entrada, Janela, Selecao, cx } from './ui';

export interface PagamentoDividido {
  nome: string;
  formaPagamento: string;
  valor: number;
}

export type DadosFechamento = { formaPagamento: string } | { pagamentos: PagamentoDividido[] };

type ModoDivisao = 'consumo' | 'igual' | 'personalizado';
interface Linha {
  id: number;
  nome: string;
  forma: string;
  valor: string; // texto do campo (R$)
  consumo?: number;
}

let proximoId = 1;

/** Quanto cada nome consumiu (pedidos não cancelados) + a parte proporcional da taxa de serviço. */
function consumoPorPessoa(sessao: Sessao) {
  const mapa = new Map<string, number>();
  for (const p of sessao.pedidos) {
    if (p.status === 'cancelado') continue;
    const nome = p.clienteNome?.trim() || 'Sem nome';
    mapa.set(nome, (mapa.get(nome) ?? 0) + p.total);
  }
  const pessoas = [...mapa].map(([nome, consumo]) => ({ nome, consumo, comServico: consumo }));
  const subtotal = pessoas.reduce((s, p) => s + p.consumo, 0) || 1;
  let distribuido = 0;
  for (const p of pessoas) {
    const parte = Math.round((sessao.taxaServico * p.consumo) / subtotal);
    p.comServico = p.consumo + parte;
    distribuido += parte;
  }
  // Sobra do arredondamento da taxa vai para quem consumiu mais.
  const maior = pessoas.reduce((a, b) => (b.consumo > a.consumo ? b : a), pessoas[0]);
  if (maior) maior.comServico += sessao.taxaServico - distribuido;
  return pessoas;
}

function dividirIgual(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0));
}

function juntarNomes(nomes: string[]) {
  return nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Fechamento da conta da mesa: pagar tudo junto (uma forma de pagamento) ou dividir entre as pessoas
 * — por consumo, em partes iguais ou com valores personalizados, cada um com a sua forma de pagamento.
 * Quando a mesa tem pedidos de 2 ou mais nomes, a divisão é sugerida.
 */
export function JanelaFechamento({
  titulo,
  sessao,
  caixaAberto = true,
  avisoCaixaFechado,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string;
  sessao: Sessao;
  caixaAberto?: boolean;
  avisoCaixaFechado?: ReactNode;
  aoFechar: () => void;
  aoConfirmar: (dados: DadosFechamento) => Promise<void>;
}) {
  const pessoas = useMemo(() => consumoPorPessoa(sessao), [sessao]);
  const nomesReais = pessoas.filter((p) => p.nome !== 'Sem nome').map((p) => p.nome);
  const sugerir = pessoas.length >= 2;

  const [dividir, setDividir] = useState(false);
  const [formaJunto, setFormaJunto] = useState('');
  const [modo, setModo] = useState<ModoDivisao>('consumo');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [enviando, setEnviando] = useState(false);

  const total = sessao.total;

  const montar = (novoModo: ModoDivisao, base?: Linha[]) => {
    if (novoModo === 'consumo') {
      return pessoas.map((p) => {
        const atual = base?.find((l) => l.nome === p.nome);
        return { id: atual?.id ?? proximoId++, nome: p.nome, forma: atual?.forma ?? '', valor: textoDosCentavos(p.comServico), consumo: p.consumo };
      });
    }
    const origem = base?.length ? base : pessoas.map((p) => ({ id: proximoId++, nome: p.nome, forma: '', valor: '', consumo: p.consumo }));
    const lista = origem.length >= 2 ? origem : [...origem, ...Array.from({ length: 2 - origem.length }, (_, i) => ({ id: proximoId++, nome: `Pessoa ${origem.length + i + 1}`, forma: '', valor: '' }))];
    if (novoModo === 'igual') {
      const partes = dividirIgual(total, lista.length);
      return lista.map((l, i) => ({ ...l, valor: textoDosCentavos(partes[i]) }));
    }
    return lista;
  };

  const comecarDivisao = () => {
    const m: ModoDivisao = pessoas.length >= 2 ? 'consumo' : 'igual';
    setModo(m);
    setLinhas(montar(m));
    setDividir(true);
  };

  const trocarModo = (m: ModoDivisao) => {
    setModo(m);
    if (m !== 'personalizado') setLinhas(montar(m, linhas));
  };

  const mudarLinha = (id: number, campo: 'nome' | 'forma' | 'valor', v: string) => {
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [campo]: v } : l)));
    if (campo === 'valor') setModo('personalizado');
  };

  const adicionar = () => {
    const nova = { id: proximoId++, nome: `Pessoa ${linhas.length + 1}`, forma: '', valor: '' };
    if (modo === 'igual') setLinhas(montar('igual', [...linhas, nova]));
    else {
      setModo('personalizado');
      setLinhas([...linhas, nova]);
    }
  };

  const remover = (id: number) => {
    const resto = linhas.filter((l) => l.id !== id);
    if (modo === 'igual') setLinhas(montar('igual', resto));
    else {
      setModo('personalizado');
      setLinhas(resto);
    }
  };

  const valores = linhas.map((l) => centavosDoTexto(l.valor) ?? 0);
  const distribuido = valores.reduce((s, v) => s + v, 0);
  const diferenca = total - distribuido;
  const semForma = linhas.filter((l) => !l.forma).length;
  const semValor = valores.filter((v) => v <= 0).length;
  const divisaoOk = linhas.length >= 1 && diferenca === 0 && !semForma && !semValor;

  const ajustarRestante = () => {
    if (!linhas.length) return;
    const ultima = linhas[linhas.length - 1];
    const novo = (centavosDoTexto(ultima.valor) ?? 0) + diferenca;
    if (novo <= 0) return;
    setModo('personalizado');
    setLinhas((ls) => ls.map((l) => (l.id === ultima.id ? { ...l, valor: textoDosCentavos(novo) } : l)));
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      await aoConfirmar(
        dividir
          ? { pagamentos: linhas.map((l, i) => ({ nome: l.nome.trim() || `Pessoa ${i + 1}`, formaPagamento: l.forma, valor: valores[i] })) }
          : { formaPagamento: formaJunto },
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={titulo}
      largura="max-w-2xl"
      rodape={
        !caixaAberto ? (
          avisoCaixaFechado
        ) : (
          <div className="space-y-2">
            {dividir && diferenca !== 0 && (
              <div className={cx('flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold', diferenca > 0 ? 'bg-amber-50 text-amber-900' : 'bg-red-50 text-red-800')}>
                <span>
                  {diferenca > 0 ? 'Falta distribuir' : 'Passou do total em'} {reais(Math.abs(diferenca))}
                </span>
                {linhas.length > 0 && (centavosDoTexto(linhas[linhas.length - 1].valor) ?? 0) + diferenca > 0 && (
                  <button type="button" className="underline" onClick={ajustarRestante}>
                    Ajustar em {linhas[linhas.length - 1].nome || 'último'}
                  </button>
                )}
              </div>
            )}
            <Botao
              largo
              tamanho="g"
              variante="sucesso"
              carregando={enviando}
              disabled={dividir ? !divisaoOk : !formaJunto}
              onClick={confirmar}
            >
              {dividir ? `Fechar conta dividida · ${reais(total)}` : `Fechar conta · ${reais(total)}`}
            </Botao>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
          <div>
            <p className="text-sm text-stone-500">Total da mesa</p>
            <p className="text-2xl font-extrabold">{reais(total)}</p>
          </div>
          <p className="text-right text-xs text-stone-500">
            {reais(sessao.subtotal)} + serviço {sessao.taxaServicoPercentual}% ({reais(sessao.taxaServico)})
          </p>
        </div>

        {!dividir && sugerir && (
          <Aviso
            tipo="info"
            titulo={`Mesa com ${pessoas.length} pessoas`}
            acao={
              <Botao tamanho="p" icone={<Split className="h-4 w-4" />} onClick={comecarDivisao}>
                Dividir a conta
              </Botao>
            }
          >
            {nomesReais.length ? `${juntarNomes(nomesReais)} fizeram pedidos.` : 'Vários pedidos nesta mesa.'} Quer repartir a conta entre eles?
          </Aviso>
        )}

        <Abas<'junto' | 'dividir'>
          atual={dividir ? 'dividir' : 'junto'}
          aoMudar={(v) => (v === 'dividir' ? comecarDivisao() : setDividir(false))}
          abas={[
            { valor: 'junto', rotulo: 'Pagar tudo junto' },
            { valor: 'dividir', rotulo: <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> Dividir a conta</span> },
          ]}
        />

        {!dividir ? (
          <div>
            <p className="mb-2 text-sm font-semibold">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FORMAS_PAGAMENTO.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormaJunto(f)}
                  className={cx('rounded-xl border px-2 py-2.5 text-sm font-semibold transition', formaJunto === f ? 'border-marca bg-marca-clara text-marca-escura' : 'border-stone-200 hover:bg-stone-50')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['consumo', 'Pelo que cada um pediu', pessoas.length < 2],
                  ['igual', 'Partes iguais', false],
                  ['personalizado', 'Personalizado', false],
                ] as const
              ).map(([valor, rotulo, desativado]) => (
                <button
                  key={valor}
                  type="button"
                  disabled={desativado}
                  onClick={() => trocarModo(valor)}
                  className={cx(
                    'rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition disabled:opacity-40',
                    modo === valor ? 'bg-marca text-white ring-marca' : 'bg-white text-stone-700 ring-stone-200 hover:bg-stone-50',
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            {modo === 'consumo' && <p className="text-xs text-stone-500">Cada um paga o que pediu, mais a sua parte da taxa de serviço.</p>}

            <ul className="space-y-2">
              {linhas.map((l) => (
                <li key={l.id} className="rounded-xl border border-stone-200 bg-white p-3">
                  {/* Celular: nome + lixeira numa linha, valor + forma lado a lado na outra. Computador: tudo numa linha. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 items-start gap-1 sm:flex-[1.3]">
                      <div className="min-w-0 flex-1">
                        <Entrada value={l.nome} onChange={(e) => mudarLinha(l.id, 'nome', e.target.value)} maxLength={40} placeholder="Nome" className="py-2 font-semibold" />
                        {l.consumo != null && <p className="mt-1 px-1 text-xs text-stone-500">Pediu {reais(l.consumo)}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => remover(l.id)}
                        disabled={linhas.length <= 1}
                        className="rounded-lg p-2.5 text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:order-last"
                        aria-label={`Remover ${l.nome}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex-[2.2]">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">R$</span>
                        <Entrada value={l.valor} onChange={(e) => mudarLinha(l.id, 'valor', e.target.value)} inputMode="decimal" placeholder="0,00" className={cx('py-2 pl-9 font-semibold', (centavosDoTexto(l.valor) ?? 0) <= 0 && 'border-amber-300')} />
                      </div>
                      <Selecao value={l.forma} onChange={(e) => mudarLinha(l.id, 'forma', e.target.value)} className={cx('py-2', !l.forma && 'border-amber-300 text-stone-500')}>
                        <option value="">Forma…</option>
                        {FORMAS_PAGAMENTO.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </Selecao>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Botao tamanho="p" variante="secundario" icone={<Plus className="h-4 w-4" />} onClick={adicionar}>
                Adicionar pessoa
              </Botao>
              <p className="text-sm text-stone-600">
                Distribuído <b className={cx(diferenca === 0 ? 'text-emerald-700' : 'text-stone-900')}>{reais(distribuido)}</b> de {reais(total)}
              </p>
            </div>
            {semForma > 0 && diferenca === 0 && <p className="text-xs font-medium text-amber-700">Escolha a forma de pagamento de cada pessoa.</p>}
          </div>
        )}
      </div>
    </Janela>
  );
}
