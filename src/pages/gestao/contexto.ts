import { createContext, useContext } from 'react';
import type { EstadoGestao, Restaurante } from '../../lib/tipos';

export interface ContextoGestao {
  restaurante: Restaurante;
  setRestaurante: (r: Restaurante) => void;
  recarregarRestaurante: () => Promise<void>;
  estado: EstadoGestao | null;
  recarregarEstado: () => Promise<void>;
  /** Muda sempre que o cardápio/estoque é alterado (em qualquer aparelho). */
  versaoCardapio: number;
}

export const Contexto = createContext<ContextoGestao | null>(null);

export function useGestao(): ContextoGestao {
  const c = useContext(Contexto);
  if (!c) throw new Error('useGestao fora do layout da gestão');
  return c;
}
