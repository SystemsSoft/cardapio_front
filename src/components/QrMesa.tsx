import { Copy, Share2 } from 'lucide-react';
import { QrCode } from './comuns';
import { Botao, useAvisos } from './ui';

export function linkDaMesa(rid: string | number, numero: string | number, token: string) {
  return `${window.location.origin}/cliente/${rid}/mesa/${numero}?t=${encodeURIComponent(token)}`;
}

/** QR Code grande da mesa + compartilhar/copiar o link. Usado pelo garçom e pelo próprio cliente. */
export function PainelQrMesa({ link, restaurante, numero, instrucao }: { link: string; restaurante: string; numero: string | number; instrucao: string }) {
  const { avisar } = useAvisos();

  const compartilhar = async () => {
    const texto = `Cardápio da mesa ${numero} · ${restaurante}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: texto, text: `${texto}:`, url: link });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}: ${link}`)}`, '_blank', 'noopener');
  };

  return (
    <div className="flex flex-col items-center pb-2 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-stone-500">{restaurante}</p>
      <p className="mb-3 text-3xl font-extrabold">Mesa {numero}</p>
      <div className="rounded-3xl bg-white p-3 shadow-cartao ring-1 ring-stone-200">
        <QrCode texto={link} tamanho={Math.min(300, window.innerWidth - 110)} />
      </div>
      <p className="mt-4 max-w-xs text-stone-600">{instrucao}</p>
      <div className="mt-5 grid w-full grid-cols-2 gap-2">
        <Botao variante="secundario" icone={<Share2 className="h-4 w-4" />} onClick={compartilhar}>
          Compartilhar
        </Botao>
        <Botao
          variante="secundario"
          icone={<Copy className="h-4 w-4" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              avisar('Link da mesa copiado.');
            } catch {
              avisar('Não foi possível copiar o link.', 'erro');
            }
          }}
        >
          Copiar link
        </Botao>
      </div>
    </div>
  );
}
