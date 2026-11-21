import { Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { QrCode } from '../../components/comuns';
import { Aviso, Botao, BotaoIcone, Campo, Carregando, Entrada, Janela, Titulo, useAvisos } from '../../components/ui';
import { gestao, mensagemDe, urlBaseSalva } from '../../lib/api';
import { useGestao } from './contexto';

interface Mesa {
  numero: number;
  token: string;
}

export default function QrCodes() {
  const { restaurante, recarregarEstado } = useGestao();
  const { avisar, confirmar } = useAvisos();
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [base, setBase] = useState(() => urlBaseSalva.ler() || window.location.origin);
  const [ips, setIps] = useState<{ ips: string[]; porta: number } | null>(null);
  const [adicionar, setAdicionar] = useState(false);
  const [quantidade, setQuantidade] = useState('5');

  const carregar = useCallback(async () => {
    try {
      setMesas(await gestao.get<Mesa[]>('/mesas'));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [avisar]);

  useEffect(() => {
    carregar();
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      gestao.get<{ ips: string[]; porta: number }>('/info').then(setIps).catch(() => {});
    }
  }, [carregar]);

  useEffect(() => {
    urlBaseSalva.salvar(base);
  }, [base]);

  if (!mesas) return <Carregando />;
  const link = (m: Mesa) => `${base.replace(/\/+$/, '')}/cliente/${restaurante.id}/mesa/${m.numero}?t=${m.token}`;

  const agir = async (fn: () => Promise<Mesa[]>, msg: string) => {
    try {
      setMesas(await fn());
      avisar(msg);
      recarregarEstado();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  return (
    <>
      <div className="nao-imprimir">
        <Titulo
          titulo="QR Codes das mesas"
          subtitulo="Imprima e cole em cada mesa. O cliente lê com a câmera do celular e o cardápio abre na hora."
          acoes={
            <>
              <Botao variante="secundario" icone={<Plus className="h-4 w-4" />} onClick={() => setAdicionar(true)}>
                Adicionar mesas
              </Botao>
              <Botao icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
                Imprimir todos
              </Botao>
            </>
          }
        />
        <div className="cartao mb-5 space-y-3 p-4">
          <Campo rotulo="Endereço do site nos QR Codes" dica="Use o domínio público (ex.: https://cardapioonline.online) antes de imprimir.">
            <Entrada value={base} onChange={(e) => setBase(e.target.value)} />
          </Campo>
          {ips && ips.ips.length > 0 && (
            <Aviso tipo="info" titulo="Testando na rede local?">
              Para abrir no celular, use{' '}
              {ips.ips.map((ip) => (
                <button key={ip} type="button" className="mr-2 font-semibold underline" onClick={() => setBase(`http://${ip}:${window.location.port || ips.porta}`)}>
                  http://{ip}:{window.location.port || ips.porta}
                </button>
              ))}
            </Aviso>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-6">
        {mesas.map((m) => (
          <div key={m.numero} className="cartao quebra-pagina flex flex-col items-center p-4 text-center print:border-2 print:border-stone-800 print:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{restaurante.nome}</p>
            <p className="mb-2 text-2xl font-extrabold">Mesa {m.numero}</p>
            <QrCode texto={link(m)} tamanho={160} />
            <p className="mt-2 text-xs text-stone-600">Aponte a câmera para ver o cardápio e pedir</p>
            <div className="nao-imprimir mt-3 flex gap-1">
              <BotaoIcone
                rotulo="Gerar novo QR Code"
                className="h-8 w-8"
                onClick={async () => {
                  if (await confirmar({ titulo: `Novo QR Code para a mesa ${m.numero}?`, texto: 'O QR Code impresso atual deixa de funcionar. Use se ele foi copiado ou fotografado por alguém de fora.', confirmar: 'Gerar novo' }))
                    agir(() => gestao.post<Mesa[]>(`/mesas/${m.numero}/novo-token`), `Mesa ${m.numero}: novo QR Code gerado. Imprima de novo.`);
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </BotaoIcone>
              <BotaoIcone
                rotulo="Remover mesa"
                className="h-8 w-8 hover:text-red-600"
                onClick={async () => {
                  if (await confirmar({ titulo: `Remover a mesa ${m.numero}?`, confirmar: 'Remover', perigo: true })) agir(() => gestao.del<Mesa[]>(`/mesas/${m.numero}`), `Mesa ${m.numero} removida.`);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </BotaoIcone>
            </div>
          </div>
        ))}
      </div>

      <Janela
        aberta={adicionar}
        aoFechar={() => setAdicionar(false)}
        titulo="Adicionar mesas"
        largura="max-w-sm"
        rodape={
          <Botao
            largo
            onClick={() => {
              setAdicionar(false);
              agir(() => gestao.post<Mesa[]>('/mesas', { quantidade: Number(quantidade) }), `${quantidade} mesas adicionadas.`);
            }}
          >
            Adicionar
          </Botao>
        }
      >
        <Campo rotulo="Quantas mesas novas?" dica={`Serão numeradas a partir da ${Math.max(0, ...mesas.map((m) => m.numero)) + 1}.`}>
          <Entrada type="number" min={1} max={100} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </Campo>
      </Janela>
    </>
  );
}
