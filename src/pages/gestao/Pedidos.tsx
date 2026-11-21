import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { Abas, Carregando, Titulo, Vazio, cx } from '../../components/ui';
import type { Pedido, StatusPedido } from '../../lib/tipos';
import { CartaoPedido } from './compartilhado';
import { useGestao } from './contexto';

const COLUNAS: { status: StatusPedido; titulo: string; cor: string }[] = [
  { status: 'recebido', titulo: 'Novos', cor: 'bg-sky-500' },
  { status: 'preparando', titulo: 'Preparando', cor: 'bg-amber-500' },
  { status: 'pronto', titulo: 'Prontos para servir', cor: 'bg-emerald-500' },
  { status: 'entregue', titulo: 'Entregues', cor: 'bg-stone-400' },
];

export default function Pedidos() {
  const { estado } = useGestao();
  const [aba, setAba] = useState<StatusPedido>('recebido');
  if (!estado) return <Carregando />;

  // Só as comandas abertas: ao fechar a mesa os pedidos saem daqui e vão para o Histórico.
  const todos: Pedido[] = estado.mesas.flatMap((m) => m.sessao?.pedidos ?? []);
  const por = (s: StatusPedido) =>
    todos
      .filter((p) => p.status === s)
      .sort((a, b) => (s === 'entregue' ? b.atualizadoEm.localeCompare(a.atualizadoEm) : a.criadoEm.localeCompare(b.criadoEm)));

  return (
    <>
      <Titulo titulo="Pedidos" subtitulo="Atualiza sozinho. Os mais antigos aparecem primeiro." />

      {!todos.length ? (
        <Vazio icone={<ClipboardList />} titulo="Nenhum pedido nas mesas abertas">
          Os pedidos feitos pelo QR Code aparecem aqui na hora, com aviso sonoro.
        </Vazio>
      ) : (
        <>
          {/* Celular: uma coluna por vez */}
          <div className="md:hidden">
            <Abas<StatusPedido>
              className="mb-4"
              atual={aba}
              aoMudar={setAba}
              abas={COLUNAS.map((c) => ({ valor: c.status, rotulo: c.titulo, contador: por(c.status).length }))}
            />
            <Coluna pedidos={por(aba)} />
          </div>
          {/* Computador: quadro com as 4 colunas */}
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
                  <Coluna pedidos={c.status === 'entregue' ? lista.slice(0, 15) : lista} />
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function Coluna({ pedidos }: { pedidos: Pedido[] }) {
  if (!pedidos.length) return <p className="py-8 text-center text-sm text-stone-400">Nada por aqui</p>;
  return (
    <div className="space-y-3">
      {pedidos.map((p) => (
        <CartaoPedido key={p.id} pedido={p} />
      ))}
    </div>
  );
}
