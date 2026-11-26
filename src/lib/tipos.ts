// Formatos devolvidos pelo backend (valores monetários sempre em centavos).

export interface Marca {
  cor: string | null;
  logo: string | null;
  capa: string | null;
  frase: string | null;
}

export interface RestaurantePublico {
  id: number;
  nome: string;
  endereco: string;
  telefone: string;
  marca: Marca;
}

export type TipoAssinatura = 'teste' | 'ativa' | 'pendente' | 'cancelada' | 'expirada';

export interface Assinatura {
  tipo: TipoAssinatura;
  liberado: boolean;
  testeAte: string | null;
  diasRestantesTeste: number;
  statusStripe: string | null;
  assinaturaAte: string | null;
  cancelaNoFim: boolean;
  temCadastroStripe: boolean;
}

export interface Aceite {
  versao: string;
  aceitoEm: string;
  responsavelNome: string;
  responsavelDocumento: string;
  ip: string | null;
  hash: string;
}

export interface SituacaoContrato {
  versao: string;
  disponivel: boolean;
  aceito: boolean;
  pendente: boolean;
  aceite: Aceite | null;
}

export interface Restaurante {
  id: number;
  usuario: string;
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  assinatura: Assinatura;
  contrato: SituacaoContrato;
  marca: Marca;
}

export interface Produto {
  id: number;
  categoriaId: number;
  nome: string;
  descricao: string;
  preco: number | null;
  imagem: string;
  disponivel: boolean;
  ordem: number;
  controlaEstoque: boolean;
  estoque: number | null;
  estoqueMinimo: number;
  esgotado: boolean;
  estoqueBaixo: boolean;
  /** Adicionais que o cliente pode escolher (ex.: molho extra). preco 0 = grátis. */
  adicionais?: Adicional[];
}

/** Adicional = outro produto do cardápio (id é o id desse produto). Sem preço no produto = grátis. */
export interface Adicional {
  id: number;
  nome: string;
  preco: number;
  categoriaId?: number;
  /** Falso quando o produto do adicional está pausado ou esgotado (não aparece para pedir). */
  disponivel?: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  ordem: number;
  produtos: Produto[];
}

export type StatusPedido = 'recebido' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';

export interface ItemPedido {
  id: number;
  produtoId: number;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  observacao: string;
  /** Adicionais escolhidos (cópia do nome e preço da época do pedido). */
  adicionais?: { produtoId?: number; nome: string; preco: number }[];
  /** Soma dos adicionais por unidade (já incluída em total). */
  precoAdicionais?: number;
  total: number;
  /** Garçom marcou como entregue na mesa. */
  entregue?: boolean;
}

export interface Pedido {
  id: number;
  sessaoId: number;
  mesa: number;
  clienteNome: string;
  observacao: string;
  status: StatusPedido;
  criadoEm: string;
  atualizadoEm: string;
  itens: ItemPedido[];
  total: number;
}

export interface Sessao {
  id: number;
  mesa: number;
  status: 'aberta' | 'fechamento_solicitado' | 'fechada';
  abertaEm: string;
  fechamentoSolicitadoEm: string | null;
  fechadaEm: string | null;
  formaPagamento: string | null;
  /** Conta dividida entre as pessoas (vazio = paga de uma vez, em formaPagamento). */
  pagamentos?: { nome: string; formaPagamento: string; valor: number }[];
  garcomChamadoEm: string | null;
  pedidos: Pedido[];
  subtotal: number;
  taxaServico: number;
  taxaServicoPercentual: number;
  total: number;
  /** Só na resposta do fechamento: a NFC-e emitida junto (ou o motivo de não ter saído). */
  nota?: Nota;
  notaErro?: string;
}

export interface EstadoMesa {
  mesa: number;
  sessao: Sessao | null;
}

export interface MesaGestao {
  numero: number;
  sessao: Sessao | null;
}

export interface EstadoGestao {
  mesas: MesaGestao[];
  taxaServicoPercentual: number;
  /** Período de caixa: aberto (somando desde abertoEm) ou fechado (até alguém clicar em "Abrir caixa"). */
  resumoDoDia: {
    aberto: boolean;
    mesasFechadas: number;
    faturamentoSubtotal: number;
    abertoEm: string | null;
    ultimoFechamentoEm: string | null;
  };
  estoque: { controlados: number; esgotados: number; baixos: number };
  /** Pedidos de entrega ainda não iniciados (aviso no menu "Entregas"). */
  entregasNovas?: number;
}

export interface NotaResumo {
  id: number;
  numero: number;
  status: StatusNota;
  ambiente: number;
}

export type StatusNota =
  | 'enviando'
  | 'autorizada'
  | 'rejeitada'
  | 'contingencia'
  | 'incerta'
  | 'cancelada'
  | 'inutilizada'
  | 'substituida';

export interface Nota {
  id: number;
  sessaoId: number | null;
  numero: number;
  serie: number;
  chave: string | null;
  ambiente: number;
  tpEmis: number;
  status: StatusNota;
  cStat: string | null;
  motivo: string | null;
  protocolo: string | null;
  qrcode: string | null;
  valor: number;
  cpf: string | null;
  teste: boolean;
  tentativas: number;
  criadaEm: string;
  autorizadaEm: string | null;
  canceladaEm: string | null;
  cancelamentoMotivo: string | null;
  mesa: number | null;
}

export interface Cupom {
  chave: string;
  numero: number;
  serie: number;
  emissao: string;
  ambiente: number;
  tpEmis: number;
  emitente: { razaoSocial: string; nomeFantasia: string | null; cnpj: string; ie: string; endereco: string };
  itens: { codigo: string; nome: string; quantidade: number; unidade: string; valorUnitario: number; total: number }[];
  totais: { produtos: number; desconto: number; outros: number; total: number; tributos: number };
  pagamentos: { forma: string; valor: number }[];
  troco: number;
  cpf: string | null;
  qrcode: string | null;
  urlConsulta: string | null;
  protocolo: string | null;
  autorizadaEm: string | null;
  infCpl: string | null;
}

export interface SessaoHistorico extends Sessao {
  nfce: NotaResumo | null;
}

export interface Fechamento {
  id: number;
  abertoEm: string;
  fechadoEm: string | null;
  mesasFechadas: number;
  faturamentoSubtotal: number;
}

export interface ItemEstoque extends Produto {
  categoria: string;
  vendidosHoje: number;
}

export interface MovimentoEstoque {
  id: number;
  tipo: 'venda' | 'cancelamento' | 'entrada' | 'perda' | 'ajuste' | 'controle';
  quantidade: number;
  saldo: number;
  pedidoId: number | null;
  observacao: string;
  criadoEm: string;
}

export interface OpcoesCategorias {
  noCardapio: { id: number; nome: string; produtos: number; personalizada: boolean }[];
  padrao: string[];
  personalizadas: string[];
}

export interface CelularGarcom {
  id: number;
  nome: string;
  avisos: string[];
  navegador: string;
  criadoEm: string;
  ultimoEnvioEm: string | null;
}

export interface PrecoAssinatura {
  centavos: number;
  moeda: string;
  intervalo: string;
  intervaloQuantidade: number;
}

export interface ConfigFiscal {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  crt: number;
  regimes: { valor: number; nome: string }[];
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  codMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  serie: number;
  ambiente: number;
  proximoNumero: number;
  proximoNumeroHomologacao: number;
  servicoNaNota: boolean;
  cscId: string;
  cscConfigurado: boolean;
  certificado: { enviado: boolean; titular: string | null; cnpj: string | null; validade: string | null };
  pendencias: string[];
  /** Categorias de bebida ainda no perfil padrão (comida): aviso para conferir a tributação. */
  sugestoesTributacao?: string[];
  passos: {
    dados: boolean;
    conexao: string | null;
    notaTeste: string | null;
    cancelamentoTeste: string | null;
    conexaoProducao: string | null;
    podeIrParaProducao: boolean;
  };
}

export interface PerfilFiscal {
  id: number;
  nome: string;
  ncm: string;
  cest: string;
  cfop: string;
  csosn: string;
  origem: number;
  pisCst: string;
  cofinsCst: string;
  cargaAprox: number | null;
  padrao: boolean;
}

export interface Tributacao {
  perfis: PerfilFiscal[];
  /** sugestaoId: perfil sugerido pelo nome da categoria (bebidas), ainda não aplicado. */
  categorias: { id: number; nome: string; produtos: number; perfilId: number; sugestaoId?: number | null }[];
  produtos: { id: number; nome: string; categoria: string; ncm: string | null; cest: string | null }[];
  opcoes: { cfop: string[]; csosn: Record<string, string>; pisCofins: Record<string, string> };
}

export interface SecaoContrato {
  titulo: string;
  itens: string[];
}

export interface DocumentoContrato extends Omit<SituacaoContrato, 'versao'> {
  titulo: string;
  versao: string;
  secoes?: SecaoContrato[];
  hash?: string;
  textoAceito?: string;
}

export interface RestauranteAdmin extends Restaurante {
  criadoEm: string;
  stripeCustomerId: string | null;
  estatisticas: {
    pedidos: number;
    ultimoPedidoEm: string | null;
    produtos: number;
    mesas: number;
    sessoesAtivas: number;
    celularesGarcom: number;
    vendas30d: number;
  };
}

// ---------- Delivery ----------
export type StatusEntrega = 'recebido' | 'preparando' | 'saiu' | 'entregue' | 'cancelado';

export interface Entrega {
  id: number;
  codigo: string;
  clienteNome: string;
  telefone: string;
  endereco: string;
  complemento: string;
  bairro: string;
  referencia: string;
  formaPagamento: string;
  trocoPara: number | null;
  observacao: string;
  subtotal: number;
  taxaEntrega: number;
  total: number;
  status: StatusEntrega;
  criadoEm: string;
  atualizadoEm: string;
  itens: ItemPedido[];
}

export interface ConfigEntregas {
  ativas: boolean;
  taxaEntrega: number;
  formasPagamento: string[];
}
