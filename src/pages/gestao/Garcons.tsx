import { BellRing, Copy, RefreshCw, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { QrCode } from '../../components/comuns';
import { Aviso, Botao, BotaoIcone, Carregando, Selo, Titulo, Vazio, useAvisos } from '../../components/ui';
import { gestao, mensagemDe, urlBaseSalva } from '../../lib/api';
import { dataHora, tempoDesde } from '../../lib/formato';
import type { CelularGarcom } from '../../lib/tipos';
import { useGestao } from './contexto';

type Acesso = { token: string; celulares: CelularGarcom[] };

const AVISOS: Record<string, string> = { novo: 'Novos pedidos', pronto: 'Pronto para servir', garcom: 'Chamados', conta: 'Pediu a conta' };

export default function Garcons() {
  const { restaurante } = useGestao();
  const { avisar, confirmar } = useAvisos();
  const [dados, setDados] = useState<Acesso | null>(null);
  const [testando, setTestando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await gestao.get<Acesso>('/garcons'));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!dados) return <Carregando />;
  const base = (urlBaseSalva.ler() || window.location.origin).replace(/\/+$/, '');
  const link = `${base}/garcom/${restaurante.id}?t=${dados.token}`;

  return (
    <>
      <Titulo titulo="Garçons" subtitulo="Cada garçom lê este QR Code no próprio celular e passa a receber os avisos do salão." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <section className="cartao flex flex-col items-center p-6 text-center">
          <QrCode texto={link} tamanho={220} />
          <p className="mt-3 text-sm text-stone-600">Acesso dos garçons (vale para todos)</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Botao
              tamanho="p"
              variante="secundario"
              icone={<Copy className="h-4 w-4" />}
              onClick={async () => {
                await navigator.clipboard?.writeText(link).catch(() => {});
                avisar('Link copiado.');
              }}
            >
              Copiar link
            </Botao>
            <Botao
              tamanho="p"
              variante="fantasma"
              icone={<RefreshCw className="h-4 w-4" />}
              onClick={async () => {
                if (
                  await confirmar({
                    titulo: 'Gerar novo acesso dos garçons?',
                    texto: 'Todos os celulares saem e param de receber avisos. Use quando um garçom sair da equipe.',
                    confirmar: 'Gerar novo',
                    perigo: true,
                  })
                ) {
                  try {
                    setDados(await gestao.post<Acesso>('/garcons/novo-token'));
                    avisar('Novo acesso gerado. Os garçons precisam ler o QR Code de novo.');
                  } catch (e) {
                    avisar(mensagemDe(e), 'erro');
                  }
                }
              }}
            >
              Novo acesso
            </Botao>
          </div>
        </section>

        <section className="cartao p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold">Celulares com avisos ({dados.celulares.length})</h2>
            <Botao
              tamanho="p"
              variante="secundario"
              icone={<BellRing className="h-4 w-4" />}
              carregando={testando}
              disabled={!dados.celulares.length}
              onClick={async () => {
                setTestando(true);
                try {
                  const r = await gestao.post<{ entregues: number; celulares: CelularGarcom[] }>('/garcons/teste');
                  setDados((d) => (d ? { ...d, celulares: r.celulares } : d));
                  avisar(`Aviso de teste entregue em ${r.entregues} de ${r.celulares.length} celulares.`, r.entregues ? 'ok' : 'erro');
                } catch (e) {
                  avisar(mensagemDe(e), 'erro');
                } finally {
                  setTestando(false);
                }
              }}
            >
              Enviar teste
            </Botao>
          </div>
          {!dados.celulares.length ? (
            <Vazio icone={<Smartphone />} titulo="Nenhum celular inscrito">
              Peça ao garçom para abrir o link pelo QR Code e tocar em <b>Ativar avisos</b>.
            </Vazio>
          ) : (
            <ul className="divide-y divide-stone-100">
              {dados.celulares.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100">
                    <Smartphone className="h-5 w-5 text-stone-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.nome}</p>
                    <p className="text-xs text-stone-500">
                      {c.navegador} · desde {dataHora(c.criadoEm)}
                      {c.ultimoEnvioEm && <> · último aviso {tempoDesde(c.ultimoEnvioEm)}</>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.avisos.map((a) => (
                        <Selo key={a}>{AVISOS[a] ?? a}</Selo>
                      ))}
                    </div>
                  </div>
                  <BotaoIcone
                    rotulo="Remover celular"
                    className="hover:text-red-600"
                    onClick={async () => {
                      if (!(await confirmar({ titulo: `Remover o celular de ${c.nome}?`, confirmar: 'Remover', perigo: true }))) return;
                      try {
                        const r = await gestao.del<{ celulares: CelularGarcom[] }>(`/garcons/celulares/${c.id}`);
                        setDados((d) => (d ? { ...d, celulares: r.celulares } : d));
                      } catch (e) {
                        avisar(mensagemDe(e), 'erro');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </BotaoIcone>
                </li>
              ))}
            </ul>
          )}
          <Aviso className="mt-4" tipo="info">
            No iPhone, o garçom precisa tocar em <b>Compartilhar → Adicionar à Tela de Início</b> e abrir pelo ícone para receber notificações.
          </Aviso>
        </section>
      </div>
    </>
  );
}
