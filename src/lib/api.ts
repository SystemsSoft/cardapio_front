// Cliente HTTP do backend (FastAPI em /api). Erros chegam como {"erro": "mensagem"}.

export class ApiError extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function guardado(chave: string) {
  return {
    ler(): string | null {
      try {
        return localStorage.getItem(chave);
      } catch {
        return null;
      }
    },
    salvar(valor: string) {
      try {
        localStorage.setItem(chave, valor);
      } catch {
        /* navegador sem armazenamento: segue só nesta aba */
      }
    },
    limpar() {
      try {
        localStorage.removeItem(chave);
      } catch {
        /* idem */
      }
    },
  };
}

// Mesmas chaves do front anterior: quem já estava logado continua logado depois do deploy.
export const sessao = guardado('cardapio:token');
export const sessaoAdmin = guardado('cardapio:admin');
export const nomeSalvo = guardado('cardapio:nome');
export const urlBaseSalva = guardado('cardapio:urlBase');

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Opcoes {
  json?: unknown;
  bruto?: Blob;
  token?: string | null;
}

async function chamar<T>(metodo: Metodo, caminho: string, { json, bruto, token }: Opcoes = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (bruto) {
    body = bruto;
    headers['Content-Type'] = bruto.type || 'application/octet-stream';
  } else if (json !== undefined) {
    body = JSON.stringify(json);
    headers['Content-Type'] = 'application/json';
  }

  let resposta: Response;
  try {
    resposta = await fetch(`/api${caminho}`, { method: metodo, headers, body });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('json') ? await resposta.json().catch(() => null) : null;
  if (!resposta.ok) {
    const mensagem =
      (dados && typeof dados === 'object' && 'erro' in dados && String(dados.erro)) ||
      (resposta.status === 413 ? 'Arquivo grande demais.' : `Erro inesperado (${resposta.status}). Tente de novo.`);
    throw new ApiError(resposta.status, mensagem);
  }
  return dados as T;
}

function cliente(prefixo: string, token: () => string | null, aoErro?: (e: ApiError) => void) {
  const fazer = async <T>(metodo: Metodo, caminho: string, opcoes: Omit<Opcoes, 'token'> = {}) => {
    try {
      return await chamar<T>(metodo, prefixo + caminho, { ...opcoes, token: token() });
    } catch (e) {
      if (e instanceof ApiError) aoErro?.(e);
      throw e;
    }
  };
  return {
    get: <T>(c: string) => fazer<T>('GET', c),
    post: <T>(c: string, json?: unknown) => fazer<T>('POST', c, { json }),
    put: <T>(c: string, json?: unknown) => fazer<T>('PUT', c, { json }),
    patch: <T>(c: string, json?: unknown) => fazer<T>('PATCH', c, { json }),
    del: <T>(c: string, json?: unknown) => fazer<T>('DELETE', c, { json }),
    enviar: <T>(c: string, arquivo: Blob) => fazer<T>('POST', c, { bruto: arquivo }),
    /** Download autenticado (ex.: XML da nota). */
    async baixar(c: string, nomeArquivo: string) {
      const r = await fetch(`/api${prefixo}${c}`, { headers: { Authorization: `Bearer ${token() ?? ''}` } });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new ApiError(r.status, d?.erro || 'Não foi possível baixar o arquivo.');
      }
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: nomeArquivo });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  };
}

/** Rotas públicas (cadastro, login, cliente na mesa, garçom). */
export const api = cliente('', () => null);

/** Área do restaurante: avisa o layout quando a sessão expira (401) ou a assinatura bloqueia (402). */
export const gestao = cliente(
  '/gestao',
  () => sessao.ler(),
  (e) => {
    if (e.status === 401) window.dispatchEvent(new Event('cardapio:sessao-expirada'));
    if (e.status === 402) window.dispatchEvent(new Event('cardapio:bloqueado'));
  },
);

export const admin = cliente(
  '/admin',
  () => sessaoAdmin.ler(),
  (e) => {
    if (e.status === 401) window.dispatchEvent(new Event('cardapio:admin-expirado'));
  },
);

export function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : 'Algo deu errado. Tente de novo.';
}

/** Lê um arquivo como base64 puro (sem o prefixo data:). */
export function base64DoArquivo(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(',')[1] ?? '');
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.readAsDataURL(arquivo);
  });
}
