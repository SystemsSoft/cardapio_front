// Avisos sonoros (sem arquivos de áudio: gerados com Web Audio).
// O navegador só libera som depois de um toque na página — por isso `liberarSom` é chamado no login.

const CHAVE = 'cardapio:som';
let contexto: AudioContext | null = null;

export function somLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== '0';
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean) {
  try {
    localStorage.setItem(CHAVE, ligado ? '1' : '0');
  } catch {
    /* sem armazenamento */
  }
}

function ctx(): AudioContext | null {
  if (!contexto) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    contexto = new C();
  }
  if (contexto.state === 'suspended') void contexto.resume();
  return contexto;
}

export function liberarSom() {
  ctx();
}

const MELODIAS: Record<string, [number, number][]> = {
  pedido: [
    [880, 0.12],
    [1175, 0.18],
  ],
  garcom: [
    [660, 0.15],
    [660, 0.15],
    [880, 0.25],
  ],
  conta: [
    [988, 0.12],
    [784, 0.12],
    [988, 0.2],
  ],
  pronto: [
    [784, 0.12],
    [1047, 0.22],
  ],
};

export function tocar(tipo: keyof typeof MELODIAS | string) {
  if (!somLigado()) return;
  const c = ctx();
  if (!c) return;
  let t = c.currentTime;
  for (const [freq, dur] of MELODIAS[tipo] ?? MELODIAS.pedido) {
    const osc = c.createOscillator();
    const ganho = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(ganho).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    t += dur + 0.04;
  }
  navigator.vibrate?.([120, 60, 120]);
}
