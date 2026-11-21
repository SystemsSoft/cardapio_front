import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';
import { Aviso, Botao, Campo, Entrada, Titulo, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { CORES_SUGERIDAS, COR_PADRAO, aplicarMarca, variaveisDaMarca } from '../../lib/marca';
import type { Restaurante } from '../../lib/tipos';
import { useGestao } from './contexto';

export default function Identidade() {
  const { restaurante, setRestaurante } = useGestao();
  const { avisar } = useAvisos();
  const [nome, setNome] = useState(restaurante.nome);
  const [frase, setFrase] = useState(restaurante.marca.frase ?? '');
  const [cor, setCor] = useState(restaurante.marca.cor ?? COR_PADRAO);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState<'logo' | 'capa' | null>(null);
  const [erro, setErro] = useState('');

  const atualizar = (r: Restaurante) => {
    setRestaurante(r);
    aplicarMarca(r.marca.cor);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro('');
    try {
      atualizar(await gestao.put<Restaurante>('/identidade', { nome, frase, cor }));
      avisar('Identidade visual salva. Os clientes já veem a nova aparência.');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const enviar = async (tipo: 'logo' | 'capa', f: File | undefined) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return setErro('Imagem grande demais (máximo 8 MB).');
    setEnviando(tipo);
    setErro('');
    try {
      atualizar(await gestao.enviar<Restaurante>(`/identidade/${tipo}`, f));
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(null);
    }
  };

  const remover = async (tipo: 'logo' | 'capa') => {
    try {
      atualizar(await gestao.del<Restaurante>(`/identidade/${tipo}`));
    } catch (e) {
      setErro(mensagemDe(e));
    }
  };

  const { marca } = restaurante;

  return (
    <>
      <Titulo titulo="Identidade visual" subtitulo="Como o seu restaurante aparece no celular do cliente." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="cartao space-y-4 p-5">
            <Campo rotulo="Nome exibido">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
            </Campo>
            <Campo rotulo="Frase de destaque" dica="Aparece embaixo do nome. Ex.: “Hambúrguer artesanal desde 2015”.">
              <Entrada value={frase} onChange={(e) => setFrase(e.target.value)} maxLength={90} />
            </Campo>
            <div>
              <p className="rotulo">Cor da marca</p>
              <div className="flex flex-wrap items-center gap-2">
                {CORES_SUGERIDAS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    style={{ background: c }}
                    className={cx('h-9 w-9 rounded-full ring-offset-2 transition', cor === c && 'ring-2 ring-stone-900')}
                    aria-label={c}
                  />
                ))}
                <label className="relative flex h-9 items-center gap-2 rounded-full border border-stone-300 bg-white pl-1 pr-3 text-sm">
                  <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                  {cor}
                </label>
              </div>
            </div>
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            <Botao carregando={salvando} onClick={salvar}>
              Salvar
            </Botao>
          </section>

          <section className="grid gap-5 sm:grid-cols-2">
            <EnvioImagem titulo="Logo" dica="Quadrada, de preferência PNG com fundo transparente." atual={marca.logo} carregando={enviando === 'logo'} aoEscolher={(f) => enviar('logo', f)} aoRemover={() => remover('logo')} quadrada />
            <EnvioImagem titulo="Foto de capa" dica="Horizontal: o salão, um prato de destaque…" atual={marca.capa} carregando={enviando === 'capa'} aoEscolher={(f) => enviar('capa', f)} aoRemover={() => remover('capa')} />
          </section>
        </div>

        {/* Prévia do celular */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <p className="mb-2 text-sm font-semibold text-stone-500">Prévia</p>
          <div className="mx-auto w-[300px] overflow-hidden rounded-[2.2rem] border-[10px] border-stone-900 bg-fundo shadow-flutuante" style={variaveisDaMarca(cor) as CSSProperties}>
            <div className="relative h-28 bg-marca">
              {marca.capa ? <img src={marca.capa} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-marca to-marca-escura" />}
              <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold">Mesa 5</span>
            </div>
            <div className="-mt-8 flex items-end gap-2 px-3">
              <div className="h-16 w-16 overflow-hidden rounded-xl border-4 border-fundo bg-white">
                {marca.logo ? (
                  <img src={marca.logo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-marca-clara text-2xl font-extrabold text-marca">{nome.slice(0, 1).toUpperCase()}</div>
                )}
              </div>
              <div className="min-w-0 pb-1">
                <p className="truncate font-extrabold">{nome || 'Seu restaurante'}</p>
                {frase && <p className="truncate text-xs text-stone-600">{frase}</p>}
              </div>
            </div>
            <div className="flex gap-1.5 px-3 pt-3">
              <span className="rounded-full bg-marca px-2.5 py-1 text-[11px] font-semibold text-white">Lanches</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold ring-1 ring-stone-200">Bebidas</span>
            </div>
            <div className="space-y-2 p-3">
              {['X-Burger', 'Batata frita'].map((p, i) => (
                <div key={p} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p}</p>
                    <p className="text-xs font-bold">R$ {i ? '22,00' : '32,90'}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-stone-100 text-xl">{i ? '🍟' : '🍔'}</div>
                </div>
              ))}
              <div className="rounded-xl bg-marca py-2.5 text-center text-sm font-semibold text-white">Ver carrinho</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function EnvioImagem({
  titulo,
  dica,
  atual,
  carregando,
  aoEscolher,
  aoRemover,
  quadrada,
}: {
  titulo: string;
  dica: string;
  atual: string | null;
  carregando: boolean;
  aoEscolher: (f: File | undefined) => void;
  aoRemover: () => void;
  quadrada?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="cartao p-5">
      <p className="font-semibold">{titulo}</p>
      <p className="mb-3 text-xs text-stone-500">{dica}</p>
      <div className={cx('mb-3 overflow-hidden rounded-xl bg-stone-100', quadrada ? 'mx-auto h-32 w-32' : 'aspect-[16/7]')}>
        {atual ? <img src={atual} alt={titulo} className={cx('h-full w-full', quadrada ? 'object-contain' : 'object-cover')} /> : <div className="flex h-full items-center justify-center text-sm text-stone-400">Sem imagem</div>}
      </div>
      <div className="flex gap-2">
        <Botao tamanho="p" variante="secundario" icone={<ImagePlus className="h-4 w-4" />} carregando={carregando} onClick={() => ref.current?.click()}>
          {atual ? 'Trocar' : 'Enviar'}
        </Botao>
        {atual && (
          <Botao tamanho="p" variante="fantasma" className="text-red-600" icone={<Trash2 className="h-4 w-4" />} onClick={aoRemover}>
            Remover
          </Botao>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => (aoEscolher(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}
