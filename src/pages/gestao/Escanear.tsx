import { Camera, Check, ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Aviso, Botao, Carregando, Entrada, Titulo, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { centavosDoTexto, textoDosCentavos } from '../../lib/formato';

interface Situacao {
  disponivel: boolean;
  restantesHoje: number;
  limiteDia: number;
}

interface Lido {
  id: number;
  categoria: string;
  nome: string;
  descricao: string;
  preco: string;
  marcado: boolean;
}

let proximoId = 1;

export default function Escanear() {
  const { avisar } = useAvisos();
  const navegar = useNavigate();
  const [sit, setSit] = useState<Situacao | null>(null);
  const [itens, setItens] = useState<Lido[]>([]);
  const [lendo, setLendo] = useState(0);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [importando, setImportando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gestao
      .get<Situacao>('/escanear')
      .then(setSit)
      .catch((e) => setErro(mensagemDe(e)));
  }, []);

  const ler = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setErro('');
    for (const f of Array.from(arquivos)) {
      setLendo((n) => n + 1);
      try {
        const r = await gestao.enviar<{ itens: { categoria: string; nome: string; descricao: string; preco: number | null }[]; aviso: string; restantesHoje: number }>(
          '/escanear',
          f,
        );
        setItens((atual) => [
          ...atual,
          ...r.itens.map((i) => ({ id: proximoId++, categoria: i.categoria, nome: i.nome, descricao: i.descricao, preco: textoDosCentavos(i.preco), marcado: true })),
        ]);
        if (r.aviso) setAvisos((a) => [...a, r.aviso]);
        setSit((s) => (s ? { ...s, restantesHoje: r.restantesHoje } : s));
      } catch (e) {
        setErro(`${f.name}: ${mensagemDe(e)}`);
      } finally {
        setLendo((n) => n - 1);
      }
    }
  };

  const mudar = (id: number, campo: keyof Lido, valor: string | boolean) => setItens((l) => l.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  const marcados = itens.filter((i) => i.marcado);
  const semPreco = marcados.filter((i) => centavosDoTexto(i.preco) == null).length;

  const importar = async () => {
    setImportando(true);
    setErro('');
    try {
      const r = await gestao.post<{ criados: number; categoriasNovas: string[] }>('/escanear/importar', {
        itens: marcados.map((i) => ({ categoria: i.categoria, nome: i.nome, descricao: i.descricao, preco: centavosDoTexto(i.preco) })),
      });
      avisar(`${r.criados} produtos adicionados ao cardápio!`);
      navegar('../cardapio');
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setImportando(false);
    }
  };

  if (!sit && !erro) return <Carregando />;

  return (
    <>
      <Titulo titulo="Escanear cardápio" subtitulo="Tire uma foto do cardápio impresso: a inteligência artificial lê os itens e você revisa antes de adicionar." />

      {sit && !sit.disponivel ? (
        <Aviso tipo="alerta" titulo="Leitura por foto indisponível">
          Este recurso ainda não foi configurado no servidor. Fale com o suporte do Cardápio Online.
        </Aviso>
      ) : (
        <div className="cartao mb-5 flex flex-col items-center gap-4 border-2 border-dashed border-marca/30 bg-marca-clara/40 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marca text-white">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold">Uma foto por página, bem iluminada e reta</p>
            <p className="text-sm text-stone-600">
              Você ainda pode ler {sit?.restantesHoje ?? 0} de {sit?.limiteDia ?? 0} fotos hoje.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Botao icone={<Camera className="h-4 w-4" />} onClick={() => camera.current?.click()} disabled={!sit?.restantesHoje} carregando={lendo > 0}>
              {lendo > 0 ? 'Lendo a foto…' : 'Tirar foto'}
            </Botao>
            <Botao variante="secundario" icone={<ImagePlus className="h-4 w-4" />} onClick={() => arquivo.current?.click()} disabled={!sit?.restantesHoje || lendo > 0}>
              Escolher fotos
            </Botao>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (ler(e.target.files), (e.target.value = ''))} />
          <input ref={arquivo} type="file" accept="image/*" multiple className="hidden" onChange={(e) => (ler(e.target.files), (e.target.value = ''))} />
          {lendo > 0 && <p className="text-sm text-stone-600">Isso pode levar até um minuto…</p>}
        </div>
      )}

      {erro && (
        <Aviso tipo="erro" className="mb-4">
          {erro}
        </Aviso>
      )}
      {avisos.map((a, i) => (
        <Aviso key={i} tipo="alerta" className="mb-3">
          {a}
        </Aviso>
      ))}

      {itens.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">
              {itens.length} itens lidos · {marcados.length} selecionados
            </h2>
            <button type="button" className="text-sm font-semibold text-marca" onClick={() => setItens((l) => l.map((i) => ({ ...i, marcado: !marcados.length })))}>
              {marcados.length ? 'Desmarcar todos' : 'Marcar todos'}
            </button>
          </div>
          <div className="cartao divide-y divide-stone-100">
            {itens.map((i) => {
              const precoInvalido = i.marcado && centavosDoTexto(i.preco) == null;
              return (
                <div key={i.id} className={cx('grid gap-2 p-3 sm:grid-cols-[auto_1fr_1.4fr_2fr_120px_auto] sm:items-center', !i.marcado && 'opacity-50')}>
                  <button
                    type="button"
                    onClick={() => mudar(i.id, 'marcado', !i.marcado)}
                    className={cx('flex h-6 w-6 items-center justify-center rounded-md border-2', i.marcado ? 'border-marca bg-marca text-white' : 'border-stone-300')}
                    aria-label="Selecionar"
                  >
                    {i.marcado && <Check className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <Entrada value={i.categoria} onChange={(e) => mudar(i.id, 'categoria', e.target.value)} placeholder="Categoria" className="py-2" />
                  <Entrada value={i.nome} onChange={(e) => mudar(i.id, 'nome', e.target.value)} placeholder="Nome" className="py-2 font-semibold" />
                  <Entrada value={i.descricao} onChange={(e) => mudar(i.id, 'descricao', e.target.value)} placeholder="Descrição" className="py-2" />
                  <Entrada
                    value={i.preco}
                    onChange={(e) => mudar(i.id, 'preco', e.target.value)}
                    placeholder="Preço"
                    inputMode="decimal"
                    className={cx('py-2', precoInvalido && 'border-red-400 bg-red-50')}
                  />
                  <button type="button" className="justify-self-end rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => setItens((l) => l.filter((x) => x.id !== i.id))} aria-label="Remover">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="sticky bottom-20 z-10 mt-4 flex flex-col items-end gap-2 lg:bottom-4">
            {semPreco > 0 && <p className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-red-600 shadow">Preencha o preço de {semPreco} {semPreco === 1 ? 'item' : 'itens'}.</p>}
            <Botao tamanho="g" carregando={importando} disabled={!marcados.length || semPreco > 0} onClick={importar} className="shadow-flutuante">
              Adicionar {marcados.length} ao cardápio
            </Botao>
          </div>
        </>
      )}
    </>
  );
}
