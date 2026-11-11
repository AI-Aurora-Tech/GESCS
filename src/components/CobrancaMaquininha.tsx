// ============================================================================
// Peças da tela da VENDEDORA para cobrar na maquininha (Lojinha e Cantina):
//   - useCobrancaMaquininha: envia a cobrança e acompanha até o resultado
//   - CobrancaMaquininhaModal: tela de espera / resultado
//   - SeletorParcelas: parcelas e quem paga os juros (só crédito)
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, CircleX, CreditCard, LoaderCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  CobrancaMaquininha,
  MAX_PARCELAS,
  NovaCobranca,
  STATUS_FINAIS,
  TEMPO_MAX_PENDENTE_MS,
  VALOR_MINIMO_PARCELADO_CENTAVOS,
  acompanharCobranca,
  cancelarCobrancaRemota,
  descreverPagamento,
  enviarCobranca,
  expirarCobranca,
  reais,
} from '../lib/maquininha';

/** aoAprovar deve registrar a venda e devolver true se deu certo. */
export function useCobrancaMaquininha(aoAprovar: (c: CobrancaMaquininha) => Promise<boolean>) {
  const [cobranca, setCobranca] = useState<CobrancaMaquininha | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [registrando, setRegistrando] = useState(false);
  const [falhaRegistro, setFalhaRegistro] = useState(false);
  const ultimoPedido = useRef<NovaCobranca | null>(null);
  const registradas = useRef(new Set<string>());
  const aoAprovarRef = useRef(aoAprovar);
  aoAprovarRef.current = aoAprovar;

  const ativo = !!cobranca || enviando || !!erro;

  const registrar = useCallback(async (c: CobrancaMaquininha) => {
    setRegistrando(true);
    setFalhaRegistro(false);
    const ok = await aoAprovarRef.current(c);
    setRegistrando(false);
    if (ok) {
      setCobranca(null);
    } else {
      setFalhaRegistro(true);
    }
  }, []);

  // Acompanha a cobrança aberta até um status final.
  useEffect(() => {
    if (!cobranca || STATUS_FINAIS.includes(cobranca.status)) return;
    const parar = acompanharCobranca(cobranca.id, setCobranca);
    return parar;
  }, [cobranca?.id, cobranca && STATUS_FINAIS.includes(cobranca.status)]);

  // Aprovado → registra a venda uma única vez.
  useEffect(() => {
    if (cobranca?.status === 'aprovado' && !registradas.current.has(cobranca.id)) {
      registradas.current.add(cobranca.id);
      registrar(cobranca);
    }
  }, [cobranca, registrar]);

  // Se a maquininha não pegar a cobrança a tempo, expira (ela nunca será cobrada).
  useEffect(() => {
    if (cobranca?.status !== 'pendente') return;
    const restante = new Date(cobranca.created_at).getTime() + TEMPO_MAX_PENDENTE_MS - Date.now();
    const timer = window.setTimeout(() => expirarCobranca(cobranca), Math.max(restante, 1000));
    return () => window.clearTimeout(timer);
  }, [cobranca?.id, cobranca?.status]);

  const iniciar = useCallback(async (pedido: NovaCobranca) => {
    ultimoPedido.current = pedido;
    setErro('');
    setFalhaRegistro(false);
    setCobranca(null);
    setEnviando(true);
    try {
      setCobranca(await enviarCobranca(pedido));
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível enviar a cobrança.');
    } finally {
      setEnviando(false);
    }
  }, []);

  const tentarDeNovo = useCallback(() => {
    if (ultimoPedido.current) iniciar(ultimoPedido.current);
  }, [iniciar]);

  const cancelar = useCallback(async () => {
    if (!cobranca) return;
    await cancelarCobrancaRemota(cobranca);
    setCobranca({ ...cobranca, cancelamento_solicitado: true });
  }, [cobranca]);

  const fechar = useCallback(() => {
    setCobranca(null);
    setErro('');
    setFalhaRegistro(false);
  }, []);

  return {
    cobranca,
    enviando,
    erro,
    registrando,
    falhaRegistro,
    ativo,
    iniciar,
    tentarDeNovo,
    cancelar,
    fechar,
    registrarDeNovo: () => cobranca && registrar(cobranca),
  };
}

export type ControleCobranca = ReturnType<typeof useCobrancaMaquininha>;

export const CobrancaMaquininhaModal: React.FC<{
  maq: ControleCobranca;
  valorCentavos: number;
  /** Registro manual (cobrou fora do sistema). Só aparece quando a cobrança falhou. */
  aoRegistrarManual?: () => void;
}> = ({ maq, valorCentavos, aoRegistrarManual }) => {
  if (!maq.ativo) return null;
  const c = maq.cobranca;
  const status = c?.status;
  const falhou = !!maq.erro || (!!status && status !== 'aprovado' && STATUS_FINAIS.includes(status));

  let titulo = 'Enviando para a maquininha...';
  let texto = '';
  if (maq.erro) {
    titulo = 'Não foi possível enviar';
    texto = maq.erro;
  } else if (status === 'pendente') {
    titulo = 'Aguardando a maquininha';
    texto = 'A cobrança foi enviada. A maquininha do caixa vai pedir o cartão em instantes.';
  } else if (status === 'processando') {
    titulo = c?.cancelamento_solicitado ? 'Cancelando...' : 'Cliente pagando na maquininha';
    texto = c?.mensagem || '';
  } else if (status === 'aprovado') {
    titulo = maq.falhaRegistro ? 'Pagamento APROVADO' : 'Pagamento aprovado!';
    texto = maq.falhaRegistro
      ? 'O cliente já pagou, mas a venda não foi registrada. NÃO cobre de novo: toque em "Registrar a venda".'
      : 'Registrando a venda...';
  } else if (status === 'cancelado') {
    titulo = 'Cobrança cancelada';
    texto = c?.mensagem || '';
  } else if (status === 'expirado') {
    titulo = 'A maquininha não respondeu';
    texto = 'Confira se ela está ligada, com internet e com o app Lojinha GESCS aberto. Nada foi cobrado.';
  } else if (status === 'recusado' || status === 'erro') {
    titulo = 'Pagamento não aprovado';
    texto = c?.mensagem || '';
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="flex justify-center">
          {status === 'aprovado' ? (
            <CircleCheck size={56} className="text-emerald-500" />
          ) : falhou ? (
            <CircleX size={56} className="text-red-500" />
          ) : (
            <LoaderCircle size={56} className="text-blue-500 animate-spin" />
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase text-gray-400 flex items-center justify-center gap-1">
            <CreditCard size={12} /> Moderninha Smart 2
            {c ? ` • ${descreverPagamento(c)}` : ''}
          </p>
          <p className="text-3xl font-black text-gray-900 mt-1">{reais(c?.valor_centavos ?? valorCentavos)}</p>
        </div>

        <div>
          <h4 className="font-bold text-gray-900">{titulo}</h4>
          {texto && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{texto}</p>}
          {c && <p className="text-[10px] text-gray-400 mt-2">Ref: {c.referencia}</p>}
        </div>

        <div className="space-y-2">
          {(status === 'pendente' || status === 'processando') && (
            <button
              onClick={maq.cancelar}
              disabled={!!c?.cancelamento_solicitado}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-gray-700 disabled:opacity-60"
            >
              Cancelar cobrança
            </button>
          )}

          {status === 'aprovado' && maq.falhaRegistro && (
            <button
              onClick={maq.registrarDeNovo}
              disabled={maq.registrando}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-sm font-black text-white disabled:opacity-60"
            >
              {maq.registrando ? 'Registrando...' : 'Registrar a venda'}
            </button>
          )}

          {falhou && (
            <>
              <button
                onClick={maq.tentarDeNovo}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-black text-white"
              >
                Tentar de novo
              </button>
              <button
                onClick={maq.fechar}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold text-gray-700"
              >
                Voltar (mudar forma de pagamento)
              </button>
              {aoRegistrarManual && (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Registrar a venda SEM a cobrança automática?\n\nUse só se você já recebeu o pagamento de outro jeito (ex.: digitou o valor direto na maquininha).'
                      )
                    ) {
                      maq.fechar();
                      aoRegistrarManual();
                    }
                  }}
                  className="w-full text-xs text-gray-400 underline pt-1"
                >
                  Já recebi de outro jeito — registrar manualmente
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Parcelas (1x a 12x) e quem paga os juros. Só faz sentido no crédito. */
export const SeletorParcelas: React.FC<{
  totalCentavos: number;
  parcelas: number;
  setParcelas: (n: number) => void;
  jurosCliente: boolean;
  setJurosCliente: (v: boolean) => void;
}> = ({ totalCentavos, parcelas, setParcelas, jurosCliente, setJurosCliente }) => {
  const podeParcelar = totalCentavos >= VALOR_MINIMO_PARCELADO_CENTAVOS;

  // Se o total cair abaixo do mínimo, volta para à vista.
  useEffect(() => {
    if (!podeParcelar && parcelas > 1) setParcelas(1);
  }, [podeParcelar, parcelas, setParcelas]);

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-black uppercase text-gray-400 block">Parcelamento</span>
      <select
        value={parcelas}
        disabled={!podeParcelar}
        onChange={(e) => setParcelas(Number(e.target.value))}
        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm disabled:bg-gray-50"
      >
        {Array.from({ length: podeParcelar ? MAX_PARCELAS : 1 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n === 1
              ? `À vista (${reais(totalCentavos)})`
              : jurosCliente
              ? `${n}x (com juros, calculado pela maquininha)`
              : `${n}x de ${reais(Math.ceil(totalCentavos / n))} sem juros`}
          </option>
        ))}
      </select>
      {!podeParcelar && <p className="text-[10px] text-gray-400">Parcelamento a partir de R$ 10,00.</p>}
      {parcelas > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: false, label: 'Sem juros', sub: 'grupo paga a taxa' },
            { v: true, label: 'Com juros', sub: 'cliente paga' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setJurosCliente(o.v)}
              className={cn(
                'p-2 rounded-lg border text-center flex flex-col items-center',
                jurosCliente === o.v
                  ? 'border-blue-500 bg-blue-50 text-blue-600 font-bold'
                  : 'border-gray-200 text-gray-500'
              )}
            >
              <span className="text-xs">{o.label}</span>
              <span className="text-[8px] opacity-75">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
