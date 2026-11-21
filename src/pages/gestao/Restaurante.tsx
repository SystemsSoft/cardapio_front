import { CreditCard, ExternalLink, KeyRound, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Aviso, Botao, Campo, Carregando, Entrada, Selo, Titulo, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { data, reais, telefone } from '../../lib/formato';
import type { PrecoAssinatura, Restaurante as TRestaurante } from '../../lib/tipos';
import { CampoSenha } from '../Acesso';
import { useGestao } from './contexto';

export default function Restaurante() {
  const { restaurante, setRestaurante } = useGestao();
  const { avisar } = useAvisos();
  const [f, setF] = useState({ nome: restaurante.nome, endereco: restaurante.endereco, telefone: restaurante.telefone });
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState('');

  return (
    <>
      <Titulo titulo="Dados e assinatura" subtitulo={`Usuário de acesso: @${restaurante.usuario} · ${restaurante.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <section className="cartao space-y-4 p-5">
            <h2 className="font-bold">Dados do restaurante</h2>
            <Campo rotulo="Nome">
              <Entrada value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={80} />
            </Campo>
            <Campo rotulo="Endereço">
              <Entrada value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} maxLength={200} />
            </Campo>
            <Campo rotulo="Telefone">
              <Entrada value={f.telefone} onChange={(e) => setF({ ...f, telefone: telefone(e.target.value) })} inputMode="tel" />
            </Campo>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <Botao
              icone={<Save className="h-4 w-4" />}
              carregando={salvando}
              onClick={async () => {
                setSalvando(true);
                setErro('');
                try {
                  setRestaurante(await gestao.put<TRestaurante>('/restaurante', f));
                  avisar('Dados salvos.');
                } catch (e) {
                  setErro(mensagemDe(e));
                } finally {
                  setSalvando(false);
                }
              }}
            >
              Salvar
            </Botao>
            <p className="text-xs text-stone-500">Para mudar o e-mail ou o usuário de acesso, fale com o suporte.</p>
          </section>

          <section className="cartao space-y-4 p-5">
            <h2 className="font-bold">Trocar senha</h2>
            <Campo rotulo="Nova senha" dica="Mínimo de 8 caracteres. Os outros aparelhos logados serão desconectados.">
              <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            </Campo>
            <Botao
              variante="secundario"
              icone={<KeyRound className="h-4 w-4" />}
              carregando={trocando}
              disabled={senha.length < 8}
              onClick={async () => {
                setTrocando(true);
                try {
                  await gestao.post('/senha', { nova: senha });
                  setSenha('');
                  avisar('Senha alterada.');
                } catch (e) {
                  avisar(mensagemDe(e), 'erro');
                } finally {
                  setTrocando(false);
                }
              }}
            >
              Trocar senha
            </Botao>
          </section>
        </div>
        <Assinatura />
      </div>
    </>
  );
}

const INTERVALOS: Record<string, [string, string]> = { month: ['mês', 'meses'], year: ['ano', 'anos'], week: ['semana', 'semanas'], day: ['dia', 'dias'] };

function Assinatura() {
  const { restaurante, setRestaurante } = useGestao();
  const { avisar } = useAvisos();
  const local = useLocation();
  const navegar = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const [info, setInfo] = useState<{ preco: PrecoAssinatura | null; disponivel: boolean } | null>(null);
  const [indo, setIndo] = useState(false);
  const a = restaurante.assinatura;

  useEffect(() => {
    gestao
      .get<{ preco: PrecoAssinatura | null; disponivel: boolean }>('/assinatura')
      .then(setInfo)
      .catch(() => setInfo({ preco: null, disponivel: false }));
  }, []);

  useEffect(() => {
    if (local.hash === '#assinatura') ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [local.hash]);

  // Volta do Stripe: sincroniza na hora (sem esperar o webhook).
  useEffect(() => {
    const q = new URLSearchParams(local.search);
    const r = q.get('assinatura');
    if (!r) return;
    navegar('/gestao/restaurante#assinatura', { replace: true });
    if (r === 'ok') {
      gestao
        .post<TRestaurante>('/assinatura/sincronizar')
        .then((x) => {
          setRestaurante(x);
          avisar('Assinatura ativada. Obrigado! 🎉');
        })
        .catch((e) => avisar(mensagemDe(e), 'erro'));
    } else avisar('Pagamento não concluído.', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ir = async (rota: '/assinatura/checkout' | '/assinatura/portal') => {
    setIndo(true);
    try {
      const { url } = await gestao.post<{ url: string }>(rota);
      window.location.href = url;
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
      setIndo(false);
    }
  };

  const selo = {
    teste: <Selo cor="azul">Teste grátis · {a.diasRestantesTeste} {a.diasRestantesTeste === 1 ? 'dia' : 'dias'}</Selo>,
    ativa: <Selo cor="verde">Ativa</Selo>,
    pendente: <Selo cor="amarelo">Pagamento pendente</Selo>,
    cancelada: <Selo cor="vermelho">Cancelada</Selo>,
    expirada: <Selo cor="vermelho">Teste encerrado</Selo>,
  }[a.tipo];

  const p = info?.preco;
  const intervalo = p ? INTERVALOS[p.intervalo] ?? [p.intervalo, p.intervalo] : null;

  return (
    <section id="assinatura" ref={ref} className="cartao h-fit scroll-mt-24 space-y-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">Assinatura</h2>
        {selo}
      </div>
      {!info ? (
        <Carregando />
      ) : (
        <>
          {p && intervalo && (
            <p className="text-3xl font-extrabold tracking-tight">
              {reais(p.centavos)}
              <span className="text-base font-medium text-stone-500">/{p.intervaloQuantidade > 1 ? `${p.intervaloQuantidade} ${intervalo[1]}` : intervalo[0]}</span>
            </p>
          )}
          <ul className="space-y-1 text-sm text-stone-600">
            {a.tipo === 'teste' && <li>Seu teste grátis vai até {data(a.testeAte)}. Assine antes para não interromper os pedidos.</li>}
            {a.tipo === 'ativa' && a.assinaturaAte && <li>{a.cancelaNoFim ? `Cancelada — funciona até ${data(a.assinaturaAte)}.` : `Próxima renovação em ${data(a.assinaturaAte)}.`}</li>}
            {a.tipo === 'pendente' && <li>A última cobrança foi recusada. O Stripe tentará de novo; atualize o cartão para evitar o bloqueio.</li>}
            {!a.liberado && <li className="font-semibold text-red-700">O sistema está pausado: os clientes não conseguem pedir pelo celular.</li>}
            <li>Pagamento seguro pelo Stripe (cartão de crédito). Cancele quando quiser.</li>
          </ul>
          {!info.disponivel ? (
            <Aviso tipo="alerta">A cobrança online ainda não foi configurada. Fale com o suporte do Cardápio Online.</Aviso>
          ) : (
            <div className="flex flex-wrap gap-2">
              {['teste', 'cancelada', 'expirada'].includes(a.tipo) && (
                <Botao icone={<CreditCard className="h-4 w-4" />} carregando={indo} onClick={() => ir('/assinatura/checkout')}>
                  Ativar assinatura
                </Botao>
              )}
              {a.temCadastroStripe && (
                <Botao variante="secundario" icone={<ExternalLink className="h-4 w-4" />} carregando={indo} onClick={() => ir('/assinatura/portal')}>
                  Gerenciar assinatura
                </Botao>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
