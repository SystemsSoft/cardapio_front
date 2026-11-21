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
  total: number;
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
  garcomChamadoEm: string | null;
  pedidos: Pedido[];
  subtotal: number;
  taxaServico: number;
  taxaServicoPercentual: number;
  total: number;
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
  resumoDoDia: { mesasFechadas: number; faturamentoSubtotal: number; abertoEm: string | null };
  estoque: { controlados: number; esgotados: number; baixos: number };
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
  categorias: { id: number; nome: string; produtos: number; perfilId: number }[];
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
