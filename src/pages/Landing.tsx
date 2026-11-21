import { BellRing, Boxes, ChefHat, FileText, QrCode, Smartphone, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/comuns';
import { Botao } from '../components/ui';

const RECURSOS = [
  { icone: QrCode, titulo: 'Pedido pela mesa', texto: 'O cliente lê o QR Code, vê o cardápio com fotos e pede direto do celular, sem baixar nada.' },
  { icone: ChefHat, titulo: 'Cozinha em tempo real', texto: 'Os pedidos chegam na hora, com aviso sonoro. Mude o status e o cliente acompanha.' },
  { icone: BellRing, titulo: 'Garçom no celular', texto: 'Notificações de “pronto para servir”, “chamando” e “pediu a conta” no celular de cada garçom.' },
  { icone: Boxes, titulo: 'Controle de estoque', texto: 'Baixa automática a cada pedido. Quando acaba, o item aparece como esgotado.' },
  { icone: FileText, titulo: 'Nota fiscal (NFC-e)', texto: 'Emita a NFC-e direto na Sefaz ao fechar a conta, com cupom e XML.' },
  { icone: Sparkles, titulo: 'Cardápio por foto', texto: 'Tire uma foto do cardápio impresso e a inteligência artificial monta o digital para você revisar.' },
];

const TELAS = [
  { img: 'cliente-cardapio', titulo: 'Cardápio no celular do cliente' },
  { img: 'gestao-mesas', titulo: 'Mapa de mesas' },
  { img: 'gestao-pedidos', titulo: 'Pedidos da cozinha' },
  { img: 'garcom', titulo: 'App do garçom' },
  { img: 'gestao-estoque', titulo: 'Estoque' },
  { img: 'cliente-conta', titulo: 'Conta da mesa' },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/">
              <Botao variante="fantasma">Entrar</Botao>
            </Link>
            <Link to="/cadastro" className="hidden sm:block">
              <Botao>Teste grátis</Botao>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-marca-clara to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-marca shadow-sm ring-1 ring-marca/20">
              <Smartphone className="h-4 w-4" /> Cardápio digital + gestão
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl">
              Seu restaurante recebendo pedidos <span className="text-marca">pela mesa</span>.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-stone-600">
              QR Code em cada mesa, pedidos direto na cozinha, garçom avisado no celular e conta fechada com nota fiscal. Tudo em um só lugar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/cadastro">
                <Botao tamanho="g" largo>
                  Começar 7 dias grátis
                </Botao>
              </Link>
              <a href="#video">
                <Botao tamanho="g" variante="secundario" largo>
                  Ver como funciona
                </Botao>
              </a>
            </div>
            <p className="mt-3 text-sm text-stone-500">Sem cartão de crédito. Cancele quando quiser.</p>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 rounded-[3rem] bg-marca/10 blur-2xl" />
            <img src="/landing/cliente-cardapio.webp" alt="Cardápio no celular" className="relative w-full rounded-[2rem] border-8 border-stone-900 shadow-flutuante" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Tudo o que o salão precisa</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="cartao p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-marca-clara text-marca">
                <Icone className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold">{titulo}</h3>
              <p className="mt-1.5 text-sm text-stone-600">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="video" className="bg-stone-950 py-16 text-white">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center text-3xl font-extrabold tracking-tight">Veja funcionando</h2>
          {/* O vídeo sempre cabe inteiro na tela: no máximo 80% da altura visível, sem cortar nem rolar. */}
          <video
            controls
            playsInline
            preload="none"
            poster="/landing/video-capa.jpg"
            className="mx-auto mt-8 block aspect-video w-full max-w-[min(100%,calc(80dvh*16/9))] rounded-2xl bg-black object-contain shadow-flutuante"
          >
            <source src="/landing/video-apresentacao.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Feito para o celular e para o computador</h2>
        <div className="sem-rolagem mt-10 flex snap-x gap-5 overflow-x-auto pb-4">
          {TELAS.map((t) => (
            <figure key={t.img} className="w-64 shrink-0 snap-center">
              <img src={`/landing/${t.img}.webp`} alt={t.titulo} loading="lazy" className="aspect-[9/16] w-full rounded-2xl border border-stone-200 object-cover object-top shadow-cartao" />
              <figcaption className="mt-2 text-center text-sm font-medium text-stone-600">{t.titulo}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-3xl bg-marca px-6 py-12 text-center text-white">
          <Users className="h-10 w-10" />
          <h2 className="text-3xl font-extrabold tracking-tight">Pronto para modernizar o atendimento?</h2>
          <p className="max-w-lg text-white/85">Cadastre o restaurante, monte o cardápio e imprima os QR Codes. Em minutos você já está recebendo pedidos.</p>
          <Link to="/cadastro">
            <Botao tamanho="g" variante="secundario" className="text-marca">
              Criar minha conta grátis
            </Botao>
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-100 py-8 text-center text-sm text-stone-500">© {new Date().getFullYear()} Cardápio Online</footer>
    </div>
  );
}
