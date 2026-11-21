import { Camera, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../../components/comuns';
import { Aviso, Botao, Entrada } from '../../components/ui';

/** /cliente — abre a câmera para ler o QR Code da mesa (ou aceita o link colado). */
export default function EscanearMesa() {
  const [ligada, setLigada] = useState(false);
  const [erro, setErro] = useState('');
  const [link, setLink] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const navegar = useNavigate();
  const suportado = 'BarcodeDetector' in window;

  const abrir = (texto: string) => {
    try {
      const url = new URL(texto.trim(), window.location.origin);
      if (!/^\/cliente\/\d+\/mesa\/\d+/.test(url.pathname)) throw new Error();
      if (url.origin === window.location.origin) navegar(url.pathname + url.search);
      else window.location.href = url.href;
      return true;
    } catch {
      setErro('Esse QR Code não é de uma mesa do Cardápio Online.');
      return false;
    }
  };

  useEffect(() => {
    if (!ligada) return;
    let fluxo: MediaStream | undefined;
    let ativo = true;
    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current) return;
        video.current.srcObject = fluxo;
        await video.current.play();
        const Detector = (window as unknown as { BarcodeDetector: new (o: object) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } })
          .BarcodeDetector;
        const detector = new Detector({ formats: ['qr_code'] });
        const ler = async () => {
          if (!ativo || !video.current) return;
          try {
            const [codigo] = await detector.detect(video.current);
            if (codigo && abrir(codigo.rawValue)) return;
          } catch {
            /* quadro ainda não pronto */
          }
          setTimeout(ler, 300);
        };
        ler();
      } catch {
        setErro('Não foi possível usar a câmera. Use o app de câmera do celular para ler o QR Code.');
        setLigada(false);
      }
    })();
    return () => {
      ativo = false;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligada]);

  return (
    <div className="flex min-h-dvh flex-col bg-fundo">
      <header className="px-5 py-5">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-10">
        <div className="cartao p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-marca-clara text-marca">
            <QrCode className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold">Escaneie o QR Code da mesa</h1>
          <p className="mt-1 text-sm text-stone-600">Ele fica na mesa ou no display. O cardápio abre direto no seu celular.</p>

          {ligada ? (
            <div className="relative mt-5 overflow-hidden rounded-2xl bg-black">
              <video ref={video} playsInline muted className="aspect-square w-full object-cover" />
              <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-white/80" />
            </div>
          ) : suportado ? (
            <Botao className="mt-5" largo tamanho="g" icone={<Camera className="h-5 w-5" />} onClick={() => (setErro(''), setLigada(true))}>
              Abrir câmera
            </Botao>
          ) : (
            <Aviso className="mt-5 text-left">Abra o app de câmera do seu celular e aponte para o QR Code da mesa.</Aviso>
          )}
          {erro && (
            <Aviso tipo="erro" className="mt-4 text-left">
              {erro}
            </Aviso>
          )}
        </div>

        <form
          className="cartao flex gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            abrir(link);
          }}
        >
          <Entrada value={link} onChange={(e) => setLink(e.target.value)} placeholder="Ou cole aqui o link da mesa" />
          <Botao type="submit" variante="secundario">
            Abrir
          </Botao>
        </form>
      </main>
    </div>
  );
}
