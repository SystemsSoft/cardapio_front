import {
  Armchair,
  BookOpen,
  Boxes,
  Camera,
  ClipboardList,
  FileCheck,
  FileText,
  History,
  LogOut,
  Menu,
  Palette,
  QrCode,
  Settings,
  Store,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../../components/comuns';
import { Aviso, Botao, BotaoIcone, Carregando, cx, useAvisos } from '../../components/ui';
import { gestao, sessao } from '../../lib/api';
import { aplicarMarca } from '../../lib/marca';
import { definirSom, liberarSom, somLigado, tocar } from '../../lib/som';
import { useTempoReal } from '../../lib/tempoReal';
import type { EstadoGestao, Restaurante } from '../../lib/tipos';
import { Contexto } from './contexto';

interface ItemMenu {
  to: string;
  rotulo: string;
  icone: typeof Store;
  badge?: number;
  alerta?: boolean;
  sempre?: boolean;
}

export default function LayoutGestao() {
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [estado, setEstado] = useState<EstadoGestao | null>(null);
  const [versaoCardapio, setVersaoCardapio] = useState(0);
  const [menuAberto, setMenuAberto] = useState(false);
  const [som, setSom] = useState(somLigado());
  const navegar = useNavigate();
  const local = useLocation();
  const { avisar } = useAvisos();
  const token = sessao.ler();
  const espera = useRef<ReturnType<typeof setTimeout>>();

  const sair = useCallback(
    async (chamarApi = true) => {
      if (chamarApi) {
        await fetch('/api/auth/sair', { method: 'POST', headers: { Authorization: `Bearer ${sessao.ler() ?? ''}` } }).catch(() => {});
      }
      sessao.limpar();
      navegar('/', { replace: true });
    },
    [navegar],
  );

  const recarregarRestaurante = useCallback(async () => {
    const r = await gestao.get<Restaurante>('/restaurante');
    setRestaurante(r);
    aplicarMarca(r.marca.cor);
  }, []);

  const recarregarEstado = useCallback(async () => {
    try {
      setEstado(await gestao.get<EstadoGestao>('/estado'));
    } catch {
      /* 402/401 tratados pelos eventos globais */
    }
  }, []);

  // Vários eventos seguidos (ex.: 3 pedidos) viram um recarregamento só.
  const agendarEstado = useCallback(() => {
    clearTimeout(espera.current);
    espera.current = setTimeout(recarregarEstado, 200);
  }, [recarregarEstado]);

  useEffect(() => {
    if (!token) return;
    recarregarRestaurante().catch(() => {});
    const expirou = () => sair(false);
    const bloqueou = () => {
      recarregarRestaurante().catch(() => {});
      navegar('/gestao/restaurante#assinatura');
    };
    window.addEventListener('cardapio:sessao-expirada', expirou);
    window.addEventListener('cardapio:bloqueado', bloqueou);
    const liberar = () => liberarSom();
    window.addEventListener('pointerdown', liberar, { once: true });
    return () => {
      window.removeEventListener('cardapio:sessao-expirada', expirou);
      window.removeEventListener('cardapio:bloqueado', bloqueou);
      window.removeEventListener('pointerdown', liberar);
    };
  }, [token, recarregarRestaurante, sair, navegar]);

  const liberado = restaurante?.assinatura.liberado ?? false;

  useEffect(() => {
    if (liberado) recarregarEstado();
  }, [liberado, recarregarEstado]);

  useTempoReal(
    liberado && token ? { evento: 'gestao:entrar', dados: { token } } : null,
    {
      'gestao:evento': (e: { tipo: string; mesa?: number; por?: string }) => {
        if (e.tipo === 'novo-pedido') {
          tocar('pedido');
          avisar(`🆕 Novo pedido · Mesa ${e.mesa}`, 'info');
        } else if (e.tipo === 'garcom-chamado') {
          tocar('garcom');
          avisar(`🙋 Mesa ${e.mesa} está chamando o garçom`, 'info');
        } else if (e.tipo === 'fechamento-solicitado') {
          tocar('conta');
          avisar(`🧾 Mesa ${e.mesa} pediu a conta`, 'info');
        } else if (e.tipo === 'mesa-fechada' && e.por) {
          avisar(`Mesa ${e.mesa} fechada pelo ${e.por}`, 'info');
        }
        agendarEstado();
      },
      'cardapio:alterado': () => {
        setVersaoCardapio((v) => v + 1);
        agendarEstado();
      },
    },
    (r) => {
      if (r.ok) agendarEstado();
    },
  );

  const contagens = useMemo(() => {
    const mesas = estado?.mesas ?? [];
    const pedidos = mesas.flatMap((m) => m.sessao?.pedidos ?? []);
    return {
      novos: pedidos.filter((p) => p.status === 'recebido').length,
      prontos: pedidos.filter((p) => p.status === 'pronto').length,
      alertasMesa: mesas.filter((m) => m.sessao?.garcomChamadoEm || m.sessao?.status === 'fechamento_solicitado').length,
      estoque: (estado?.estoque.esgotados ?? 0) + (estado?.estoque.baixos ?? 0),
    };
  }, [estado]);

  if (!token) return <Navigate to="/" replace />;
  if (!restaurante) return <Carregando tela />;

  const grupos: { titulo: string; itens: ItemMenu[] }[] = [
    {
      titulo: 'Salão',
      itens: [
        { to: 'mesas', rotulo: 'Mesas', icone: Armchair, badge: contagens.alertasMesa, alerta: true },
        { to: 'pedidos', rotulo: 'Pedidos', icone: ClipboardList, badge: contagens.novos, alerta: true },
        { to: 'garcons', rotulo: 'Garçons', icone: Users },
        { to: 'historico', rotulo: 'Histórico', icone: History },
        { to: 'caixa', rotulo: 'Fechamentos de caixa', icone: Wallet },
        { to: 'notas', rotulo: 'Notas fiscais', icone: FileText },
      ],
    },
    {
      titulo: 'Cardápio',
      itens: [
        { to: 'cardapio', rotulo: 'Cardápio', icone: BookOpen },
        { to: 'escanear', rotulo: 'Escanear cardápio', icone: Camera },
        { to: 'estoque', rotulo: 'Estoque', icone: Boxes, badge: contagens.estoque },
        { to: 'identidade', rotulo: 'Identidade visual', icone: Palette },
        { to: 'qrcodes', rotulo: 'QR Codes', icone: QrCode },
      ],
    },
    {
      titulo: 'Conta',
      itens: [
        { to: 'restaurante', rotulo: 'Dados e assinatura', icone: Store, sempre: true },
        { to: 'nota-fiscal', rotulo: 'Configurar nota fiscal', icone: Settings },
        { to: 'contrato', rotulo: 'Contrato', icone: FileCheck, sempre: true, badge: restaurante.contrato.pendente ? 1 : 0 },
      ],
    },
  ];

  const secaoAtual = local.pathname.split('/')[2] || 'mesas';
  const itemAtual = grupos.flatMap((g) => g.itens).find((i) => i.to === secaoAtual);
  if (!liberado && itemAtual && !itemAtual.sempre) return <Navigate to="/gestao/restaurante#assinatura" replace />;

  const alternarSom = () => {
    const novo = !som;
    setSom(novo);
    definirSom(novo);
    if (novo) tocar('pedido');
  };

  const menu = (
    <nav className="flex flex-col gap-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-stone-400">{g.titulo}</p>
          {g.itens.map((i) => {
            const bloqueadoItem = !liberado && !i.sempre;
            return (
              <NavLink
                key={i.to}
                to={bloqueadoItem ? 'restaurante#assinatura' : i.to}
                onClick={() => setMenuAberto(false)}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive && !bloqueadoItem ? 'bg-marca-clara text-marca-escura' : 'text-stone-600 hover:bg-stone-100',
                    bloqueadoItem && 'opacity-40',
                  )
                }
              >
                <i.icone className="h-[18px] w-[18px]" />
                <span className="flex-1">{i.rotulo}</span>
                {!!i.badge && (
                  <span className={cx('rounded-full px-1.5 text-xs font-bold', i.alerta ? 'bg-marca text-white' : 'bg-amber-100 text-amber-800')}>{i.badge}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
      <button type="button" onClick={() => sair()} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700">
        <LogOut className="h-[18px] w-[18px]" /> Sair
      </button>
    </nav>
  );

  const ctx = { restaurante, setRestaurante, recarregarRestaurante, estado, recarregarEstado, versaoCardapio };

  return (
    <Contexto.Provider value={ctx}>
      <div className="min-h-dvh lg:pl-64 print:pl-0">
        {/* Barra lateral (computador) */}
        <aside className="nao-imprimir fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200 bg-white lg:flex">
          <div className="border-b border-stone-100 px-5 py-4">
            <Logo />
          </div>
          <Link to="restaurante" className="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-stone-50 p-3 hover:bg-stone-100">
            <MarcaMini restaurante={restaurante} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{restaurante.nome}</p>
              <p className="truncate text-xs text-stone-500">@{restaurante.usuario}</p>
            </div>
          </Link>
          <div className="rolagem-fina flex-1 overflow-y-auto px-3 py-4">{menu}</div>
        </aside>

        {/* Topo (celular e computador) */}
        <header className="nao-imprimir pt-seguro sticky top-0 z-20 border-b border-stone-200/70 bg-fundo/90 backdrop-blur">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
            <BotaoIcone rotulo="Menu" className="lg:hidden" onClick={() => setMenuAberto(true)}>
              <Menu className="h-5 w-5" />
            </BotaoIcone>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
              <MarcaMini restaurante={restaurante} pequena />
              <span className="truncate font-semibold">{restaurante.nome}</span>
            </div>
            <div className="hidden flex-1 lg:block" />
            <BotaoIcone rotulo={som ? 'Desligar som dos avisos' : 'Ligar som dos avisos'} onClick={alternarSom}>
              {som ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-red-500" />}
            </BotaoIcone>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <div className="nao-imprimir">
            <Faixas restaurante={restaurante} />
          </div>
          <Outlet />
        </main>

        {/* Navegação inferior (celular) */}
        <nav className="nao-imprimir pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex">
            <ItemInferior to="mesas" rotulo="Mesas" icone={Armchair} badge={contagens.alertasMesa} bloqueado={!liberado} />
            <ItemInferior to="pedidos" rotulo="Pedidos" icone={ClipboardList} badge={contagens.novos} bloqueado={!liberado} />
            <ItemInferior to="cardapio" rotulo="Cardápio" icone={BookOpen} bloqueado={!liberado} />
            <button type="button" onClick={() => setMenuAberto(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-stone-500">
              <Menu className="h-6 w-6" /> Mais
            </button>
          </div>
        </nav>

        {/* Menu lateral (celular) */}
        {menuAberto && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-stone-950/50" onClick={() => setMenuAberto(false)} />
            <div className="pt-seguro absolute inset-y-0 left-0 flex w-[85%] max-w-xs animate-surgir flex-col bg-white shadow-flutuante">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <Logo />
                <BotaoIcone rotulo="Fechar menu" onClick={() => setMenuAberto(false)}>
                  <X className="h-5 w-5" />
                </BotaoIcone>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">{menu}</div>
            </div>
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

function ItemInferior({ to, rotulo, icone: Icone, badge, bloqueado }: { to: string; rotulo: string; icone: typeof Store; badge?: number; bloqueado?: boolean }) {
  return (
    <NavLink
      to={bloqueado ? 'restaurante#assinatura' : to}
      className={({ isActive }) =>
        cx('relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive && !bloqueado ? 'text-marca' : 'text-stone-500', bloqueado && 'opacity-40')
      }
    >
      <Icone className="h-6 w-6" />
      {rotulo}
      {!!badge && (
        <span className="absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-marca px-1 text-[10px] text-white">{badge}</span>
      )}
    </NavLink>
  );
}

function MarcaMini({ restaurante, pequena }: { restaurante: Restaurante; pequena?: boolean }) {
  const t = pequena ? 'h-8 w-8 text-sm' : 'h-10 w-10';
  return restaurante.marca.logo ? (
    <img src={restaurante.marca.logo} alt="" className={cx('shrink-0 rounded-lg bg-white object-contain ring-1 ring-stone-200', t)} />
  ) : (
    <div className={cx('flex shrink-0 items-center justify-center rounded-lg bg-marca font-bold text-white', t)}>{restaurante.nome.slice(0, 1).toUpperCase()}</div>
  );
}

function Faixas({ restaurante }: { restaurante: Restaurante }) {
  const a = restaurante.assinatura;
  const local = useLocation();
  const naAssinatura = local.pathname.endsWith('/restaurante');
  const faixas: ReactNode[] = [];
  if (!a.liberado && !naAssinatura) {
    faixas.push(
      <Aviso key="b" tipo="erro" titulo="Seu período de teste terminou" acao={<Link to="restaurante#assinatura"><Botao tamanho="p">Ativar assinatura</Botao></Link>}>
        Ative a assinatura para voltar a receber pedidos.
      </Aviso>,
    );
  } else if (a.tipo === 'teste' && a.diasRestantesTeste <= 3 && !naAssinatura) {
    faixas.push(
      <Aviso key="t" tipo="alerta" titulo={`Seu teste grátis termina em ${a.diasRestantesTeste} ${a.diasRestantesTeste === 1 ? 'dia' : 'dias'}`} acao={<Link to="restaurante#assinatura"><Botao tamanho="p">Assinar agora</Botao></Link>}>
        Assine para não interromper os pedidos pelo celular.
      </Aviso>,
    );
  } else if (a.tipo === 'pendente') {
    faixas.push(
      <Aviso key="p" tipo="alerta" titulo="Pagamento da assinatura pendente" acao={<Link to="restaurante#assinatura"><Botao tamanho="p" variante="secundario">Ver assinatura</Botao></Link>}>
        A última cobrança não foi aprovada. Atualize o cartão para evitar o bloqueio.
      </Aviso>,
    );
  }
  if (restaurante.contrato.pendente && !local.pathname.endsWith('/contrato')) {
    faixas.push(
      <Aviso key="c" tipo="info" titulo="Contrato de uso disponível" acao={<Link to="contrato"><Botao tamanho="p" variante="secundario">Ler e aceitar</Botao></Link>}>
        Leia e aceite o contrato de licença de uso do sistema.
      </Aviso>,
    );
  }
  return faixas.length ? <div className="mb-5 space-y-3">{faixas}</div> : null;
}
