import { Plus, Receipt, Split, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FORMAS_PAGAMENTO, centavosDoTexto, cpfOuCnpj, cpfValido, reais, soDigitos, textoDosCentavos } from '../lib/formato';
import type { Sessao } from '../lib/tipos';
import { Abas, Aviso, Botao, Entrada, Janela, Selecao, cx } from './ui';

export interface PagamentoDividido {
  nome: string;
  formaPagamento: string;
  valor: number;
}

/** `taxaServicoPercentual`: taxa de serviço escolhida no fechamento (0 = sem taxa).
 *  `notaFiscal`: emitir ou não a NFC-e logo depois de fechar (CPF e valor recebido são opcionais). */
export type DadosFechamento = ({ formaPagamento: string } | { pagamentos: PagamentoDividido[] }) & {
  taxaServicoPercentual: number;
  notaFiscal: { emitir: boolean; cpf?: string | null; valorRecebido?: number | null };
};

/** Mensagem depois de fechar: a conta e, se pediu, a situação da nota fiscal. */
export function avisoDoFechamento(numero: number, r: Sessao): [string, 'ok' | 'erro' | 'info'] {
  const base = `Mesa ${numero} fechada · ${reais(r.total)}${r.pagamentos?.length ? ` · dividida em ${r.pagamentos.length}` : ''}`;
  if (r.notaErro) return [`${base}. A nota fiscal não saiu: ${r.notaErro}`, 'erro'];
  const n = r.nota;
  if (!n) return [base, 'ok'];
  if (n.status === 'autorizada') return [`${base} · NFC-e nº ${n.numero} autorizada`, 'ok'];
  if (n.status === 'rejeitada') return [`${base}. A Sefaz recusou a nota: ${n.motivo || 'sem motivo informado'}. Emita de novo em Histórico.`, 'erro'];
  return [`${base} · NFC-e nº ${n.numero} em contingência: será enviada à Sefaz automaticamente`, 'info'];
}

const OPCOES_TAXA = [8, 10, 12, 15];

/** Arredonda como o servidor (Python: metade vai para o par), para a divisão bater ao centavo. */
function arredondar(x: number) {
  const piso = Math.floor(x);
  const resto = x - piso;
  if (resto === 0.5) return piso % 2 === 0 ? piso : piso + 1;
  return Math.round(x);
}

function lerPercentual(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n * 100) / 100 : null;
}

const formatarPct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

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
function consumoPorPessoa(sessao: Sessao, taxaServico: number) {
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
    const parte = Math.round((taxaServico * p.consumo) / subtotal);
    p.comServico = p.consumo + parte;
    distribuido += parte;
  }
  // Sobra do arredondamento da taxa vai para quem consumiu mais.
  const maior = pessoas.reduce((a, b) => (b.consumo > a.consumo ? b : a), pessoas[0]);
  if (maior) maior.comServico += taxaServico - distribuido;
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
  notaFiscal = false,
  aoFechar,
  aoConfirmar,
}: {
  titulo: string;
  sessao: Sessao;
  caixaAberto?: boolean;
  /** NFC-e configurada: oferece emitir (ou não) a nota ao fechar. */
  notaFiscal?: boolean;
  avisoCaixaFechado?: ReactNode;
  aoFechar: () => void;
  aoConfirmar: (dados: DadosFechamento) => Promise<void>;
}) {
  // Taxa de serviço: começa na padrão (ex.: 10%); o caixa pode trocar a porcentagem ou não cobrar (0%).
  const [pctTexto, setPctTexto] = useState(formatarPct(sessao.taxaServicoPercentual));
  const pctLido = lerPercentual(pctTexto);
  const pct = pctLido ?? 0;
  const taxa = arredondar((sessao.subtotal * pct) / 100);
  const total = sessao.subtotal + taxa;

  const pessoas = useMemo(() => consumoPorPessoa(sessao, taxa), [sessao, taxa]);

  // Nota fiscal: já vem marcada para emitir quando a NFC-e está configurada; o caixa pode desmarcar.
  const [emitirNota, setEmitirNota] = useState(true);
  const [cpf, setCpf] = useState('');
  const [recebido, setRecebido] = useState('');
  const emitir = notaFiscal && emitirNota;
  const cpfErrado = emitir && soDigitos(cpf).length > 0 && !cpfValido(cpf);
  const valorRecebido = centavosDoTexto(recebido);
  const nomesReais = pessoas.filter((p) => p.nome !== 'Sem nome').map((p) => p.nome);
  const sugerir = pessoas.length >= 2;

  const [dividir, setDividir] = useState(false);
  const [formaJunto, setFormaJunto] = useState('');
  const [modo, setModo] = useState<ModoDivisao>('consumo');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [enviando, setEnviando] = useState(false);

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

  // Mudou a taxa: refaz a divisão automática (por consumo ou em partes iguais) com o novo total.
  useEffect(() => {
    if (dividir && modo !== 'personalizado') setLinhas((ls) => montar(modo, ls));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxa]);

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

  const nota = {
    emitir,
    cpf: emitir ? soDigitos(cpf) || null : null,
    valorRecebido: emitir && !dividir && formaJunto === 'Dinheiro' && valorRecebido ? valorRecebido : null,
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      await aoConfirmar(
        dividir
          ? { pagamentos: linhas.map((l, i) => ({ nome: l.nome.trim() || `Pessoa ${i + 1}`, formaPagamento: l.forma, valor: valores[i] })), taxaServicoPercentual: pct, notaFiscal: nota }
          : { formaPagamento: formaJunto, taxaServicoPercentual: pct, notaFiscal: nota },
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
              disabled={pctLido == null || cpfErrado || (dividir ? !divisaoOk : !formaJunto)}
              onClick={confirmar}
            >
              <span className="hidden sm:inline">
                {dividir ? 'Fechar conta dividida' : 'Fechar conta'}
                {emitir ? ' e emitir nota' : ''}
              </span>
              <span className="sm:hidden">{emitir ? 'Fechar e emitir nota' : dividir ? 'Fechar conta dividida' : 'Fechar conta'}</span>
              &nbsp;· {reais(total)}
            </Botao>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 px-4 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-stone-500">Total da mesa</p>
              <p className="text-2xl font-extrabold tabular-nums">{reais(total)}</p>
            </div>
            <p className="text-right text-xs text-stone-500">
              {reais(sessao.subtotal)} {taxa > 0 ? `+ serviço ${formatarPct(pct)}% (${reais(taxa)})` : '· sem taxa de serviço'}
            </p>
          </div>
          <div className="mt-3 border-t border-stone-200 pt-3">
            <p className="mb-2 text-sm font-semibold">Taxa de serviço</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0, ...OPCOES_TAXA].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPctTexto(formatarPct(v))}
                  aria-pressed={pctLido === v}
                  className={cx(
                    'rounded-full px-3 py-1.5 text-sm font-semibold ring-1 transition',
                    pctLido === v ? 'bg-marca text-white ring-marca' : 'bg-white text-stone-700 ring-stone-200 hover:bg-stone-50',
                  )}
                >
                  {v === 0 ? 'Sem taxa' : `${v}%`}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-sm text-stone-600">
                <span>Outra:</span>
                <span className="relative">
                  <Entrada
                    id="taxa-servico"
                    value={pctTexto}
                    onChange={(e) => setPctTexto(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
                    inputMode="decimal"
                    aria-label="Porcentagem da taxa de serviço"
                    className={cx('w-20 py-1.5 pr-7 text-right font-semibold', pctLido == null && 'border-red-400')}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-500">%</span>
                </span>
              </label>
            </div>
            {pctLido == null && <p className="mt-1.5 text-xs font-medium text-red-700">Use uma taxa de 0% a 30%.</p>}
          </div>
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

        <div className="rounded-xl border border-stone-200 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-stone-500" />
              Nota fiscal (NFC-e)
            </p>
            {notaFiscal && (
              <div role="group" aria-label="Emitir nota fiscal" className="inline-flex rounded-full bg-stone-100 p-0.5">
                {(
                  [
                    [true, 'Emitir nota'],
                    [false, 'Não emitir'],
                  ] as const
                ).map(([valor, rotulo]) => (
                  <button
                    key={rotulo}
                    type="button"
                    aria-pressed={emitirNota === valor}
                    onClick={() => setEmitirNota(valor)}
                    className={cx(
                      'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                      emitirNota === valor ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200' : 'text-stone-500 hover:text-stone-800',
                    )}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!notaFiscal ? (
            <p className="mt-1 text-xs text-stone-500">A nota fiscal ainda não está configurada. Depois de configurada em Configurar nota fiscal, ela pode ser emitida aqui ao fechar a conta.</p>
          ) : emitirNota ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">CPF na nota (opcional)</span>
                <Entrada
                  id="nota-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(cpfOuCnpj(soDigitos(e.target.value).slice(0, 11)))}
                  inputMode="numeric"
                  placeholder="Só se o cliente pedir"
                  className={cx(cpfErrado && 'border-red-400')}
                />
                {cpfErrado && <span className="mt-1 block text-xs font-medium text-red-700">CPF inválido. Confira os números ou deixe em branco.</span>}
              </label>
              {!dividir && formaJunto === 'Dinheiro' && (
                <label className="block">
                  <span className="rotulo">Valor recebido (opcional)</span>
                  <Entrada id="nota-recebido" value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" />
                  <span className="mt-1 block text-xs text-stone-500">
                    {valorRecebido && valorRecebido > total ? `Troco: ${reais(valorRecebido - total)}` : 'Para o troco sair na nota.'}
                  </span>
                </label>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-stone-500">A conta fecha sem nota. Se precisar, emita depois em Histórico.</p>
          )}
        </div>
      </div>
    </Janela>
  );
}
