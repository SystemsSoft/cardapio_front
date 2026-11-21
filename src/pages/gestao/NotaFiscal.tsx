import { CheckCircle2, Circle, FileKey, Plug, Plus, Save, Star, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Abas, Aviso, Botao, Campo, Carregando, Entrada, Interruptor, Janela, Selecao, Selo, Titulo, cx, useAvisos } from '../../components/ui';
import { base64DoArquivo, gestao, mensagemDe } from '../../lib/api';
import { data, dataHora, soDigitos } from '../../lib/formato';
import type { ConfigFiscal, Nota, PerfilFiscal, Tributacao } from '../../lib/tipos';
import { CampoSenha } from '../Acesso';

type Aba = 'empresa' | 'tributacao';

export default function NotaFiscal() {
  const [aba, setAba] = useState<Aba>('empresa');
  const [config, setConfig] = useState<ConfigFiscal | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    gestao
      .get<ConfigFiscal>('/fiscal')
      .then(setConfig)
      .catch((e) => setErro(mensagemDe(e)));
  }, []);

  if (!config) return erro ? <Aviso tipo="erro">{erro}</Aviso> : <Carregando />;

  return (
    <>
      <Titulo
        titulo="Configurar nota fiscal"
        subtitulo="NFC-e emitida direto na Sefaz, sem intermediários. Disponível para restaurantes do Rio de Janeiro."
        acoes={
          <Link to="../notas">
            <Botao variante="secundario">Ver notas emitidas</Botao>
          </Link>
        }
      />
      <PassoAPasso config={config} setConfig={setConfig} />
      <Abas<Aba>
        className="mb-4"
        atual={aba}
        aoMudar={setAba}
        abas={[
          { valor: 'empresa', rotulo: 'Empresa e certificado' },
          { valor: 'tributacao', rotulo: 'Tributação dos produtos' },
        ]}
      />
      {aba === 'empresa' ? <Empresa config={config} setConfig={setConfig} /> : <TributacaoProdutos />}
    </>
  );
}

function PassoAPasso({ config, setConfig }: { config: ConfigFiscal; setConfig: (c: ConfigFiscal) => void }) {
  const { avisar, confirmar } = useAvisos();
  const [ocupado, setOcupado] = useState('');
  const p = config.passos;
  const producao = config.ambiente === 1;

  const testar = async () => {
    setOcupado('conexao');
    try {
      const r = await gestao.post<{ ok: boolean; cStat: string; motivo: string; config: ConfigFiscal }>('/fiscal/testar');
      setConfig(r.config);
      avisar(r.ok ? `Conectado à Sefaz: ${r.motivo}` : `Sefaz respondeu ${r.cStat}: ${r.motivo}`, r.ok ? 'ok' : 'erro');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado('');
    }
  };

  const notaTeste = async () => {
    setOcupado('nota');
    try {
      const r = await gestao.post<{ nota: Nota; config: ConfigFiscal }>('/fiscal/nota-teste');
      setConfig(r.config);
      avisar(r.nota.status === 'autorizada' ? `Nota de teste nº ${r.nota.numero} autorizada!` : `Nota de teste: ${r.nota.motivo || r.nota.status}`, r.nota.status === 'autorizada' ? 'ok' : 'erro');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado('');
    }
  };

  const irParaProducao = async () => {
    if (!(await confirmar({ titulo: 'Emitir notas de verdade?', texto: 'A partir de agora as notas terão valor fiscal e serão enviadas para a Sefaz em produção.', confirmar: 'Ir para produção' }))) return;
    setOcupado('producao');
    try {
      setConfig(await gestao.put<ConfigFiscal>('/fiscal', { ...semExtras(config), ambiente: 1 }));
      avisar('Pronto! Agora as notas são emitidas em produção.');
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado('');
    }
  };

  const passos = [
    { feito: p.dados, titulo: 'Preencher dados, CSC e certificado', detalhe: config.pendencias.length ? `Falta: ${config.pendencias.join('; ')}` : 'Tudo preenchido.' },
    {
      feito: !!p.conexao,
      titulo: 'Testar a conexão com a Sefaz (homologação)',
      detalhe: p.conexao ? `Testado em ${dataHora(p.conexao)}` : 'Confere se o certificado é aceito.',
      acao: !producao && (
        <Botao tamanho="p" variante="secundario" icone={<Plug className="h-4 w-4" />} disabled={!p.dados} carregando={ocupado === 'conexao'} onClick={testar}>
          Testar
        </Botao>
      ),
    },
    {
      feito: !!p.notaTeste,
      titulo: 'Emitir uma nota de teste (R$ 1,00, sem valor fiscal)',
      detalhe: p.notaTeste ? `Autorizada em ${dataHora(p.notaTeste)}` : 'Valida o CSC e a tributação.',
      acao: !producao && (
        <Botao tamanho="p" variante="secundario" disabled={!p.conexao} carregando={ocupado === 'nota'} onClick={notaTeste}>
          Emitir teste
        </Botao>
      ),
    },
    {
      feito: !!p.cancelamentoTeste,
      titulo: 'Cancelar a nota de teste (opcional)',
      detalhe: p.cancelamentoTeste ? `Feito em ${dataHora(p.cancelamentoTeste)}` : 'Em Notas fiscais, abra a nota de teste e toque em Cancelar.',
    },
    {
      feito: producao,
      titulo: 'Ir para produção',
      detalhe: producao ? (p.conexaoProducao ? `Conexão em produção testada em ${dataHora(p.conexaoProducao)}` : 'Emitindo notas com valor fiscal.') : 'Liberado depois da conexão e da nota de teste.',
      acao: producao ? (
        <Botao tamanho="p" variante="secundario" icone={<Plug className="h-4 w-4" />} carregando={ocupado === 'conexao'} onClick={testar}>
          Testar produção
        </Botao>
      ) : (
        <Botao tamanho="p" disabled={!p.podeIrParaProducao} carregando={ocupado === 'producao'} onClick={irParaProducao}>
          Ir para produção
        </Botao>
      ),
    },
  ];

  return (
    <section className="cartao mb-5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-bold">Passo a passo</h2>
        <Selo cor={producao ? 'verde' : 'roxo'}>{producao ? 'Produção' : 'Homologação (testes)'}</Selo>
      </div>
      <ol className="space-y-3">
        {passos.map((s, i) => (
          <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-start gap-3">
              {s.feito ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-stone-300" />}
              <div>
                <p className={cx('text-sm font-semibold', s.feito && 'text-stone-500')}>{s.titulo}</p>
                <p className="text-xs text-stone-500">{s.detalhe}</p>
              </div>
            </div>
            {s.acao && <div className="pl-8 sm:pl-0">{s.acao}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Só os campos editáveis (a tela não envia certificado nem listas auxiliares). */
const EDITAVEIS = [
  'razaoSocial', 'nomeFantasia', 'cnpj', 'ie', 'crt', 'logradouro', 'numero', 'complemento', 'bairro', 'codMunicipio',
  'municipio', 'uf', 'cep', 'telefone', 'serie', 'ambiente', 'proximoNumero', 'proximoNumeroHomologacao', 'servicoNaNota', 'cscId',
] as const;
type Editaveis = Pick<ConfigFiscal, (typeof EDITAVEIS)[number]>;

function semExtras(c: ConfigFiscal): Editaveis {
  return Object.fromEntries(EDITAVEIS.map((k) => [k, c[k]])) as Editaveis;
}

function Empresa({ config, setConfig }: { config: ConfigFiscal; setConfig: (c: ConfigFiscal) => void }) {
  const { avisar, confirmar } = useAvisos();
  const [f, setF] = useState(() => semExtras(config));
  const [csc, setCsc] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      const c = await gestao.put<ConfigFiscal>('/fiscal', { ...f, csc: csc || undefined });
      setConfig(c);
      setF(semExtras(c));
      setCsc('');
      avisar('Configuração salva.');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const texto = (k: keyof Editaveis, rotulo: string, extra: InputHTMLAttributes<HTMLInputElement> = {}, dica?: string) => (
    <Campo rotulo={rotulo} dica={dica}>
      <Entrada value={String(f[k] ?? '')} onChange={(e) => mudar(k, e.target.value as never)} {...extra} />
    </Campo>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <section className="cartao space-y-4 p-5">
          <h2 className="font-bold">Empresa</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {texto('razaoSocial', 'Razão social', { maxLength: 60 })}
            {texto('nomeFantasia', 'Nome fantasia', { maxLength: 60 })}
            {texto('cnpj', 'CNPJ', { inputMode: 'numeric' })}
            {texto('ie', 'Inscrição estadual', { inputMode: 'numeric' })}
          </div>
          <Campo rotulo="Regime tributário">
            <Selecao value={f.crt} onChange={(e) => mudar('crt', Number(e.target.value))}>
              {config.regimes.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.nome}
                </option>
              ))}
            </Selecao>
          </Campo>
        </section>

        <section className="cartao space-y-4 p-5">
          <h2 className="font-bold">Endereço</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            {texto('logradouro', 'Logradouro', { maxLength: 60 })}
            {texto('numero', 'Número', { maxLength: 60 })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {texto('complemento', 'Complemento', { maxLength: 60 })}
            {texto('bairro', 'Bairro', { maxLength: 60 })}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px_80px]">
            {texto('municipio', 'Município', { maxLength: 60 })}
            {texto('codMunicipio', 'Código IBGE', { inputMode: 'numeric', maxLength: 7 }, 'Rio de Janeiro: 3304557')}
            <Campo rotulo="UF">
              <Entrada value="RJ" disabled />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {texto('cep', 'CEP', { inputMode: 'numeric', maxLength: 9 })}
            {texto('telefone', 'Telefone', { inputMode: 'tel' })}
          </div>
        </section>

        <section className="cartao space-y-4 p-5">
          <h2 className="font-bold">Numeração e CSC</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Série">
              <Entrada type="number" value={f.serie} onChange={(e) => mudar('serie', Number(e.target.value))} />
            </Campo>
            <Campo rotulo="Próximo nº (produção)">
              <Entrada type="number" value={f.proximoNumero} onChange={(e) => mudar('proximoNumero', Number(e.target.value))} />
            </Campo>
            <Campo rotulo="Próximo nº (homologação)">
              <Entrada type="number" value={f.proximoNumeroHomologacao} onChange={(e) => mudar('proximoNumeroHomologacao', Number(e.target.value))} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            {texto('cscId', 'ID do CSC', { inputMode: 'numeric', maxLength: 6 })}
            <Campo rotulo="CSC (código de segurança)" dica={config.cscConfigurado ? 'Já configurado. Digite só para trocar.' : 'Gerado no portal da Sefaz-RJ.'}>
              <CampoSenha value={csc} onChange={(e) => setCsc(e.target.value.trim())} placeholder={config.cscConfigurado ? '••••••••••••••••' : ''} autoComplete="off" />
            </Campo>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
            <div>
              <p className="font-semibold">Incluir a taxa de serviço na nota</p>
              <p className="text-xs text-stone-500">Sai como “outras despesas”.</p>
            </div>
            <Interruptor ligado={f.servicoNaNota} aoMudar={(v) => mudar('servicoNaNota', v)} />
          </div>
          {config.ambiente === 1 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm">Ambiente: <b>Produção</b></p>
              <Botao
                tamanho="p"
                variante="secundario"
                onClick={async () => {
                  if (await confirmar({ titulo: 'Voltar para homologação?', texto: 'As próximas notas serão de teste, sem valor fiscal.', confirmar: 'Voltar' })) mudar('ambiente', 2);
                }}
              >
                Voltar para testes
              </Botao>
            </div>
          )}
        </section>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao icone={<Save className="h-4 w-4" />} carregando={salvando} onClick={salvar} tamanho="g">
          Salvar configuração
        </Botao>
      </div>
      <Certificado config={config} setConfig={setConfig} />
    </div>
  );
}

function Certificado({ config, setConfig }: { config: ConfigFiscal; setConfig: (c: ConfigFiscal) => void }) {
  const { avisar, confirmar } = useAvisos();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const c = config.certificado;
  const vencido = c.validade && new Date(c.validade) < new Date();

  return (
    <section className="cartao h-fit space-y-4 p-5">
      <div className="flex items-center gap-2">
        <FileKey className="h-5 w-5 text-marca" />
        <h2 className="font-bold">Certificado digital A1</h2>
      </div>
      {c.enviado ? (
        <div className="rounded-xl bg-stone-50 p-4 text-sm">
          <p className="font-semibold">{c.titular}</p>
          {c.cnpj && <p className="text-stone-600">CNPJ {c.cnpj}</p>}
          <p className={cx(vencido ? 'font-semibold text-red-600' : 'text-stone-600')}>
            {vencido ? 'Venceu em' : 'Válido até'} {data(c.validade)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-stone-600">Envie o arquivo .pfx ou .p12 do certificado da empresa. Ele fica guardado criptografado e nunca é mostrado de novo.</p>
      )}
      <div className="space-y-3">
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 px-4 py-3 text-left text-sm hover:border-marca">
          <Upload className="h-5 w-5 text-stone-400" />
          <span className="truncate">{arquivo ? arquivo.name : c.enviado ? 'Trocar certificado…' : 'Escolher arquivo .pfx'}</span>
        </button>
        <input ref={ref} type="file" accept=".pfx,.p12,application/x-pkcs12" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        {arquivo && (
          <>
            <Campo rotulo="Senha do certificado">
              <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
            </Campo>
            <Botao
              largo
              carregando={enviando}
              disabled={!senha}
              onClick={async () => {
                setEnviando(true);
                setErro('');
                try {
                  setConfig(await gestao.post<ConfigFiscal>('/fiscal/certificado', { arquivo: await base64DoArquivo(arquivo), senha }));
                  setArquivo(null);
                  setSenha('');
                  avisar('Certificado enviado.');
                } catch (e) {
                  setErro(mensagemDe(e));
                } finally {
                  setEnviando(false);
                }
              }}
            >
              Enviar certificado
            </Botao>
          </>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {c.enviado && (
          <Botao
            variante="fantasma"
            className="text-red-600"
            icone={<Trash2 className="h-4 w-4" />}
            onClick={async () => {
              if (!(await confirmar({ titulo: 'Remover o certificado?', texto: 'A emissão de notas para até um novo certificado ser enviado, e o ambiente volta para homologação.', confirmar: 'Remover', perigo: true }))) return;
              try {
                setConfig(await gestao.del<ConfigFiscal>('/fiscal/certificado'));
              } catch (e) {
                avisar(mensagemDe(e), 'erro');
              }
            }}
          >
            Remover certificado
          </Botao>
        )}
      </div>
    </section>
  );
}

const ORIGENS = ['0 · Nacional', '1 · Estrangeira (importação direta)', '2 · Estrangeira (mercado interno)', '3 · Nacional, +40% importado', '4 · Nacional (processos básicos)', '5 · Nacional, até 40% importado', '6 · Estrangeira sem similar (direta)', '7 · Estrangeira sem similar (interno)', '8 · Nacional, +70% importado'];

function TributacaoProdutos() {
  const { avisar, confirmar } = useAvisos();
  const [t, setT] = useState<Tributacao | null>(null);
  const [perfil, setPerfil] = useState<Partial<PerfilFiscal> | null>(null);

  useEffect(() => {
    gestao
      .get<Tributacao>('/fiscal/tributacao')
      .then(setT)
      .catch((e) => avisar(mensagemDe(e), 'erro'));
  }, [avisar]);

  if (!t) return <Carregando />;

  const fazer = async (fn: () => Promise<Tributacao>, msg?: string) => {
    try {
      setT(await fn());
      if (msg) avisar(msg);
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  };

  return (
    <div className="space-y-6">
      <section className="cartao p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold">Perfis fiscais</h2>
            <p className="text-sm text-stone-500">Cada categoria do cardápio usa um perfil (NCM, CFOP, CSOSN). Confirme com o seu contador.</p>
          </div>
          <Botao tamanho="p" icone={<Plus className="h-4 w-4" />} onClick={() => setPerfil({ cfop: '5102', csosn: '102', pisCst: '49', cofinsCst: '49', origem: 0 })}>
            Novo perfil
          </Botao>
        </div>
        <div className="divide-y divide-stone-100">
          {t.perfis.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {p.nome} {p.padrao && <Selo cor="marca">Padrão</Selo>}
                </p>
                <p className="text-xs text-stone-500">
                  NCM {p.ncm}
                  {p.cest && ` · CEST ${p.cest}`} · CFOP {p.cfop} · CSOSN {p.csosn}
                </p>
              </div>
              <div className="flex gap-1">
                {!p.padrao && (
                  <Botao tamanho="p" variante="fantasma" icone={<Star className="h-4 w-4" />} onClick={() => fazer(() => gestao.post(`/fiscal/perfis/${p.id}/padrao`), `“${p.nome}” agora é o padrão.`)}>
                    Tornar padrão
                  </Botao>
                )}
                <Botao tamanho="p" variante="secundario" onClick={() => setPerfil(p)}>
                  Editar
                </Botao>
                {!p.padrao && (
                  <Botao
                    tamanho="p"
                    variante="fantasma"
                    className="text-red-600"
                    onClick={async () => {
                      if (await confirmar({ titulo: `Excluir “${p.nome}”?`, texto: 'As categorias que usam este perfil passam a usar o padrão.', confirmar: 'Excluir', perigo: true }))
                        fazer(() => gestao.del(`/fiscal/perfis/${p.id}`), 'Perfil excluído.');
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Botao>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cartao p-5">
        <h2 className="mb-3 font-bold">Perfil de cada categoria</h2>
        {!t.categorias.length ? (
          <p className="text-sm text-stone-500">Cadastre o cardápio primeiro.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {t.categorias.map((c) => (
              <Campo key={c.id} rotulo={`${c.nome} (${c.produtos})`}>
                <Selecao value={c.perfilId} onChange={(e) => fazer(() => gestao.put(`/fiscal/categorias/${c.id}`, { perfilId: Number(e.target.value) }))}>
                  {t.perfis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </Selecao>
              </Campo>
            ))}
          </div>
        )}
      </section>

      <ProdutosFiscais t={t} aoSalvar={(n) => setT(n)} />

      {perfil && <EditorPerfil perfil={perfil} opcoes={t.opcoes} aoFechar={() => setPerfil(null)} aoSalvar={(n) => (setT(n), setPerfil(null))} />}
    </div>
  );
}

function ProdutosFiscais({ t, aoSalvar }: { t: Tributacao; aoSalvar: (t: Tributacao) => void }) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Record<number, { ncm: string; cest: string }>>({});
  return (
    <section className="cartao p-5">
      <h2 className="font-bold">NCM próprio do produto (opcional)</h2>
      <p className="mb-3 text-sm text-stone-500">Deixe em branco para usar o NCM do perfil da categoria.</p>
      <div className="divide-y divide-stone-100">
        {t.produtos.map((p) => {
          const e = editando[p.id] ?? { ncm: p.ncm ?? '', cest: p.cest ?? '' };
          const mudou = e.ncm !== (p.ncm ?? '') || e.cest !== (p.cest ?? '');
          return (
            <div key={p.id} className="grid items-center gap-2 py-2 sm:grid-cols-[1fr_130px_110px_auto]">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.nome}</p>
                <p className="text-xs text-stone-500">{p.categoria}</p>
              </div>
              <Entrada value={e.ncm} placeholder="NCM" inputMode="numeric" className="py-2" onChange={(x) => setEditando({ ...editando, [p.id]: { ...e, ncm: soDigitos(x.target.value).slice(0, 8) } })} />
              <Entrada value={e.cest} placeholder="CEST" inputMode="numeric" className="py-2" onChange={(x) => setEditando({ ...editando, [p.id]: { ...e, cest: soDigitos(x.target.value).slice(0, 7) } })} />
              <Botao
                tamanho="p"
                variante="secundario"
                disabled={!mudou}
                onClick={async () => {
                  try {
                    aoSalvar(await gestao.put<Tributacao>(`/fiscal/produtos/${p.id}`, e));
                    setEditando((atual) => {
                      const copia = { ...atual };
                      delete copia[p.id];
                      return copia;
                    });
                    avisar('Salvo.');
                  } catch (err) {
                    avisar(mensagemDe(err), 'erro');
                  }
                }}
              >
                Salvar
              </Botao>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EditorPerfil({
  perfil,
  opcoes,
  aoFechar,
  aoSalvar,
}: {
  perfil: Partial<PerfilFiscal>;
  opcoes: Tributacao['opcoes'];
  aoFechar: () => void;
  aoSalvar: (t: Tributacao) => void;
}) {
  const [p, setP] = useState(perfil);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const mudar = (k: keyof PerfilFiscal, v: unknown) => setP((x) => ({ ...x, [k]: v }));

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={perfil.id ? 'Editar perfil fiscal' : 'Novo perfil fiscal'}
      rodape={
        <Botao
          largo
          carregando={salvando}
          onClick={async () => {
            setSalvando(true);
            setErro('');
            try {
              aoSalvar(perfil.id ? await gestao.put<Tributacao>(`/fiscal/perfis/${perfil.id}`, p) : await gestao.post<Tributacao>('/fiscal/perfis', p));
            } catch (e) {
              setErro(mensagemDe(e));
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar perfil
        </Botao>
      }
    >
      <div className="space-y-4">
        <Campo rotulo="Nome">
          <Entrada value={p.nome ?? ''} onChange={(e) => mudar('nome', e.target.value)} maxLength={80} placeholder="Ex.: Comida preparada" />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="NCM" dica="8 números">
            <Entrada value={p.ncm ?? ''} onChange={(e) => mudar('ncm', soDigitos(e.target.value).slice(0, 8))} inputMode="numeric" />
          </Campo>
          <Campo rotulo="CEST" dica="Obrigatório com CSOSN 500">
            <Entrada value={p.cest ?? ''} onChange={(e) => mudar('cest', soDigitos(e.target.value).slice(0, 7))} inputMode="numeric" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="CFOP">
            <Selecao value={p.cfop} onChange={(e) => mudar('cfop', e.target.value)}>
              {opcoes.cfop.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="Origem">
            <Selecao value={p.origem ?? 0} onChange={(e) => mudar('origem', Number(e.target.value))}>
              {ORIGENS.map((o, i) => (
                <option key={i} value={i}>
                  {o}
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="CSOSN (ICMS do Simples)">
          <Selecao value={p.csosn} onChange={(e) => mudar('csosn', e.target.value)}>
            {Object.entries(opcoes.csosn).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Selecao>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="PIS (CST)">
            <Selecao value={p.pisCst} onChange={(e) => mudar('pisCst', e.target.value)}>
              {Object.entries(opcoes.pisCofins).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo rotulo="COFINS (CST)">
            <Selecao value={p.cofinsCst} onChange={(e) => mudar('cofinsCst', e.target.value)}>
              {Object.entries(opcoes.pisCofins).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Selecao>
          </Campo>
        </div>
        <Campo rotulo="Carga tributária aproximada (%)" dica="Lei da Transparência (IBPT). Opcional.">
          <Entrada value={p.cargaAprox ?? ''} onChange={(e) => mudar('cargaAprox', e.target.value)} inputMode="decimal" />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}
