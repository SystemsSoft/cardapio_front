import { Loader2, X } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------- Botões ----------

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso' | 'escuro';
type Tamanho = 'p' | 'm' | 'g';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marca text-white hover:bg-marca-escura shadow-sm shadow-marca/30',
  secundario: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 shadow-sm',
  fantasma: 'text-stone-700 hover:bg-stone-100',
  perigo: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  escuro: 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm',
};
const TAMANHOS: Record<Tamanho, string> = {
  p: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  m: 'h-10 px-4 text-sm gap-2 rounded-xl',
  g: 'h-12 px-5 text-base gap-2 rounded-xl',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  icone?: ReactNode;
  largo?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = 'primario', tamanho = 'm', carregando, icone, largo, className, children, disabled, type = 'button', ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTES[variante],
        TAMANHOS[tamanho],
        largo && 'w-full',
        className,
      )}
      {...resto}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  );
});

export function BotaoIcone({
  className,
  rotulo,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-stone-600 transition hover:bg-stone-100 active:scale-95 disabled:opacity-40',
        className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

// ---------- Formulários ----------

export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className,
}: {
  rotulo?: ReactNode;
  dica?: ReactNode;
  erro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      {rotulo && <span className="rotulo">{rotulo}</span>}
      {children}
      {erro ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{erro}</span>
      ) : (
        dica && <span className="mt-1 block text-xs text-stone-500">{dica}</span>
      )}
    </label>
  );
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Entrada(
  { className, ...resto },
  ref,
) {
  return <input ref={ref} className={cx('campo', className)} {...resto} />;
});

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function AreaTexto(
  { className, ...resto },
  ref,
) {
  return <textarea ref={ref} className={cx('campo min-h-[80px] resize-y', className)} {...resto} />;
});

export function Selecao({ className, children, ...resto }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('campo appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: SETA }} {...resto}>
      {children}
    </select>
  );
}
const SETA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Interruptor({
  ligado,
  aoMudar,
  rotulo,
  disabled,
}: {
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => aoMudar(!ligado)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50',
        ligado ? 'bg-emerald-500' : 'bg-stone-300',
      )}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition', ligado ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

// ---------- Exibição ----------

type CorSelo = 'cinza' | 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'marca' | 'roxo';
const SELOS: Record<CorSelo, string> = {
  cinza: 'bg-stone-100 text-stone-700 ring-stone-200',
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amarelo: 'bg-amber-50 text-amber-800 ring-amber-200',
  vermelho: 'bg-red-50 text-red-700 ring-red-200',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200',
  roxo: 'bg-violet-50 text-violet-700 ring-violet-200',
  marca: 'bg-marca-clara text-marca-escura ring-marca/20',
};

export function Selo({ cor = 'cinza', children, className }: { cor?: CorSelo; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', SELOS[cor], className)}>
      {children}
    </span>
  );
}

export function Carregando({ texto = 'Carregando…', tela }: { texto?: string; tela?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 text-stone-500', tela ? 'min-h-[70vh]' : 'py-16')}>
      <Loader2 className="h-7 w-7 animate-spin text-marca" />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

export function Vazio({ icone, titulo, children }: { icone?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icone && <div className="mb-3 text-4xl text-stone-300">{icone}</div>}
      <p className="font-semibold text-stone-700">{titulo}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function Aviso({
  tipo = 'info',
  titulo,
  children,
  acao,
  className,
}: {
  tipo?: 'info' | 'alerta' | 'erro' | 'sucesso';
  titulo?: ReactNode;
  children?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  const estilos = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    alerta: 'bg-amber-50 border-amber-200 text-amber-900',
    erro: 'bg-red-50 border-red-200 text-red-900',
    sucesso: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[tipo];
  return (
    <div className={cx('flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center', estilos, className)}>
      <div className="flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cx(!!titulo && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {acao}
    </div>
  );
}

export function Titulo({ titulo, subtitulo, acoes }: { titulo: ReactNode; subtitulo?: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-stone-500">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Abas<T extends string>({
  abas,
  atual,
  aoMudar,
  className,
}: {
  abas: { valor: T; rotulo: ReactNode; contador?: number }[];
  atual: T;
  aoMudar: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('sem-rolagem -mx-1 flex gap-1 overflow-x-auto px-1', className)}>
      {abas.map((a) => (
        <button
          key={a.valor}
          type="button"
          onClick={() => aoMudar(a.valor)}
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition',
            atual === a.valor ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50',
          )}
        >
          {a.rotulo}
          {a.contador ? (
            <span className={cx('rounded-full px-1.5 text-xs', atual === a.valor ? 'bg-white/20' : 'bg-stone-100')}>{a.contador}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

// ---------- Janela (modal no computador, folha de baixo no celular) ----------

export function Janela({
  aberta,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-[2px]" onClick={aoFechar} />
      <div
        className={cx(
          'relative flex max-h-[92dvh] w-full animate-subir flex-col rounded-t-3xl bg-white shadow-flutuante sm:animate-surgir sm:rounded-2xl',
          largura,
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-stone-300 sm:hidden" />
        {titulo !== undefined && (
          <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
            <h2 className="flex-1 text-lg font-bold">{titulo}</h2>
            <BotaoIcone rotulo="Fechar" onClick={aoFechar} className="-mr-2">
              <X className="h-5 w-5" />
            </BotaoIcone>
          </div>
        )}
        <div className="rolagem-fina flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="pb-seguro border-t border-stone-100 px-5 py-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Avisos rápidos (toasts) e confirmação ----------

type Toast = { id: number; texto: string; tipo: 'ok' | 'erro' | 'info' };
type Confirmacao = { titulo: string; texto?: ReactNode; confirmar?: string; perigo?: boolean; resolver: (ok: boolean) => void };

const Contexto = createContext<{
  avisar: (texto: string, tipo?: Toast['tipo']) => void;
  confirmar: (c: Omit<Confirmacao, 'resolver'>) => Promise<boolean>;
}>({ avisar: () => {}, confirmar: async () => false });

export function ProvedorAvisos({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<Confirmacao | null>(null);

  const avisar = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 6000 : 3500);
  }, []);

  const confirmar = useCallback(
    (c: Omit<Confirmacao, 'resolver'>) => new Promise<boolean>((resolver) => setConf({ ...c, resolver })),
    [],
  );

  const responder = (ok: boolean) => {
    conf?.resolver(ok);
    setConf(null);
  };

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                'pointer-events-auto max-w-md animate-surgir rounded-xl px-4 py-2.5 text-sm font-medium shadow-flutuante',
                t.tipo === 'erro' ? 'bg-red-600 text-white' : t.tipo === 'info' ? 'bg-stone-900 text-white' : 'bg-emerald-600 text-white',
              )}
            >
              {t.texto}
            </div>
          ))}
        </div>,
        document.body,
      )}
      <Janela
        aberta={!!conf}
        aoFechar={() => responder(false)}
        titulo={conf?.titulo}
        largura="max-w-md"
        rodape={
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => responder(false)}>
              Cancelar
            </Botao>
            <Botao variante={conf?.perigo ? 'perigo' : 'primario'} onClick={() => responder(true)}>
              {conf?.confirmar ?? 'Confirmar'}
            </Botao>
          </div>
        }
      >
        <div className="text-sm text-stone-600">{conf?.texto}</div>
      </Janela>
    </Contexto.Provider>
  );
}

export const useAvisos = () => useContext(Contexto);
