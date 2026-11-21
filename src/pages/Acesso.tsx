import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Logo } from '../components/comuns';
import { Aviso, Botao, Campo, Entrada } from '../components/ui';
import { api, mensagemDe, sessao } from '../lib/api';
import { telefone } from '../lib/formato';
import { liberarSom } from '../lib/som';
import type { Restaurante } from '../lib/tipos';

function Moldura({ children, rodape }: { children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-marca-clara via-fundo to-fundo">
      <header className="px-5 py-5">
        <Link to="/landing">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-md">
          <div className="cartao p-6 sm:p-8">{children}</div>
          {rodape && <div className="mt-5 text-center text-sm text-stone-600">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}

export function CampoSenha(props: InputHTMLAttributes<HTMLInputElement>) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Entrada {...props} type={ver ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100"
        aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}
      >
        {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function Login() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  if (sessao.ler()) return <Navigate to="/gestao" replace />;

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    liberarSom();
    try {
      const r = await api.post<{ token: string; restaurante: Restaurante }>('/auth/login', { usuario, senha });
      sessao.salvar(r.token);
      navegar('/gestao', { replace: true });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Moldura
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-marca hover:underline">
            Cadastre seu restaurante — 7 dias grátis
          </Link>
        </>
      }
    >
      <form onSubmit={entrar} className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entrar no seu restaurante</h1>
          <p className="mt-1 text-sm text-stone-500">Acesse a gestão de mesas, pedidos e cardápio.</p>
        </div>
        <Campo rotulo="Usuário">
          <Entrada value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" required autoFocus />
        </Campo>
        <Campo rotulo="Senha">
          <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </Campo>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" largo tamanho="g" carregando={enviando}>
          Entrar
        </Botao>
        <p className="text-center text-xs text-stone-500">
          Esqueceu a senha? Fale com o suporte do Cardápio Online.
        </p>
      </form>
    </Moldura>
  );
}

type Disponibilidade = { usuario: string; disponivel: boolean; motivo: string | null; sugestao: string | null };

export function Cadastro() {
  const [f, setF] = useState({ nome: '', endereco: '', telefone: '', email: '', usuario: '', senha: '', confirmar: '' });
  const [disp, setDisp] = useState<Disponibilidade | null>(null);
  const [checando, setChecando] = useState(false);
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  const mudar = (campo: keyof typeof f, valor: string) => setF((x) => ({ ...x, [campo]: valor }));

  // Sugere o usuário a partir do nome até a pessoa mexer no campo.
  useEffect(() => {
    if (usuarioEditado) return;
    const base = f.nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 30);
    setF((x) => ({ ...x, usuario: base }));
  }, [f.nome, usuarioEditado]);

  useEffect(() => {
    if (f.usuario.length < 3) {
      setDisp(null);
      return;
    }
    setChecando(true);
    const id = setTimeout(async () => {
      try {
        setDisp(await api.get<Disponibilidade>(`/auth/usuario-disponivel?u=${encodeURIComponent(f.usuario)}`));
      } catch {
        setDisp(null);
      } finally {
        setChecando(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [f.usuario]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro('');
    if (f.senha !== f.confirmar) return setErro('As senhas não conferem.');
    if (f.senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.');
    setEnviando(true);
    liberarSom();
    try {
      const { confirmar: _c, ...dados } = f;
      void _c;
      const r = await api.post<{ token: string }>('/auth/cadastro', dados);
      sessao.salvar(r.token);
      navegar('/gestao/cardapio', { replace: true });
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Moldura
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/" className="font-semibold text-marca hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastre seu restaurante</h1>
          <p className="mt-1 text-sm text-stone-500">7 dias grátis, sem cartão. Leva menos de 2 minutos.</p>
        </div>
        <Campo rotulo="Nome do restaurante">
          <Entrada value={f.nome} onChange={(e) => mudar('nome', e.target.value)} required maxLength={80} autoFocus />
        </Campo>
        <Campo rotulo="Endereço">
          <Entrada value={f.endereco} onChange={(e) => mudar('endereco', e.target.value)} required maxLength={200} placeholder="Rua, número, bairro, cidade" />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Telefone (com DDD)">
            <Entrada value={f.telefone} onChange={(e) => mudar('telefone', telefone(e.target.value))} required inputMode="tel" placeholder="(21) 99999-9999" />
          </Campo>
          <Campo rotulo="E-mail">
            <Entrada type="email" value={f.email} onChange={(e) => mudar('email', e.target.value)} required autoComplete="email" />
          </Campo>
        </div>
        <Campo
          rotulo="Usuário para entrar"
          erro={disp && !disp.disponivel ? disp.motivo : undefined}
          dica="Letras minúsculas, números, ponto, hífen ou _ (sem espaços)."
        >
          <div className="relative">
            <Entrada
              value={f.usuario}
              onChange={(e) => {
                setUsuarioEditado(true);
                mudar('usuario', e.target.value.toLowerCase().replace(/\s/g, ''));
              }}
              required
              autoCapitalize="none"
              autoComplete="username"
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checando ? (
                <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
              ) : disp?.disponivel ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : disp ? (
                <X className="h-4 w-4 text-red-500" />
              ) : null}
            </span>
          </div>
        </Campo>
        {disp?.sugestao && (
          <button type="button" className="-mt-2 text-sm font-medium text-marca hover:underline" onClick={() => mudar('usuario', disp.sugestao!)}>
            Usar “{disp.sugestao}”
          </button>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Senha" dica="Mínimo de 8 caracteres.">
            <CampoSenha value={f.senha} onChange={(e) => mudar('senha', e.target.value)} required autoComplete="new-password" minLength={8} />
          </Campo>
          <Campo rotulo="Confirme a senha">
            <CampoSenha value={f.confirmar} onChange={(e) => mudar('confirmar', e.target.value)} required autoComplete="new-password" />
          </Campo>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Botao type="submit" largo tamanho="g" carregando={enviando} disabled={disp ? !disp.disponivel : false}>
          Criar conta e começar o teste grátis
        </Botao>
      </form>
    </Moldura>
  );
}
