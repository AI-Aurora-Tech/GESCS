// ============================================================================
// Página aberta DENTRO da Moderninha Smart 2, pelo app "Lojinha GESCS"
// (repo lojinha-pos). Fica esperando as cobranças que a vendedora confirma no
// GESCS e cobra o cliente na hora. Ninguém precisa mexer na maquininha: ela só
// pede o cartão (ou mostra o PIX) e devolve o resultado para o sistema.
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleX, LoaderCircle, TriangleAlert, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import {
  CobrancaMaquininha,
  ResultadoNativo,
  StatusCobranca,
  abortarNaMaquininha,
  acompanharCobranca,
  aoEventoMaquininha,
  cobrarNaMaquininha,
  descreverPagamento,
  maquininhaDisponivel,
  reais,
  referenciaCurta,
  statusDoResultado,
  ultimaTransacaoAprovada,
  verificarTerminal,
} from '../lib/maquininha';

type Caixa = 'lojinha' | 'cantina' | 'todos';
type Fase = 'aguardando' | 'cobrando' | 'resultado';

const CHAVE_CAIXA = 'maquininha_caixa';
const CHAVE_FILA = 'maquininha_resultados_pendentes';
const INTERVALO_FILA_MS = 4000;

const NOME_CAIXA: Record<Caixa, string> = { lojinha: 'Lojinha', cantina: 'Cantina', todos: 'Lojinha e Cantina' };

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Resultados que não conseguiram ser gravados (sem internet) ficam guardados
// --- no aparelho e são reenviados. Um pagamento aprovado nunca se perde.
type ResultadoPendente = { id: string; patch: Record<string, unknown> };

function lerFila(): ResultadoPendente[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FILA) || '[]');
  } catch {
    return [];
  }
}
function salvarFila(fila: ResultadoPendente[]) {
  try {
    localStorage.setItem(CHAVE_FILA, JSON.stringify(fila));
  } catch {
    /* sem armazenamento: segue sem a fila */
  }
}

async function gravar(id: string, patch: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from('cobrancas_maquininha').update(patch).eq('id', id);
  return !error;
}

async function gravarResultado(id: string, patch: Record<string, unknown>) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (await gravar(id, patch)) return;
    await esperar(1500 * (tentativa + 1));
  }
  salvarFila([...lerFila().filter((p) => p.id !== id), { id, patch }]);
}

async function reenviarResultados() {
  const fila = lerFila();
  if (!fila.length) return;
  const restantes: ResultadoPendente[] = [];
  for (const item of fila) {
    if (!(await gravar(item.id, item.patch))) restantes.push(item);
  }
  salvarFila(restantes);
}

const Maquininha: React.FC = () => {
  const { profile, logout } = useAuth();
  const nativa = maquininhaDisponivel();

  const [caixa, setCaixa] = useState<Caixa>(() => {
    const salvo = localStorage.getItem(CHAVE_CAIXA);
    return salvo === 'cantina' || salvo === 'todos' ? salvo : 'lojinha';
  });
  const [terminal, setTerminal] = useState<ResultadoNativo | null>(null);
  const [pronto, setPronto] = useState(false);
  const [online, setOnline] = useState(true);
  const [fase, setFase] = useState<Fase>('aguardando');
  const [atual, setAtual] = useState<CobrancaMaquininha | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [final, setFinal] = useState<{ status: StatusCobranca; texto: string } | null>(null);
  const [mostrarAjustes, setMostrarAjustes] = useState(false);

  const ocupado = useRef(false);
  const caixaRef = useRef(caixa);
  const serialRef = useRef('');
  caixaRef.current = caixa;

  // 1) Identifica a maquininha e confere cobranças que ficaram pela metade.
  useEffect(() => {
    if (!nativa) return;
    let cancelado = false;
    (async () => {
      let t: ResultadoNativo | null = null;
      try {
        t = await verificarTerminal();
      } catch (e: any) {
        t = { ok: false, dica: e?.message };
      }
      if (cancelado) return;
      setTerminal(t);
      serialRef.current = (t?.serial as string) || 'sem-serial';
      await conferirInterrompidas(serialRef.current);
      setPronto(true);
    })();
    return () => {
      cancelado = true;
    };
  }, [nativa]);

  /**
   * Se o app fechou no meio de uma cobrança, ela ficou "processando". Confere na
   * última transação aprovada da maquininha se o cliente chegou a pagar.
   */
  async function conferirInterrompidas(serial: string) {
    const { data } = await supabase
      .from('cobrancas_maquininha')
      .select('*')
      .eq('status', 'processando')
      .eq('terminal_serial', serial);
    if (!data?.length) return;
    let ultima: ResultadoNativo | null = null;
    try {
      ultima = await ultimaTransacaoAprovada();
    } catch {
      ultima = null;
    }
    for (const c of data as CobrancaMaquininha[]) {
      const pagou = !!ultima?.ok && ultima.referencia === referenciaCurta(c.referencia);
      await gravarResultado(
        c.id,
        pagou
          ? {
              status: 'aprovado',
              mensagem: 'Pagamento aprovado (recuperado após o app reiniciar).',
              resultado: ultima,
              codigo_transacao: ultima?.codigoTransacao || null,
              id_transacao: ultima?.idTransacao || null,
            }
          : {
              status: 'erro',
              mensagem: 'A cobrança foi interrompida. Confira na maquininha antes de cobrar de novo.',
            }
      );
    }
  }

  // 2) Cobra uma venda na maquininha e grava o resultado.
  const processar = useCallback(async (c: CobrancaMaquininha) => {
    setAtual(c);
    setFinal(null);
    setFase('cobrando');
    setMensagem('Preparando a cobrança...');

    let abortou = false;
    const pararCancelamento = acompanharCobranca(c.id, (linha) => {
      if (linha.cancelamento_solicitado && !abortou) {
        abortou = true;
        setMensagem('Cancelando a pedido da vendedora...');
        abortarNaMaquininha();
      }
    });

    // Repassa as mensagens da maquininha para a tela da vendedora (sem a senha).
    let ultimoEnvio = 0;
    const pararEventos = aoEventoMaquininha((m) => {
      if (!m) return;
      setMensagem(m);
      const agora = Date.now();
      if (!m.startsWith('SENHA') && agora - ultimoEnvio > 1500) {
        ultimoEnvio = agora;
        supabase
          .from('cobrancas_maquininha')
          .update({ mensagem: m })
          .eq('id', c.id)
          .eq('status', 'processando')
          .then(() => undefined);
      }
    });

    let r: ResultadoNativo;
    try {
      r = await cobrarNaMaquininha(c);
    } catch (e: any) {
      r = { ok: false, categoria: 'outro', dica: e?.message || 'Erro na maquininha.' };
    } finally {
      pararCancelamento();
      pararEventos();
    }

    const status = statusDoResultado(r);
    const texto = r.dica || r.mensagem || '';
    await gravarResultado(c.id, {
      status,
      mensagem: texto || null,
      resultado: r,
      codigo_transacao: r.codigoTransacao || null,
      id_transacao: r.idTransacao || null,
    });

    setFinal({ status, texto });
    setFase('resultado');
    await esperar(status === 'aprovado' ? 4000 : 6000);
    setFase('aguardando');
    setAtual(null);
  }, []);

  // 3) Procura a próxima cobrança do caixa (uma por vez).
  const verificarFila = useCallback(async () => {
    if (!nativa || ocupado.current || !serialRef.current) return;
    ocupado.current = true;
    try {
      await reenviarResultados();
      const { data, error } = await supabase.rpc('maquininha_pegar_cobranca', {
        p_caixa: caixaRef.current,
        p_serial: serialRef.current,
      });
      setOnline(!error);
      if (error) console.warn('maquininha_pegar_cobranca:', error.message);
      const proxima = (data as CobrancaMaquininha[] | null)?.[0];
      if (proxima) await processar(proxima);
    } finally {
      ocupado.current = false;
    }
  }, [nativa, processar]);

  // 4) Realtime avisa na hora; a conferência periódica cobre quedas do realtime.
  useEffect(() => {
    if (!nativa || !pronto) return;
    const canal = supabase
      .channel('maquininha-fila')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cobrancas_maquininha' }, () => {
        verificarFila();
      })
      .subscribe();
    const timer = window.setInterval(verificarFila, INTERVALO_FILA_MS);
    verificarFila();
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(canal);
    };
  }, [nativa, pronto, verificarFila]);

  const trocarCaixa = (c: Caixa) => {
    setCaixa(c);
    localStorage.setItem(CHAVE_CAIXA, c);
    setMostrarAjustes(false);
  };

  // ------------------------------------------------------------------ tela

  if (!nativa) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-2xl shadow p-6 text-center space-y-3">
          <TriangleAlert className="mx-auto text-amber-500" size={40} />
          <h1 className="text-xl font-bold">Esta tela é da maquininha</h1>
          <p className="text-sm text-gray-600">
            Abra o app <strong>Lojinha GESCS</strong> na Moderninha Smart 2. Ele abre esta página e passa a
            cobrar automaticamente as vendas confirmadas no sistema.
          </p>
          <p className="text-xs text-gray-400">
            Aberta num navegador comum, esta página não pega cobranças (não há maquininha para cobrar).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col select-none">
      {/* Topo: caixa atendido, conexão e terminal */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 text-sm">
        <button onClick={() => setMostrarAjustes((v) => !v)} className="font-bold text-left">
          Caixa: {NOME_CAIXA[caixa]} <span className="text-slate-400 font-normal">(trocar)</span>
        </button>
        <span className={cn('flex items-center gap-1', online ? 'text-emerald-400' : 'text-red-400')}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online ? 'Online' : 'Sem conexão'}
        </span>
      </header>

      {mostrarAjustes && (
        <div className="bg-slate-800 border-t border-slate-700 px-4 py-4 space-y-3">
          <p className="text-sm text-slate-300">Esta maquininha cobra as vendas de:</p>
          <div className="grid grid-cols-3 gap-2">
            {(['lojinha', 'cantina', 'todos'] as Caixa[]).map((c) => (
              <button
                key={c}
                disabled={fase !== 'aguardando'}
                onClick={() => trocarCaixa(c)}
                className={cn(
                  'py-3 rounded-xl font-bold text-sm',
                  caixa === c ? 'bg-blue-600' : 'bg-slate-700'
                )}
              >
                {NOME_CAIXA[c]}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>
              Terminal: {terminal?.modelo || '—'} • série {terminal?.serial || '—'} •{' '}
              {terminal?.autenticado ? 'ativado' : 'não ativado'}
            </p>
            <p>Usuário: {profile?.display_name || '—'}</p>
          </div>
          <button
            disabled={fase !== 'aguardando'}
            onClick={() => logout()}
            className="w-full py-2 rounded-lg bg-slate-700 text-sm"
          >
            Sair desta conta
          </button>
        </div>
      )}

      {terminal && !terminal.ok && (
        <div className="bg-amber-500 text-black text-sm px-4 py-2">
          {terminal.dica || 'Não foi possível falar com o serviço de pagamento da PagBank.'}
        </div>
      )}
      {terminal?.ok && terminal.autenticado === false && (
        <div className="bg-amber-500 text-black text-sm px-4 py-2">
          A maquininha não está ativada na PagBank. Ela abrirá a ativação na primeira cobrança.
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {fase === 'aguardando' && (
          <>
            <LoaderCircle className="animate-spin text-slate-500 mb-6" size={56} />
            <h1 className="text-3xl font-black">Aguardando venda</h1>
            <p className="text-slate-400 mt-3">
              Confirme a venda no GESCS ({NOME_CAIXA[caixa]}). A cobrança aparece aqui sozinha.
            </p>
          </>
        )}

        {fase !== 'aguardando' && atual && (
          <>
            <p className="text-slate-400 text-sm uppercase tracking-wide">{descreverPagamento(atual)}</p>
            <p className="text-5xl font-black my-3">{reais(atual.valor_centavos)}</p>
            {atual.descricao && <p className="text-slate-400 text-sm max-w-sm line-clamp-3">{atual.descricao}</p>}

            {fase === 'cobrando' && (
              <div className="mt-8 bg-slate-800 rounded-2xl px-6 py-5 w-full max-w-sm">
                <p className="text-2xl font-bold text-cyan-300 whitespace-pre-line">{mensagem}</p>
              </div>
            )}

            {fase === 'resultado' && final && (
              <div
                className={cn(
                  'mt-8 rounded-2xl px-6 py-5 w-full max-w-sm flex flex-col items-center gap-2',
                  final.status === 'aprovado' ? 'bg-emerald-600' : 'bg-red-600'
                )}
              >
                {final.status === 'aprovado' ? <CircleCheck size={48} /> : <CircleX size={48} />}
                <p className="text-2xl font-black">
                  {final.status === 'aprovado' ? 'APROVADO' : final.status === 'cancelado' ? 'CANCELADO' : 'NÃO APROVADO'}
                </p>
                {final.status !== 'aprovado' && final.texto && <p className="text-sm">{final.texto}</p>}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center text-[11px] text-slate-500 pb-3">GESCS • Moderninha Smart 2</footer>
    </div>
  );
};

export default Maquininha;
