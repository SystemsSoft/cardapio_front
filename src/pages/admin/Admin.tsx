import { Building2, Gift, KeyRound, LogOut, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Logo } from '../../components/comuns';
import { Abas, Aviso, Botao, Campo, Carregando, Entrada, Janela, Selo, Titulo, useAvisos } from '../../components/ui';
import { admin, api, mensagemDe, sessaoAdmin } from '../../lib/api';
import { data, dataHora, reais, telefone } from '../../lib/formato';
import type { DocumentoContrato, RestauranteAdmin, TipoAssinatura } from '../../lib/tipos';
import { CampoSenha } from '../Acesso';

interface Resumo {
  total: number;
  emTeste: number;
  assinantes: number;
  pendentes: number;
  bloqueados: number;
}
type Lista = { resumo: Resumo; restaurantes: RestauranteAdmin[] };
type DadosEmpresa = { empresa: Record<string, string>; completa: boolean; campos: Record<string, string>; versaoContrato: string };

export default function Admin() {
  const [logado, setLogado] = useState(!!sessaoAdmin.ler());
  useEffect(() => {
    const sair = () => {
      sessaoAdmin.limpar();
      setLogado(false);
    };
    window.addEventListener('cardapio:admin-expirado', sair);
    return () => window.removeEventListener('cardapio:admin-expirado', sair);
  }, []);
  return logado ? <Painel aoSair={() => setLogado(false)} /> : <LoginAdmin aoEntrar={() => setLogado(true)} />;
}

function LoginAdmin({ aoEntrar }: { aoEntrar: () => void }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      const r = await api.post<{ token: string }>('/admin/login', { usuario, senha });
      sessaoAdmin.salvar(r.token);
      aoEntrar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-900 px-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-flutuante">
        <Logo />
        <h1 className="text-xl font-bold">Painel da plataforma</h1>
        <Campo rotulo="Usuário">
          <Entrada value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" required />
        </Campo>
        <Campo rotulo="Senha">
          <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" largo variante="escuro" carregando={enviando}>
          Entrar
        </Botao>
      </form>
    </div>
  );
}

const SELO_TIPO: Record<TipoAssinatura, { rotulo: string; cor: 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'cinza' }> = {
  teste: { rotulo: 'Teste', cor: 'azul' },
  ativa: { rotulo: 'Assinante', cor: 'verde' },
  pendente: { rotulo: 'Pendente', cor: 'amarelo' },
  cancelada: { rotulo: 'Cancelada', cor: 'vermelho' },
  expirada: { rotulo: 'Expirada', cor: 'cinza' },
};

type Filtro = 'todos' | TipoAssinatura | 'bloqueados';

function Painel({ aoSair }: { aoSair: () => void }) {
  const { avisar } = useAvisos();
  const [dados, setDados] = useState<Lista | null>(null);
  const [termo, setTermo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<RestauranteAdmin | null>(null);
  const [empresa, setEmpresa] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await admin.get<Lista>('/restaurantes'));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [avisar]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const lista = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return (dados?.restaurantes ?? []).filter((r) => {
      if (t && ![r.nome, r.usuario, r.email, r.telefone].some((v) => v?.toLowerCase().includes(t))) return false;
      if (filtro === 'todos') return true;
      if (filtro === 'bloqueados') return !r.assinatura.liberado;
      return r.assinatura.tipo === filtro;
    });
  }, [dados, termo, filtro]);

  const sair = async () => {
    await admin.post('/sair').catch(() => {});
    sessaoAdmin.limpar();
    aoSair();
  };

  return (
    <div className="min-h-dvh bg-fundo">
      <header className="pt-seguro sticky top-0 z-20 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Logo />
          <Selo cor="roxo">Admin</Selo>
          <div className="flex-1" />
          <Botao tamanho="p" variante="secundario" icone={<Building2 className="h-4 w-4" />} onClick={() => setEmpresa(true)}>
            <span className="hidden sm:inline">Empresa do contrato</span>
          </Botao>
          <Botao tamanho="p" variante="fantasma" icone={<LogOut className="h-4 w-4" />} onClick={sair}>
            Sair
          </Botao>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Titulo titulo="Restaurantes" />
        {!dados ? (
          <Carregando />
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {(
                [
                  ['Total', dados.resumo.total],
                  ['Em teste', dados.resumo.emTeste],
                  ['Assinantes', dados.resumo.assinantes],
                  ['Pendentes', dados.resumo.pendentes],
                  ['Bloqueados', dados.resumo.bloqueados],
                ] as const
              ).map(([r, v]) => (
                <div key={r} className="cartao p-4">
                  <p className="text-sm text-stone-500">{r}</p>
                  <p className="text-2xl font-extrabold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative md:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Entrada value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, usuário, e-mail ou telefone" className="pl-10" type="search" />
              </div>
              <Abas<Filtro>
                atual={filtro}
                aoMudar={setFiltro}
                abas={[
                  { valor: 'todos', rotulo: 'Todos' },
                  { valor: 'teste', rotulo: 'Em teste' },
                  { valor: 'ativa', rotulo: 'Assinantes' },
                  { valor: 'pendente', rotulo: 'Pendentes' },
                  { valor: 'bloqueados', rotulo: 'Bloqueados' },
                ]}
              />
            </div>
            <div className="cartao overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Restaurante</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3 text-right">Pedidos</th>
                    <th className="px-4 py-3 text-right">Vendas 30d</th>
                    <th className="px-4 py-3">Último pedido</th>
                    <th className="px-4 py-3">Cadastro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lista.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setAberto(r)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.nome}</p>
                        <p className="text-xs text-stone-500">
                          @{r.usuario} · {r.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Selo cor={SELO_TIPO[r.assinatura.tipo].cor}>
                            {SELO_TIPO[r.assinatura.tipo].rotulo}
                            {r.assinatura.tipo === 'teste' && ` · ${r.assinatura.diasRestantesTeste}d`}
                          </Selo>
                          {!r.assinatura.liberado && <Selo cor="vermelho">Bloqueado</Selo>}
                          {r.contrato.aceito && <Selo>Contrato ✓</Selo>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.estatisticas.pedidos}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{reais(r.estatisticas.vendas30d)}</td>
                      <td className="px-4 py-3 text-stone-600">{dataHora(r.estatisticas.ultimoPedidoEm)}</td>
                      <td className="px-4 py-3 text-stone-600">{data(r.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!lista.length && <p className="py-10 text-center text-stone-500">Nenhum restaurante encontrado.</p>}
            </div>
          </>
        )}
      </main>
      {aberto && (
        <DetalheRestaurante
          restaurante={aberto}
          aoFechar={() => setAberto(null)}
          aoMudar={(r) => {
            setAberto(r);
            carregar();
          }}
        />
      )}
      {empresa && <Empresa aoFechar={() => setEmpresa(false)} />}
    </div>
  );
}

function DetalheRestaurante({ restaurante: r, aoFechar, aoMudar }: { restaurante: RestauranteAdmin; aoFechar: () => void; aoMudar: (r: RestauranteAdmin) => void }) {
  const { avisar, confirmar } = useAvisos();
  const [f, setF] = useState({ usuario: r.usuario, nome: r.nome, endereco: r.endereco, telefone: r.telefone, email: r.email });
  const [senha, setSenha] = useState('');
  const [dias, setDias] = useState('7');
  const [contrato, setContrato] = useState<DocumentoContrato | null>(null);
  const [ocupado, setOcupado] = useState('');

  const fazer = async (nome: string, fn: () => Promise<RestauranteAdmin>, msg: string) => {
    setOcupado(nome);
    try {
      aoMudar(await fn());
      avisar(msg);
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado('');
    }
  };

  const e = r.estatisticas;
  return (
    <Janela aberta aoFechar={aoFechar} titulo={r.nome} largura="max-w-2xl">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          {(
            [
              ['Mesas', e.mesas],
              ['Produtos', e.produtos],
              ['Mesas abertas', e.sessoesAtivas],
              ['Pedidos', e.pedidos],
              ['Celulares garçom', e.celularesGarcom],
              ['Vendas 30d', reais(e.vendas30d)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-stone-50 p-2">
              <p className="text-xs text-stone-500">{k}</p>
              <p className="font-bold">{v}</p>
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <h3 className="font-bold">Cadastro</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Usuário">
              <Entrada value={f.usuario} onChange={(x) => setF({ ...f, usuario: x.target.value.toLowerCase() })} />
            </Campo>
            <Campo rotulo="E-mail">
              <Entrada value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} />
            </Campo>
            <Campo rotulo="Nome">
              <Entrada value={f.nome} onChange={(x) => setF({ ...f, nome: x.target.value })} />
            </Campo>
            <Campo rotulo="Telefone">
              <Entrada value={f.telefone} onChange={(x) => setF({ ...f, telefone: telefone(x.target.value) })} />
            </Campo>
          </div>
          <Campo rotulo="Endereço">
            <Entrada value={f.endereco} onChange={(x) => setF({ ...f, endereco: x.target.value })} />
          </Campo>
          <Botao carregando={ocupado === 'dados'} onClick={() => fazer('dados', () => admin.put<RestauranteAdmin>(`/restaurantes/${r.id}`, f), 'Cadastro atualizado.')}>
            Salvar cadastro
          </Botao>
        </section>

        <section className="grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-bold">Nova senha</h3>
            <CampoSenha value={senha} onChange={(x) => setSenha(x.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            <Botao
              variante="secundario"
              icone={<KeyRound className="h-4 w-4" />}
              disabled={senha.length < 8}
              carregando={ocupado === 'senha'}
              onClick={async () => {
                if (await confirmar({ titulo: 'Definir nova senha?', texto: 'Todos os aparelhos logados neste restaurante serão desconectados.', confirmar: 'Definir' }))
                  fazer('senha', () => admin.post<RestauranteAdmin>(`/restaurantes/${r.id}/senha`, { senha }), 'Senha definida.').then(() => setSenha(''));
              }}
            >
              Definir senha
            </Botao>
          </div>
          <div className="space-y-2">
            <h3 className="font-bold">Estender teste grátis</h3>
            <p className="text-xs text-stone-500">Teste atual até {dataHora(r.assinatura.testeAte)}</p>
            <div className="flex gap-2">
              <Entrada type="number" min={1} max={365} value={dias} onChange={(x) => setDias(x.target.value)} className="w-24" />
              <Botao
                variante="secundario"
                icone={<Gift className="h-4 w-4" />}
                carregando={ocupado === 'teste'}
                onClick={() => fazer('teste', () => admin.post<RestauranteAdmin>(`/restaurantes/${r.id}/teste`, { dias: Number(dias) }), `+${dias} dias de teste.`)}
              >
                Adicionar dias
              </Botao>
            </div>
          </div>
        </section>

        <section className="space-y-2 border-t border-stone-100 pt-4">
          <h3 className="font-bold">Contrato</h3>
          {r.contrato.aceite ? (
            <p className="text-sm text-stone-600">
              Aceito por {r.contrato.aceite.responsavelNome} ({r.contrato.aceite.responsavelDocumento}) em {dataHora(r.contrato.aceite.aceitoEm)} · IP {r.contrato.aceite.ip}
            </p>
          ) : (
            <p className="text-sm text-stone-500">Ainda não aceitou o contrato.</p>
          )}
          {r.contrato.aceite && !contrato && (
            <Botao
              tamanho="p"
              variante="secundario"
              onClick={() =>
                admin
                  .get<DocumentoContrato>(`/restaurantes/${r.id}/contrato`)
                  .then(setContrato)
                  .catch((x) => avisar(mensagemDe(x), 'erro'))
              }
            >
              Ver texto aceito
            </Botao>
          )}
          {contrato?.textoAceito && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-xs">{contrato.textoAceito}</pre>}
        </section>
      </div>
    </Janela>
  );
}

function Empresa({ aoFechar }: { aoFechar: () => void }) {
  const { avisar } = useAvisos();
  const [d, setD] = useState<DadosEmpresa | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    admin
      .get<DadosEmpresa>('/empresa')
      .then(setD)
      .catch((e) => avisar(mensagemDe(e), 'erro'));
  }, [avisar]);
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Empresa do contrato"
      rodape={
        <Botao
          largo
          carregando={salvando}
          disabled={!d}
          onClick={async () => {
            if (!d) return;
            setSalvando(true);
            try {
              setD(await admin.put<DadosEmpresa>('/empresa', d.empresa));
              avisar('Dados da empresa salvos.');
            } catch (e) {
              avisar(mensagemDe(e), 'erro');
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar
        </Botao>
      }
    >
      {!d ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          <Aviso tipo={d.completa ? 'sucesso' : 'alerta'}>
            {d.completa ? `Contrato v${d.versaoContrato} disponível para os restaurantes.` : 'Preencha todos os campos para liberar o contrato.'}
          </Aviso>
          {Object.entries(d.campos).map(([k, rotulo]) => (
            <Campo key={k} rotulo={rotulo}>
              <Entrada value={d.empresa[k] ?? ''} onChange={(e) => setD({ ...d, empresa: { ...d.empresa, [k]: e.target.value } })} />
            </Campo>
          ))}
        </div>
      )}
    </Janela>
  );
}
