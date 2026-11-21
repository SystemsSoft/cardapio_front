import { ChefHat, CheckCheck, Clock, User, X } from 'lucide-react';
import { useState } from 'react';
import { useAgora } from '../../components/comuns';
import { Aviso, Botao, Campo, Entrada, Janela, Selecao, Selo, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { FORMAS_PAGAMENTO, centavosDoTexto, cpfOuCnpj, minutosDesde, reais, soDigitos, tempoDesde } from '../../lib/formato';
import type { Nota, Pedido, StatusNota, StatusPedido } from '../../lib/tipos';

export const COR_STATUS: Record<StatusPedido, 'azul' | 'amarelo' | 'verde' | 'cinza' | 'vermelho'> = {
  recebido: 'azul',
  preparando: 'amarelo',
  pronto: 'verde',
  entregue: 'cinza',
  cancelado: 'vermelho',
};

export const PROXIMO: Partial<Record<StatusPedido, { status: StatusPedido; rotulo: string }>> = {
  recebido: { status: 'preparando', rotulo: 'Começar preparo' },
  preparando: { status: 'pronto', rotulo: 'Marcar como pronto' },
  pronto: { status: 'entregue', rotulo: 'Marcar entregue' },
};

export function CartaoPedido({ pedido, mostrarMesa = true, compacto }: { pedido: Pedido; mostrarMesa?: boolean; compacto?: boolean }) {
  const { avisar, confirmar } = useAvisos();
  const agora = useAgora();
  const [ocupado, setOcupado] = useState(false);
  const proximo = PROXIMO[pedido.status];
  const espera = minutosDesde(pedido.criadoEm);
  const atrasado = ['recebido', 'preparando'].includes(pedido.status) && espera >= 20;

  const mudar = async (status: StatusPedido) => {
    setOcupado(true);
    try {
      await gestao.patch(`/pedidos/${pedido.id}`, { status });
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <article className={cx('cartao overflow-hidden', pedido.status === 'cancelado' && 'opacity-60', atrasado && 'ring-2 ring-red-300')}>
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        {mostrarMesa && <span className="rounded-lg bg-stone-900 px-2 py-0.5 text-sm font-bold text-white">Mesa {pedido.mesa}</span>}
        <span className="text-sm font-semibold text-stone-500">#{pedido.id}</span>
        <span className="flex-1" />
        <span className={cx('flex items-center gap-1 text-xs', atrasado ? 'font-bold text-red-600' : 'text-stone-500')}>
          <Clock className="h-3.5 w-3.5" />
          {tempoDesde(pedido.criadoEm, agora)}
        </span>
      </div>
      {pedido.clienteNome && (
        <p className="flex items-center gap-1.5 px-4 pt-2.5 font-bold text-stone-900" title="Quem fez o pedido">
          <User className="h-4 w-4 shrink-0 text-marca" />
          <span className="break-words">{pedido.clienteNome}</span>
        </p>
      )}
      <ul className={cx('space-y-1 px-4', compacto ? 'py-2 text-sm' : 'py-3', pedido.clienteNome && 'pt-1.5')}>
        {pedido.itens.map((i) => (
          <li key={i.id}>
            <span className="font-bold">{i.quantidade}×</span> {i.nome}
            {i.observacao && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs font-medium text-amber-900">{i.observacao}</span>}
          </li>
        ))}
        {pedido.observacao && <li className="pt-1 text-sm italic text-stone-600">“{pedido.observacao}”</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/60 px-4 py-2.5">
        <Selo cor={COR_STATUS[pedido.status]}>{pedido.status[0].toUpperCase() + pedido.status.slice(1)}</Selo>
        <span className="flex-1 text-sm font-semibold text-stone-700">{reais(pedido.total)}</span>
        {!['cancelado', 'entregue'].includes(pedido.status) && (
          <button
            type="button"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Cancelar pedido"
            title="Cancelar pedido"
            onClick={async () => {
              if (await confirmar({ titulo: `Cancelar o pedido #${pedido.id}?`, texto: 'Os itens saem da conta e voltam para o estoque. Não dá para desfazer.', confirmar: 'Cancelar pedido', perigo: true }))
                mudar('cancelado');
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {proximo && (
          <Botao
            tamanho="p"
            className="ml-auto"
            variante={proximo.status === 'pronto' ? 'sucesso' : proximo.status === 'entregue' ? 'secundario' : 'primario'}
            carregando={ocupado}
            onClick={() => mudar(proximo.status)}
            icone={proximo.status === 'preparando' ? <ChefHat className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />}
          >
            {proximo.rotulo}
          </Botao>
        )}
      </div>
    </article>
  );
}

export const STATUS_NOTA: Record<StatusNota, { rotulo: string; cor: 'verde' | 'vermelho' | 'amarelo' | 'cinza' | 'azul' }> = {
  enviando: { rotulo: 'Enviando', cor: 'azul' },
  autorizada: { rotulo: 'Autorizada', cor: 'verde' },
  rejeitada: { rotulo: 'Recusada', cor: 'vermelho' },
  contingencia: { rotulo: 'Contingência', cor: 'amarelo' },
  incerta: { rotulo: 'Aguardando Sefaz', cor: 'amarelo' },
  cancelada: { rotulo: 'Cancelada', cor: 'cinza' },
  inutilizada: { rotulo: 'Inutilizada', cor: 'cinza' },
  substituida: { rotulo: 'Substituída', cor: 'cinza' },
};

const TPAG: Record<string, string> = {
  Dinheiro: '01',
  'Cartão de crédito': '03',
  'Cartão de débito': '04',
  Pix: '17',
  'Vale-refeição': '10',
  'Vale-alimentação': '11',
  Outros: '99',
};

/** Emite a NFC-e de uma conta fechada (CPF opcional, troco no dinheiro). */
export function JanelaEmitirNota({
  sessao,
  aoFechar,
  aoEmitir,
}: {
  sessao: { id: number; mesa: number; total: number; formaPagamento: string | null } | null;
  aoFechar: () => void;
  aoEmitir?: (n: Nota) => void;
}) {
  const [cpf, setCpf] = useState('');
  const [recebido, setRecebido] = useState('');
  const [forma, setForma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const { avisar } = useAvisos();
  if (!sessao) return null;
  const formaAtual = forma || sessao.formaPagamento || 'Outros';
  const valorRecebido = centavosDoTexto(recebido);

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Nota fiscal · Mesa ${sessao.mesa}`}
      rodape={
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={aoFechar}>
            Agora não
          </Botao>
          <Botao
            carregando={enviando}
            onClick={async () => {
              setEnviando(true);
              setErro('');
              try {
                const corpo: Record<string, unknown> = { cpf: soDigitos(cpf) || null };
                if (formaAtual === 'Dinheiro' && valorRecebido) corpo.valorRecebido = valorRecebido;
                if (forma && forma !== sessao.formaPagamento) {
                  const tpag = TPAG[forma] ?? '99';
                  corpo.pagamentos = [{ tpag, valor: formaAtual === 'Dinheiro' && valorRecebido ? Math.max(valorRecebido, sessao.total) : sessao.total }];
                }
                const nota = await gestao.post<Nota>(`/sessoes/${sessao.id}/nfce`, corpo);
                if (nota.status === 'autorizada') avisar(`NFC-e nº ${nota.numero} autorizada!`);
                else if (nota.status === 'rejeitada') throw new Error(nota.motivo || 'A Sefaz recusou a nota.');
                else avisar(`Nota nº ${nota.numero}: ${STATUS_NOTA[nota.status]?.rotulo ?? nota.status}. Ela será enviada automaticamente.`, 'info');
                aoEmitir?.(nota);
                aoFechar();
              } catch (e) {
                setErro(mensagemDe(e));
              } finally {
                setEnviando(false);
              }
            }}
          >
            Emitir NFC-e
          </Botao>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-stone-50 px-4 py-3">
          <p className="text-sm text-stone-500">Valor da nota</p>
          <p className="text-2xl font-extrabold">{reais(sessao.total)}</p>
        </div>
        <Campo rotulo="Forma de pagamento">
          <Selecao value={formaAtual} onChange={(e) => setForma(e.target.value)}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Selecao>
        </Campo>
        {formaAtual === 'Dinheiro' && (
          <Campo rotulo="Valor recebido (para o troco)" dica={valorRecebido && valorRecebido > sessao.total ? `Troco: ${reais(valorRecebido - sessao.total)}` : 'Opcional'}>
            <Entrada value={recebido} onChange={(e) => setRecebido(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </Campo>
        )}
        <Campo rotulo="CPF ou CNPJ na nota" dica="Opcional — só se o cliente pedir.">
          <Entrada value={cpf} onChange={(e) => setCpf(cpfOuCnpj(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
