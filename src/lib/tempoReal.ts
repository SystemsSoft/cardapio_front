import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type Manipuladores = Record<string, (dados: any) => void>;

interface Entrada {
  /** Evento de entrada na sala: mesa:entrar, gestao:entrar ou garcom:entrar. */
  evento: string;
  dados: Record<string, unknown>;
}

/**
 * Conexão Socket.IO com o backend. Ao (re)conectar, entra de novo na sala — assim, depois de uma
 * queda de internet, a tela volta a receber os avisos sem precisar recarregar.
 * `aoEntrar` recebe a resposta do servidor ({ok, erro?, estado?}).
 */
export function useTempoReal(
  entrada: Entrada | null,
  manipuladores: Manipuladores,
  aoEntrar?: (resposta: { ok: boolean; erro?: string; [k: string]: unknown }) => void,
) {
  const [conectado, setConectado] = useState(false);
  const refs = useRef({ manipuladores, aoEntrar });
  refs.current = { manipuladores, aoEntrar };
  const chave = entrada ? `${entrada.evento}:${JSON.stringify(entrada.dados)}` : '';

  useEffect(() => {
    if (!entrada) return;
    const socket: Socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    const entrar = () => {
      socket.emit(entrada.evento, entrada.dados, (resposta: { ok: boolean; erro?: string }) => {
        refs.current.aoEntrar?.(resposta ?? { ok: false });
      });
    };
    socket.on('connect', () => {
      setConectado(true);
      entrar();
    });
    socket.on('disconnect', () => setConectado(false));
    socket.onAny((evento: string, dados: unknown) => refs.current.manipuladores[evento]?.(dados));
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return conectado;
}
