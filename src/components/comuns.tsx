import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { cx } from './ui';

/** Foto enviada (/uploads/...), link externo ou emoji. */
export function ehImagem(imagem: string | null | undefined): boolean {
  return !!imagem && (imagem.startsWith('/') || /^https?:\/\//.test(imagem));
}

export function ImagemProduto({ imagem, nome, className }: { imagem: string; nome: string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (ehImagem(imagem) && !falhou) {
    return <img src={imagem} alt={nome} loading="lazy" onError={() => setFalhou(true)} className={cx('object-cover', className)} />;
  }
  return (
    <div className={cx('flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100', className)}>
      <span className="text-[2.2em] leading-none">{!ehImagem(imagem) && imagem ? imagem : '🍽️'}</span>
    </div>
  );
}

export function Logo({ className, claro }: { className?: string; claro?: boolean }) {
  return (
    <div className={cx('flex items-center gap-2', className)}>
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={cx('text-lg font-extrabold tracking-tight', claro ? 'text-white' : 'text-stone-900')}>
        Cardápio<span className="text-marca"> Online</span>
      </span>
    </div>
  );
}

export function QrCode({ texto, tamanho = 220, className }: { texto: string; tamanho?: number; className?: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vivo = true;
    QRCode.toDataURL(texto, { width: tamanho * 2, margin: 1, errorCorrectionLevel: 'M' })
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(''));
    return () => {
      vivo = false;
    };
  }, [texto, tamanho]);
  return url ? (
    <img src={url} width={tamanho} height={tamanho} alt="QR Code" className={className} />
  ) : (
    <div style={{ width: tamanho, height: tamanho }} className={cx('animate-pulsar rounded-lg bg-stone-100', className)} />
  );
}

/** Relógio que força a tela a redesenhar (para "há 5 min" ficar sempre certo). */
export function useAgora(intervaloMs = 30000) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

export function Contador({ valor, aoMudar, min = 1, max = 99 }: { valor: number; aoMudar: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-stone-200 bg-white">
      <button type="button" className="h-10 w-10 text-xl font-semibold text-stone-600 disabled:opacity-30" disabled={valor <= min} onClick={() => aoMudar(valor - 1)} aria-label="Diminuir">
        −
      </button>
      <span className="w-8 text-center font-bold tabular-nums">{valor}</span>
      <button type="button" className="h-10 w-10 text-xl font-semibold text-marca disabled:opacity-30" disabled={valor >= max} onClick={() => aoMudar(valor + 1)} aria-label="Aumentar">
        +
      </button>
    </div>
  );
}
