import { Camera, ImagePlus, MoreVertical, Pencil, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagemProduto, ehImagem } from '../../components/comuns';
import { AreaTexto, Aviso, Botao, BotaoIcone, Campo, Carregando, Entrada, Interruptor, Janela, Selecao, Selo, Titulo, Vazio, cx, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { centavosDoTexto, reais, textoDosCentavos } from '../../lib/formato';
import type { Categoria, OpcoesCategorias, Produto } from '../../lib/tipos';
import { useGestao } from './contexto';

// Mesma lista de CATEGORIAS_PADRAO do backend (servicos.py).
const PADRAO = new Set(
  ['Entradas', 'Porções', 'Lanches', 'Pratos principais', 'Massas', 'Pizzas', 'Saladas', 'Sobremesas', 'Bebidas', 'Bebidas alcoólicas', 'Drinks', 'Cafés'].map((c) =>
    c.toLowerCase(),
  ),
);

const EMOJIS = ['🍽️', '🍔', '🍕', '🍟', '🌭', '🥪', '🌮', '🥗', '🍝', '🍜', '🍣', '🍤', '🥩', '🍗', '🐟', '🧀', '🥟', '🍰', '🍨', '🍫', '🍮', '🥤', '🧃', '☕', '🍺', '🍷', '🍹', '🥃', '💧', '🧊'];

export default function Cardapio() {
  const { versaoCardapio } = useGestao();
  const { avisar, confirmar } = useAvisos();
  const [cardapio, setCardapio] = useState<Categoria[] | null>(null);
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null);
  const [categoriaNova, setCategoriaNova] = useState<number | undefined>();
  const [termo, setTermo] = useState('');
  const [catEditando, setCatEditando] = useState<Categoria | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCardapio(await gestao.get<Categoria[]>('/cardapio'));
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    }
  }, [avisar]);

  useEffect(() => {
    carregar();
  }, [carregar, versaoCardapio]);

  const visiveis = useMemo(() => {
    const t = termo.trim().toLowerCase();
    if (!cardapio) return [];
    return cardapio.map((c) => ({ ...c, produtos: c.produtos.filter((p) => !t || p.nome.toLowerCase().includes(t)) })).filter((c) => !t || c.produtos.length);
  }, [cardapio, termo]);

  if (!cardapio) return <Carregando />;
  const total = cardapio.reduce((n, c) => n + c.produtos.length, 0);

  const alternar = async (p: Produto) => {
    setCardapio((c) => c!.map((cat) => ({ ...cat, produtos: cat.produtos.map((x) => (x.id === p.id ? { ...x, disponivel: !p.disponivel } : x)) })));
    try {
      await gestao.patch(`/produtos/${p.id}/disponibilidade`, { disponivel: !p.disponivel });
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
      carregar();
    }
  };

  return (
    <>
      <Titulo
        titulo="Cardápio"
        subtitulo={`${total} ${total === 1 ? 'produto' : 'produtos'} em ${cardapio.length} ${cardapio.length === 1 ? 'categoria' : 'categorias'}`}
        acoes={
          <>
            <Link to="../escanear">
              <Botao variante="secundario" icone={<Camera className="h-4 w-4" />}>
                Escanear cardápio
              </Botao>
            </Link>
            <Botao
              icone={<Plus className="h-4 w-4" />}
              onClick={() => {
                setCategoriaNova(undefined);
                setEditando('novo');
              }}
            >
              Novo produto
            </Botao>
          </>
        }
      />

      {!total ? (
        <div className="cartao">
          <Vazio icone={<UtensilsCrossed />} titulo="Seu cardápio está vazio">
            Adicione os produtos um a um ou tire uma foto do cardápio impresso e deixe a inteligência artificial montar para você.
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="../escanear">
                <Botao variante="secundario" icone={<Camera className="h-4 w-4" />}>
                  Escanear cardápio
                </Botao>
              </Link>
              <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>
                Adicionar produto
              </Botao>
            </div>
          </Vazio>
        </div>
      ) : (
        <>
          <div className="relative mb-5 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Entrada value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar produto" className="pl-10" type="search" />
          </div>
          <div className="space-y-6">
            {visiveis.map((c) => (
              <section key={c.id}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-lg font-bold">{c.nome}</h2>
                  <span className="text-sm text-stone-500">{c.produtos.length}</span>
                  <BotaoIcone rotulo="Editar categoria" className="h-8 w-8" onClick={() => setCatEditando(c)}>
                    <MoreVertical className="h-4 w-4" />
                  </BotaoIcone>
                  <div className="flex-1" />
                  <Botao
                    tamanho="p"
                    variante="fantasma"
                    icone={<Plus className="h-4 w-4" />}
                    onClick={() => {
                      setCategoriaNova(c.id);
                      setEditando('novo');
                    }}
                  >
                    Adicionar
                  </Botao>
                </div>
                {!c.produtos.length ? (
                  <p className="rounded-xl border border-dashed border-stone-300 py-6 text-center text-sm text-stone-500">Categoria vazia</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {c.produtos.map((p) => (
                      <div key={p.id} className={cx('cartao flex items-center gap-3 p-3', !p.disponivel && 'opacity-60')}>
                        <button type="button" onClick={() => setEditando(p)} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <ImagemProduto imagem={p.imagem} nome={p.nome} className="h-full w-full text-[0.9rem]" />
                        </button>
                        <button type="button" onClick={() => setEditando(p)} className="min-w-0 flex-1 text-left">
                          <p className="truncate font-semibold">{p.nome}</p>
                          <p className="text-sm font-semibold text-stone-700">{p.preco == null ? <span className="text-amber-700">Sem preço</span> : reais(p.preco)}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.esgotado && <Selo cor="vermelho">Esgotado</Selo>}
                            {p.estoqueBaixo && <Selo cor="amarelo">Estoque baixo: {p.estoque}</Selo>}
                            {p.controlaEstoque && !p.esgotado && !p.estoqueBaixo && <Selo>Estoque: {p.estoque}</Selo>}
                          </div>
                        </button>
                        <div className="flex flex-col items-center gap-1">
                          <Interruptor ligado={p.disponivel} aoMudar={() => alternar(p)} rotulo="Disponível" />
                          <span className="text-[10px] font-medium text-stone-500">{p.disponivel ? 'À venda' : 'Pausado'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {editando && (
        <EditorProduto
          produto={editando === 'novo' ? null : editando}
          categoriaInicial={categoriaNova}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            carregar();
          }}
          aoExcluir={async (p) => {
            if (!(await confirmar({ titulo: `Excluir “${p.nome}”?`, texto: 'O produto sai do cardápio. Pedidos antigos continuam no histórico.', confirmar: 'Excluir', perigo: true }))) return;
            try {
              await gestao.del(`/produtos/${p.id}`);
              avisar('Produto excluído.');
              setEditando(null);
              carregar();
            } catch (e) {
              avisar(mensagemDe(e), 'erro');
            }
          }}
        />
      )}
      {catEditando && <EditorCategoria categoria={catEditando} categorias={cardapio} aoFechar={() => setCatEditando(null)} aoSalvar={carregar} />}
    </>
  );
}

function EditorProduto({
  produto,
  categoriaInicial,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  produto: Produto | null;
  categoriaInicial?: number;
  aoFechar: () => void;
  aoSalvar: () => void;
  aoExcluir: (p: Produto) => void;
}) {
  const { avisar } = useAvisos();
  const [opcoes, setOpcoes] = useState<OpcoesCategorias | null>(null);
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [preco, setPreco] = useState(textoDosCentavos(produto?.preco));
  const [categoria, setCategoria] = useState<string>(produto ? `id:${produto.categoriaId}` : categoriaInicial ? `id:${categoriaInicial}` : '');
  const [categoriaTexto, setCategoriaTexto] = useState('');
  const [imagem, setImagem] = useState(produto?.imagem ?? '🍽️');
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [disponivel, setDisponivel] = useState(produto?.disponivel ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gestao
      .get<OpcoesCategorias>('/categorias/opcoes')
      .then((o) => {
        setOpcoes(o);
        if (!categoria && o.noCardapio[0]) setCategoria(`id:${o.noCardapio[0].id}`);
        else if (!categoria) setCategoria('nova');
      })
      .catch((e) => setErro(mensagemDe(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!foto) return setPrevia(null);
    const u = URL.createObjectURL(foto);
    setPrevia(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);

  const salvar = async () => {
    setErro('');
    const centavos = centavosDoTexto(preco);
    if (preco.trim() && centavos == null) return setErro('Preço inválido.');
    const corpo: Record<string, unknown> = { nome, descricao, preco: centavos, disponivel, imagem: foto ? produto?.imagem || '🍽️' : imagem };
    if (categoria.startsWith('id:')) corpo.categoriaId = Number(categoria.slice(3));
    else if (categoria.startsWith('nome:')) corpo.categoriaNome = categoria.slice(5);
    else if (categoriaTexto.trim()) corpo.categoriaNome = categoriaTexto.trim();
    else return setErro('Escolha ou digite a categoria.');

    setSalvando(true);
    try {
      let id = produto?.id;
      if (id) await gestao.put(`/produtos/${id}`, corpo);
      else id = (await gestao.post<{ id: number }>('/produtos', corpo)).id;
      if (foto) await gestao.enviar(`/produtos/${id}/imagem`, foto);
      avisar(produto ? 'Produto atualizado.' : 'Produto adicionado ao cardápio.');
      aoSalvar();
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setSalvando(false);
    }
  };

  const imagemAtual = previa ?? imagem;

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={produto ? 'Editar produto' : 'Novo produto'}
      largura="max-w-xl"
      rodape={
        <div className="flex gap-2">
          {produto && (
            <Botao variante="fantasma" className="text-red-600" icone={<Trash2 className="h-4 w-4" />} onClick={() => aoExcluir(produto)}>
              Excluir
            </Botao>
          )}
          <div className="flex-1" />
          <Botao variante="secundario" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao carregando={salvando} onClick={salvar}>
            Salvar
          </Botao>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl ring-1 ring-stone-200">
            <ImagemProduto imagem={imagemAtual} nome={nome} className="h-full w-full text-[1.4rem]" />
            <button type="button" onClick={() => arquivo.current?.click()} className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-xs font-semibold text-white">
              <ImagePlus className="h-3.5 w-3.5" /> Foto
            </button>
            <input
              ref={arquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > 8 * 1024 * 1024) return setErro('Foto grande demais (máximo 8 MB).');
                setFoto(f ?? null);
              }}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Campo rotulo="Nome">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus={!produto} placeholder="Ex.: Hambúrguer artesanal" />
            </Campo>
            <Campo rotulo="Preço" dica="Sem preço, o produto aparece como “Em breve”.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500">R$</span>
                <Entrada value={preco} onChange={(e) => setPreco(e.target.value)} inputMode="decimal" placeholder="0,00" className="pl-10" />
              </div>
            </Campo>
          </div>
        </div>

        <div>
          <p className="rotulo">Ou escolha um ícone</p>
          <div className="sem-rolagem flex gap-1 overflow-x-auto pb-1">
            {(ehImagem(produto?.imagem) && !foto ? [produto!.imagem, ...EMOJIS] : EMOJIS).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setFoto(null);
                  setImagem(e);
                }}
                className={cx('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl transition', imagem === e && !foto ? 'bg-marca-clara ring-2 ring-marca' : 'bg-stone-100 hover:bg-stone-200')}
              >
                {ehImagem(e) ? <img src={e} alt="Foto atual" className="h-full w-full object-cover" /> : e}
              </button>
            ))}
          </div>
        </div>

        <Campo rotulo="Descrição">
          <AreaTexto value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} rows={2} placeholder="Ingredientes, tamanho, acompanhamentos…" />
        </Campo>

        <Campo rotulo="Categoria">
          <Selecao value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!opcoes}>
            {opcoes?.noCardapio.length ? (
              <optgroup label="No seu cardápio">
                {opcoes.noCardapio.map((c) => (
                  <option key={c.id} value={`id:${c.id}`}>
                    {c.nome}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {opcoes?.personalizadas.length ? (
              <optgroup label="Suas categorias">
                {opcoes.personalizadas.map((n) => (
                  <option key={n} value={`nome:${n}`}>
                    {n}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {opcoes?.padrao.length ? (
              <optgroup label="Sugestões">
                {opcoes.padrao.map((n) => (
                  <option key={n} value={`nome:${n}`}>
                    {n}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <option value="nova">➕ Nova categoria…</option>
          </Selecao>
        </Campo>
        {categoria === 'nova' && (
          <Campo rotulo="Nome da nova categoria">
            <Entrada value={categoriaTexto} onChange={(e) => setCategoriaTexto(e.target.value)} maxLength={60} placeholder="Ex.: Grelhados" />
          </Campo>
        )}

        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
          <div>
            <p className="font-semibold">Disponível para venda</p>
            <p className="text-xs text-stone-500">Desligue para pausar o item sem apagar.</p>
          </div>
          <Interruptor ligado={disponivel} aoMudar={setDisponivel} />
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Janela>
  );
}

function EditorCategoria({ categoria, categorias, aoFechar, aoSalvar }: { categoria: Categoria; categorias: Categoria[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { avisar, confirmar } = useAvisos();
  const [nome, setNome] = useState(categoria.nome);
  const [destino, setDestino] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const outras = categorias.filter((c) => c.id !== categoria.id);
  const temProdutos = categoria.produtos.length > 0;

  const renomear = async () => {
    setOcupado(true);
    try {
      await gestao.put(`/categorias/${categoria.id}`, { nome });
      avisar('Categoria renomeada.');
      aoSalvar();
      aoFechar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado(false);
    }
  };

  const excluir = async () => {
    if (!(await confirmar({ titulo: `Excluir a categoria “${categoria.nome}”?`, texto: temProdutos ? 'Os produtos serão movidos para a categoria escolhida.' : undefined, confirmar: 'Excluir', perigo: true }))) return;
    setOcupado(true);
    try {
      if (temProdutos && !PADRAO.has(categoria.nome.toLowerCase())) {
        // Categoria criada pelo restaurante: move os produtos e some também da lista de opções.
        await gestao.post('/categorias/personalizadas/excluir', { nome: categoria.nome, moverPara: { categoriaId: Number(destino) } });
      } else {
        // Categoria padrão: move produto a produto e depois apaga a categoria vazia.
        for (const p of categoria.produtos) {
          await gestao.put(`/produtos/${p.id}`, {
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            imagem: p.imagem,
            disponivel: p.disponivel,
            categoriaId: Number(destino),
          });
        }
        await gestao.del(`/categorias/${categoria.id}`);
      }
      avisar('Categoria excluída.');
      aoSalvar();
      aoFechar();
    } catch (e) {
      avisar(mensagemDe(e), 'erro');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Categoria" largura="max-w-md">
      <div className="space-y-5">
        <div className="space-y-2">
          <Campo rotulo="Nome">
            <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
          </Campo>
          <Botao icone={<Pencil className="h-4 w-4" />} disabled={!nome.trim() || nome === categoria.nome} carregando={ocupado} onClick={renomear}>
            Renomear
          </Botao>
        </div>
        <div className="space-y-2 border-t border-stone-100 pt-4">
          <p className="font-semibold text-red-700">Excluir categoria</p>
          {temProdutos && (
            <Campo rotulo={`Mover os ${categoria.produtos.length} produtos para`}>
              <Selecao value={destino} onChange={(e) => setDestino(e.target.value)}>
                <option value="">Escolha…</option>
                {outras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Selecao>
            </Campo>
          )}
          <Botao variante="perigo" icone={<Trash2 className="h-4 w-4" />} disabled={temProdutos && !destino} carregando={ocupado} onClick={excluir}>
            Excluir
          </Botao>
          {temProdutos && !outras.length && <p className="text-xs text-stone-500">Crie outra categoria antes para receber os produtos.</p>}
        </div>
      </div>
    </Janela>
  );
}
