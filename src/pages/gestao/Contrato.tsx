import { CheckCircle2, Printer } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Aviso, Botao, Campo, Carregando, Entrada, Titulo, useAvisos } from '../../components/ui';
import { gestao, mensagemDe } from '../../lib/api';
import { cpfOuCnpj, dataHora } from '../../lib/formato';
import type { DocumentoContrato } from '../../lib/tipos';
import { useGestao } from './contexto';

export default function Contrato() {
  const { recarregarRestaurante } = useGestao();
  const { avisar } = useAvisos();
  const [doc, setDoc] = useState<DocumentoContrato | null>(null);
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    gestao
      .get<DocumentoContrato>('/contrato')
      .then(setDoc)
      .catch((e) => setErro(mensagemDe(e)));
  }, []);
  useEffect(carregar, [carregar]);

  if (!doc) return erro ? <Aviso tipo="erro">{erro}</Aviso> : <Carregando />;

  return (
    <>
      <Titulo
        titulo="Contrato de uso"
        subtitulo={`${doc.titulo} · versão ${doc.versao}`}
        acoes={
          <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
            Imprimir
          </Botao>
        }
      />
      {doc.aceito && doc.aceite && (
        <Aviso tipo="sucesso" className="nao-imprimir mb-5" titulo="Contrato aceito">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Por {doc.aceite.responsavelNome} ({doc.aceite.responsavelDocumento}) em {dataHora(doc.aceite.aceitoEm)}.
          </span>
        </Aviso>
      )}
      {!doc.disponivel && !doc.aceito ? (
        <Aviso tipo="info">O contrato ainda não está disponível. Assim que for publicado, ele aparece aqui para leitura e aceite.</Aviso>
      ) : (
        <article className="cartao p-5 sm:p-8">
          {doc.textoAceito ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-700">{doc.textoAceito}</pre>
          ) : (
            <div className="space-y-6 text-sm leading-relaxed text-stone-700">
              <h2 className="text-center text-lg font-bold text-stone-900">{doc.titulo}</h2>
              {doc.secoes?.map((s, i) => (
                <section key={i}>
                  {/* Títulos e cláusulas já vêm numerados do backend (contrato.py). */}
                  <h3 className="mb-2 font-bold text-stone-900">{s.titulo}</h3>
                  <div className="space-y-2">
                    {s.itens.map((t, k) => (
                      <p key={k}>{t}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </article>
      )}

      {doc.pendente && !doc.aceito && doc.hash && (
        <section className="cartao nao-imprimir mt-5 space-y-4 p-5">
          <h2 className="font-bold">Aceite eletrônico</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo do responsável">
              <Entrada value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </Campo>
            <Campo rotulo="CPF ou CNPJ">
              <Entrada value={documento} onChange={(e) => setDocumento(cpfOuCnpj(e.target.value))} inputMode="numeric" />
            </Campo>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[rgb(var(--marca))]" />
            Li e concordo com todas as cláusulas deste contrato, em nome do restaurante.
          </label>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao
            carregando={enviando}
            disabled={!concordo || nome.trim().split(/\s+/).length < 2 || !documento}
            onClick={async () => {
              setEnviando(true);
              setErro('');
              try {
                setDoc(
                  await gestao.post<DocumentoContrato>('/contrato/aceitar', {
                    concordo,
                    responsavelNome: nome,
                    responsavelDocumento: documento,
                    hash: doc.hash,
                  }),
                );
                avisar('Contrato aceito. Obrigado!');
                recarregarRestaurante();
              } catch (e) {
                setErro(mensagemDe(e));
                if ((e as { status?: number }).status === 409) carregar();
              } finally {
                setEnviando(false);
              }
            }}
          >
            Aceitar contrato
          </Botao>
        </section>
      )}
    </>
  );
}
