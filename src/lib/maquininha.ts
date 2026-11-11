// ============================================================================
// Integração GESCS ↔ Moderninha Smart 2
//
// O GESCS roda no celular/PC da vendedora e a maquininha roda o app "Lojinha
// GESCS" (repo lojinha-pos), que abre a página /maquininha deste sistema.
// Os dois conversam pela tabela `cobrancas_maquininha` do Supabase
// (scripts/maquininha_cobrancas.sql):
//
//   vendedora (Lojinha/Cantina) ── insere 'pendente' ──▶ cobrancas_maquininha
//   maquininha (/maquininha)    ◀── pega e cobra ─────── (status 'processando')
//   maquininha                  ── grava resultado ──▶  'aprovado' / 'recusado' ...
//   vendedora                   ◀── vê o resultado e registra a venda
// ============================================================================
import { supabase } from '../supabase';

export type Modulo = 'lojinha' | 'cantina';
export type MetodoMaquininha = 'credito' | 'debito' | 'pix' | 'voucher';
export type StatusCobranca =
  | 'pendente'
  | 'processando'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'
  | 'erro'
  | 'expirado';

export interface CobrancaMaquininha {
  id: string;
  created_at: string;
  updated_at: string;
  modulo: Modulo;
  referencia: string;
  descricao: string | null;
  valor_centavos: number;
  metodo: MetodoMaquininha;
  parcelas: number;
  parcelamento: 'vendedor' | 'comprador';
  status: StatusCobranca;
  cancelamento_solicitado: boolean;
  mensagem: string | null;
  terminal_serial: string | null;
  codigo_transacao: string | null;
  id_transacao: string | null;
  resultado: ResultadoNativo | null;
  criado_por: string | null;
  criado_por_nome: string | null;
}

export const STATUS_FINAIS: StatusCobranca[] = ['aprovado', 'recusado', 'cancelado', 'erro', 'expirado'];

/** Valor mínimo aceito pela maquininha e mínimo para parcelar (centavos). */
export const VALOR_MINIMO_CENTAVOS = 1_00;
export const VALOR_MINIMO_PARCELADO_CENTAVOS = 10_00;
export const MAX_PARCELAS = 12;

/** Tempo que a vendedora espera a maquininha pegar a cobrança (o banco expira em 3 min). */
export const TEMPO_MAX_PENDENTE_MS = 2 * 60 * 1000;

export const NOME_METODO: Record<MetodoMaquininha, string> = {
  credito: 'Crédito',
  debito: 'Débito',
  pix: 'PIX',
  voucher: 'Voucher',
};

/** Converte o método da tela (credit_card...) para o da maquininha. */
export function metodoDaTela(m: string): MetodoMaquininha | null {
  if (m === 'credit_card') return 'credito';
  if (m === 'debit_card') return 'debito';
  if (m === 'pix') return 'pix';
  return null; // dinheiro não passa pela maquininha
}

export function descreverPagamento(c: Pick<CobrancaMaquininha, 'metodo' | 'parcelas'>): string {
  const nome = NOME_METODO[c.metodo] || c.metodo;
  return c.metodo === 'credito' && c.parcelas > 1 ? `${nome} ${c.parcelas}x` : nome;
}

export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Referência aceita pela maquininha: até 10 letras/números (usa o final, que é o trecho único). */
export function referenciaCurta(ref: string): string {
  return ref.replace(/[^A-Za-z0-9]/g, '').slice(-10);
}

// ---------------------------------------------------------------------------
// Lado da VENDEDORA (Lojinha / Cantina)
// ---------------------------------------------------------------------------

export interface NovaCobranca {
  modulo: Modulo;
  referencia: string;
  descricao: string;
  valorCentavos: number;
  metodo: MetodoMaquininha;
  parcelas?: number;
  parcelamento?: 'vendedor' | 'comprador';
  criadoPorNome?: string | null;
}

/** Valida as regras da maquininha. Retorna a mensagem de erro, ou null se estiver ok. */
export function validarCobranca(n: Pick<NovaCobranca, 'valorCentavos' | 'metodo' | 'parcelas'>): string | null {
  if (n.valorCentavos < VALOR_MINIMO_CENTAVOS) return 'O valor mínimo para cobrar na maquininha é R$ 1,00.';
  const parcelas = n.parcelas || 1;
  if (parcelas > 1 && n.metodo !== 'credito') return 'Parcelamento só existe no crédito.';
  if (parcelas > 1 && n.valorCentavos < VALOR_MINIMO_PARCELADO_CENTAVOS) return 'Parcelamento só a partir de R$ 10,00.';
  if (parcelas > MAX_PARCELAS) return `No máximo ${MAX_PARCELAS} parcelas.`;
  return null;
}

/** Envia a cobrança para a fila. A maquininha do caixa pega em poucos segundos. */
export async function enviarCobranca(n: NovaCobranca): Promise<CobrancaMaquininha> {
  const erro = validarCobranca(n);
  if (erro) throw new Error(erro);
  const parcelas = n.metodo === 'credito' ? n.parcelas || 1 : 1;
  const { data, error } = await supabase
    .from('cobrancas_maquininha')
    .insert([{
      modulo: n.modulo,
      referencia: n.referencia,
      descricao: n.descricao.slice(0, 500),
      valor_centavos: Math.round(n.valorCentavos),
      metodo: n.metodo,
      parcelas,
      parcelamento: parcelas > 1 ? n.parcelamento || 'vendedor' : 'vendedor',
      criado_por_nome: n.criadoPorNome || null,
    }])
    .select()
    .single();
  if (error) {
    if (/relation .*cobrancas_maquininha|does not exist|schema cache/i.test(error.message)) {
      throw new Error('Tabela da maquininha não encontrada. Rode o script scripts/maquininha_cobrancas.sql no Supabase.');
    }
    throw error;
  }
  return data as CobrancaMaquininha;
}

export async function buscarCobranca(id: string): Promise<CobrancaMaquininha | null> {
  const { data } = await supabase.from('cobrancas_maquininha').select('*').eq('id', id).maybeSingle();
  return (data as CobrancaMaquininha) || null;
}

/**
 * Acompanha uma cobrança: avisa a cada mudança (realtime + conferência a cada 3 s,
 * caso o realtime caia). Retorna a função para parar.
 */
export function acompanharCobranca(id: string, aoMudar: (c: CobrancaMaquininha) => void): () => void {
  let ativo = true;
  let ultima = '';
  const entregar = (c: CobrancaMaquininha | null) => {
    if (!ativo || !c) return;
    const chave = `${c.status}|${c.mensagem}|${c.cancelamento_solicitado}|${c.updated_at}`;
    if (chave === ultima) return;
    ultima = chave;
    aoMudar(c);
  };

  const canal = supabase
    .channel(`cobranca-${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cobrancas_maquininha', filter: `id=eq.${id}` },
      (payload) => entregar(payload.new as CobrancaMaquininha)
    )
    .subscribe();

  const timer = window.setInterval(async () => entregar(await buscarCobranca(id)), 3000);

  return () => {
    ativo = false;
    window.clearInterval(timer);
    supabase.removeChannel(canal);
  };
}

/**
 * Cancela pela tela da vendedora. Se a maquininha ainda não pegou, cancela na hora;
 * se já está cobrando, pede para a maquininha abortar (o resultado chega em seguida).
 */
export async function cancelarCobrancaRemota(c: CobrancaMaquininha): Promise<void> {
  const { data } = await supabase
    .from('cobrancas_maquininha')
    .update({ status: 'cancelado', mensagem: 'Cancelado pela vendedora antes de ir para a maquininha.' })
    .eq('id', c.id)
    .eq('status', 'pendente')
    .select('id');
  if (data && data.length > 0) return;
  await supabase
    .from('cobrancas_maquininha')
    .update({ cancelamento_solicitado: true })
    .eq('id', c.id)
    .eq('status', 'processando');
}

/** Marca como expirada se a maquininha não pegou a cobrança a tempo. */
export async function expirarCobranca(c: CobrancaMaquininha): Promise<void> {
  await supabase
    .from('cobrancas_maquininha')
    .update({ status: 'expirado', mensagem: 'A maquininha não respondeu a tempo.' })
    .eq('id', c.id)
    .eq('status', 'pendente');
}

// ---------------------------------------------------------------------------
// Lado da MAQUININHA: ponte com o SDK da PagBank (window.AndroidPagamento),
// exposta pelo app "Lojinha GESCS" (repo lojinha-pos, PagBankBridge.kt).
// ---------------------------------------------------------------------------

export interface ResultadoNativo {
  ok: boolean;
  aprovado?: boolean;
  categoria?: string;
  dica?: string;
  mensagem?: string;
  codigoErro?: string;
  metodo?: string;
  codigoTransacao?: string;
  idTransacao?: string;
  nsu?: string;
  autorizacao?: string;
  bandeira?: string;
  valor?: string;
  referencia?: string;
  serial?: string;
  modelo?: string;
  autenticado?: boolean;
  ocupado?: boolean;
  [k: string]: unknown;
}

interface PonteAndroid {
  pagar(json: string): void;
  cancelar(): void;
  ultimaTransacao(callbackId: string): void;
  verificarTerminal(callbackId: string): void;
}

declare global {
  interface Window {
    AndroidPagamento?: PonteAndroid;
    __resultadoPagamento?: (r: ResultadoNativo & { callbackId: string }) => void;
    __eventoPagamento?: (e: { codigo: number; mensagem: string }) => void;
  }
}

const pendentesNativos: Record<string, (r: ResultadoNativo) => void> = {};
const ouvintesEvento = new Set<(mensagem: string) => void>();

function instalarCallbacks() {
  window.__resultadoPagamento = (r) => {
    const resolver = pendentesNativos[r.callbackId];
    if (resolver) {
      delete pendentesNativos[r.callbackId];
      resolver(r);
    }
  };
  window.__eventoPagamento = (e) => ouvintesEvento.forEach((fn) => fn(e.mensagem));
}

/** true quando esta página está aberta dentro do app da maquininha. */
export function maquininhaDisponivel(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidPagamento !== 'undefined';
}

function chamarNativo(executar: (callbackId: string) => void): Promise<ResultadoNativo> {
  return new Promise((resolve, reject) => {
    if (!maquininhaDisponivel()) {
      reject(new Error('Esta página não está aberta no app da maquininha.'));
      return;
    }
    instalarCallbacks();
    const callbackId = 'pg_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    pendentesNativos[callbackId] = resolve;
    try {
      executar(callbackId);
    } catch (e) {
      delete pendentesNativos[callbackId];
      reject(e);
    }
  });
}

/** Mensagens da maquininha durante o pagamento ("APROXIME OU INSIRA O CARTÃO", "SENHA: ****"...). */
export function aoEventoMaquininha(fn: (mensagem: string) => void): () => void {
  instalarCallbacks();
  ouvintesEvento.add(fn);
  return () => {
    ouvintesEvento.delete(fn);
  };
}

export function cobrarNaMaquininha(c: CobrancaMaquininha): Promise<ResultadoNativo> {
  return chamarNativo((callbackId) =>
    window.AndroidPagamento!.pagar(
      JSON.stringify({
        callbackId,
        valorCentavos: c.valor_centavos,
        metodo: c.metodo,
        parcelas: c.parcelas,
        parcelamento: c.parcelamento,
        referencia: referenciaCurta(c.referencia),
        imprimirComprovante: true,
      })
    )
  );
}

export function abortarNaMaquininha(): void {
  if (maquininhaDisponivel()) window.AndroidPagamento!.cancelar();
}

export function verificarTerminal(): Promise<ResultadoNativo> {
  return chamarNativo((callbackId) => window.AndroidPagamento!.verificarTerminal(callbackId));
}

export function ultimaTransacaoAprovada(): Promise<ResultadoNativo> {
  return chamarNativo((callbackId) => window.AndroidPagamento!.ultimaTransacao(callbackId));
}

/** Converte a resposta da maquininha no status gravado na fila. */
export function statusDoResultado(r: ResultadoNativo): StatusCobranca {
  if (r.aprovado) return 'aprovado';
  if (r.categoria === 'cancelado' || r.categoria === 'tempo_esgotado') return 'cancelado';
  if (['erro_comunicacao', 'ocupado', 'nao_autenticado', 'servico_ausente', 'dados_invalidos', 'outro'].includes(r.categoria || 'outro')) {
    return 'erro';
  }
  return 'recusado';
}
