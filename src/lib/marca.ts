// Cor da marca do restaurante → variáveis CSS usadas pelas classes `marca`, `marca-escura`, `marca-clara`.

export const COR_PADRAO = '#d9480f';

function rgb(hex: string): [number, number, number] {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? COR_PADRAO.slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function misturar([r, g, b]: [number, number, number], alvo: number, fator: number): string {
  const m = (c: number) => Math.round(c + (alvo - c) * fator);
  return `${m(r)} ${m(g)} ${m(b)}`;
}

export function variaveisDaMarca(cor: string | null | undefined): Record<string, string> {
  const c = rgb(cor || COR_PADRAO);
  return {
    '--marca': c.join(' '),
    '--marca-escura': misturar(c, 0, 0.25),
    '--marca-clara': misturar(c, 255, 0.88),
  };
}

export function aplicarMarca(cor: string | null | undefined) {
  const vars = variaveisDaMarca(cor);
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor || COR_PADRAO);
}

/** Texto legível (preto/branco) sobre a cor da marca. */
export function corDoTexto(cor: string | null | undefined): string {
  const [r, g, b] = rgb(cor || COR_PADRAO);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1c1917' : '#ffffff';
}

export const CORES_SUGERIDAS = [
  '#d9480f',
  '#e03131',
  '#c2255c',
  '#9c36b5',
  '#5f3dc4',
  '#1971c2',
  '#0c8599',
  '#2b8a3e',
  '#5c940d',
  '#e67700',
  '#495057',
  '#212529',
];
