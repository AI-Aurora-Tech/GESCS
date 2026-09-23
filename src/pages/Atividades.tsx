import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import {
  Plus, Calendar, MapPin, Check, X, Clock, Paperclip, ChefHat,
  DollarSign, ShieldCheck, Palette, Eye, FileText
} from 'lucide-react';

const RAMOS = ['Filhote', 'Lobinho', 'Escoteiro', 'Sênior', 'Pioneiro'];

// Etapas do fluxo, em ordem. cozinha e financeiro são condicionais.
type StepKey = 'cozinha' | 'financeiro' | 'edson' | 'arte' | 'revisao';

const STATUS_LABEL: Record<string, string> = {
  pending_cozinha: 'Aguardando Cozinha (Equipe Formiga)',
  pending_financeiro: 'Aguardando Financeiro',
  pending_edson: 'Aguardando Aprovação do Édson',
  pending_arte: 'Aguardando Arte (Comunicação)',
  pending_revisao: 'Aguardando Revisão do Chefe',
  confirmed: 'Confirmada',
  rejected: 'Recusada'
};

const STATUS_COLOR: Record<string, string> = {
  pending_cozinha: 'bg-amber-100 text-amber-700',
  pending_financeiro: 'bg-blue-100 text-blue-700',
  pending_edson: 'bg-purple-100 text-purple-700',
  pending_arte: 'bg-pink-100 text-pink-700',
  pending_revisao: 'bg-indigo-100 text-indigo-700',
  confirmed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700'
};

// Monta a ordem das etapas conforme as caixas marcadas
const buildOrder = (needsFormiga: boolean, hasFee: boolean): StepKey[] => {
  const order: StepKey[] = [];
  if (needsFormiga) order.push('cozinha');
  if (hasFee) order.push('financeiro');
  order.push('edson', 'arte', 'revisao');
  return order;
};

const stepToStatus = (s: StepKey) => `pending_${s}`;
const statusToStep = (st: string): StepKey | null => {
  const m = st.replace('pending_', '');
  return (['cozinha', 'financeiro', 'edson', 'arte', 'revisao'].includes(m) ? m : null) as StepKey | null;
};

const Atividades: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.role || '';
  const isGeral = role === 'admin_geral';
  const isChefia = role === 'chefia';
  const isCantina = role.includes('cantina');
  const isFinanceiro = role.includes('financeiro');
  const isComunicacao = role === 'user_comunicacao';

  const [activities, setActivities] = useState<any[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const [form, setForm] = useState({
    name: '', local: '', description: '',
    start_at: '', end_at: '',
    needs_formiga: false, has_fee: false
  });

  const fetchActivities = async () => {
    const { data } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
    if (data) setActivities(data);
  };

  useEffect(() => {
    fetchActivities();
    const sub = supabase.channel('activities_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => fetchActivities())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // Quem pode agir na etapa atual da atividade?
  const canActOn = (a: any): boolean => {
    switch (a.status) {
      case 'pending_cozinha': return isCantina || isGeral;
      case 'pending_financeiro': return isFinanceiro || isGeral;
      case 'pending_edson': return isGeral;
      case 'pending_arte': return isComunicacao || isGeral;
      case 'pending_revisao': return a.created_by === profile?.id || isGeral;
      default: return false;
    }
  };

  // Atividades visíveis para o usuário
  const visibleActivities = activities.filter(a => {
    if (isGeral) return true;
    if (isChefia) return a.created_by === profile?.id || a.branch === profile?.branch;
    // cantina/financeiro/comunicacao veem as que passam/passaram pela sua etapa
    return true;
  });

  const actionable = visibleActivities.filter(canActOn);

  // -------- Criar atividade --------
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { alert('Informe o nome da atividade.'); return; }
    if (!form.start_at || !form.end_at) { alert('Informe início e término.'); return; }
    if (form.end_at < form.start_at) { alert('O término não pode ser antes do início.'); return; }

    const branch = profile?.branch || 'Grupo Geral';
    const initialStatus = stepToStatus(buildOrder(form.needs_formiga, form.has_fee)[0]);

    try {
      // 1) Cria a atividade
      const { data: created, error } = await supabase.from('activities').insert([{
        name: form.name.trim(),
        local: form.local,
        description: form.description,
        branch,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        needs_formiga: form.needs_formiga,
        has_fee: form.has_fee,
        status: initialStatus,
        steps: {},
        created_by: profile?.id,
        created_by_name: profile?.display_name
      }]).select('id').single();
      if (error) throw error;

      // 2) Já joga no calendário geral (agenda)
      try {
        const eventId = 'act-' + (created?.id || Math.random().toString(36).slice(2));
        await supabase.from('scout_events').insert([{
          title: form.name.trim(),
          description: `[Atividade] ${form.description || ''}${form.local ? ` — Local: ${form.local}` : ''}`,
          date: form.start_at.split('T')[0],
          end_date: form.end_at.split('T')[0],
          branch
        }]);
        if (created?.id) await supabase.from('activities').update({ event_id: eventId }).eq('id', created.id);
      } catch (evErr) { console.warn('Não foi possível criar o evento na agenda', evErr); }

      setIsCreateOpen(false);
      setForm({ name: '', local: '', description: '', start_at: '', end_at: '', needs_formiga: false, has_fee: false });
      fetchActivities();
      alert('Atividade criada! Ela já apareceu no calendário e entrou no fluxo de aprovação.');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar atividade: ' + (err?.message || '') + '\n\nSe falar em tabela inexistente, rode o SQL (PARTE 9).');
    }
  };

  // -------- Avançar / decidir uma etapa --------
  const applyDecision = async (a: any, decision: 'approve' | 'deny' | 'done' | 'reject', payload: any) => {
    const step = statusToStep(a.status);
    if (!step) return;
    const order = buildOrder(a.needs_formiga, a.has_fee);
    const idx = order.indexOf(step);

    const steps = { ...(a.steps || {}) };
    steps[step] = {
      ...(steps[step] || {}),
      by: profile?.display_name,
      at: new Date().toISOString(),
      obs: payload.obs || '',
      attachment: payload.attachment || null,
      ...(payload.team ? { team: payload.team } : {}),
      ...(payload.payment_link ? { payment_link: payload.payment_link } : {}),
      ...(payload.art_url ? { art_url: payload.art_url } : {}),
      decision
    };

    let newStatus = a.status;
    let reject_reason = a.reject_reason || null;

    if (decision === 'deny') {
      newStatus = 'rejected';
      reject_reason = payload.obs || 'Recusado';
    } else if (step === 'revisao') {
      if (decision === 'approve') newStatus = 'confirmed';
      else { newStatus = 'pending_arte'; reject_reason = payload.obs || 'Arte reprovada'; } // volta p/ refazer a arte
    } else {
      // approve/done -> próxima etapa
      const next = order[idx + 1];
      newStatus = next ? stepToStatus(next) : 'confirmed';
    }

    try {
      const { error } = await supabase.from('activities')
        .update({ status: newStatus, steps, reject_reason, updated_at: new Date().toISOString() })
        .eq('id', a.id);
      if (error) throw error;
      setSelected(null);
      fetchActivities();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao registrar a decisão: ' + (err?.message || 'Erro inesperado'));
    }
  };

  const fmt = (iso?: string) => iso ? format(new Date(iso), 'dd/MM/yyyy HH:mm') : '-';

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atividades</h1>
          <p className="text-gray-500 text-sm">Criação de atividades e fluxo de aprovação (Formiga → Financeiro → Édson → Arte → Revisão).</p>
        </div>
        {(isChefia || isGeral) && (
          <button onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm self-start">
            <Plus size={18} /> Nova Atividade
          </button>
        )}
      </header>

      {/* Ação necessária */}
      {actionable.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="p-4 border-b border-amber-100 bg-amber-50/60">
            <h2 className="font-bold text-amber-800 flex items-center gap-2"><Clock size={18} /> Ação necessária ({actionable.length})</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {actionable.map(a => (
              <ActivityRow key={a.id} a={a} onOpen={() => setSelected(a)} fmt={fmt} actionable />
            ))}
          </div>
        </div>
      )}

      {/* Todas as atividades */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">{isComunicacao ? 'Histórico de solicitações de arte' : 'Atividades'}</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {visibleActivities.map(a => (
            <ActivityRow key={a.id} a={a} onOpen={() => setSelected(a)} fmt={fmt} />
          ))}
          {visibleActivities.length === 0 && (
            <div className="p-10 text-center text-gray-400">Nenhuma atividade cadastrada.</div>
          )}
        </div>
      </div>

      {/* Modal criar */}
      {isCreateOpen && (
        <CreateModal form={form} setForm={setForm} onClose={() => setIsCreateOpen(false)} onSubmit={handleCreate} branch={profile?.branch} />
      )}

      {/* Modal detalhe / ação */}
      {selected && (
        <DetailModal
          a={selected}
          onClose={() => setSelected(null)}
          canAct={canActOn(selected)}
          onDecision={applyDecision}
          fmt={fmt}
        />
      )}
    </div>
  );
};

// ---------- Linha de atividade ----------
const ActivityRow: React.FC<{ a: any; onOpen: () => void; fmt: (s?: string) => string; actionable?: boolean }> = ({ a, onOpen, fmt, actionable }) => (
  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50">
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-bold text-gray-900">{a.name}</p>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase", STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-600')}>
          {STATUS_LABEL[a.status] || a.status}
        </span>
        {a.branch && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{a.branch}</span>}
      </div>
      <p className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1"><Calendar size={12} /> {fmt(a.start_at)} → {fmt(a.end_at)}</span>
        {a.local && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {a.local}</span>}
        {a.needs_formiga && <span className="inline-flex items-center gap-1"><ChefHat size={12} /> Equipe Formiga</span>}
        {a.has_fee && <span className="inline-flex items-center gap-1"><DollarSign size={12} /> Com taxa</span>}
      </p>
    </div>
    <button onClick={onOpen}
      className={cn("px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap self-start",
        actionable ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
      {actionable ? 'Analisar' : 'Ver detalhes'}
    </button>
  </div>
);

// ---------- Modal criar ----------
const CreateModal: React.FC<any> = ({ form, setForm, onClose, onSubmit, branch }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 overflow-y-auto max-h-[92vh]">
      <h2 className="text-xl font-bold mb-1">Nova Atividade {branch ? `— ${branch}` : ''}</h2>
      <p className="text-sm text-gray-500 mb-6">Preencha os dados. A atividade entra no calendário e no fluxo de aprovação.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Atividade</label>
          <input required type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Local da Atividade</label>
          <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Início (dia e hora)</label>
            <input required type="datetime-local" className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value, end_at: form.end_at && form.end_at >= e.target.value ? form.end_at : e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Término (dia e hora)</label>
            <input required type="datetime-local" min={form.start_at} className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" className="rounded text-blue-600" checked={form.needs_formiga}
              onChange={(e) => setForm({ ...form, needs_formiga: e.target.checked })} />
            Vai precisar da Equipe Formiga (cozinha)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" className="rounded text-blue-600" checked={form.has_fee}
              onChange={(e) => setForm({ ...form, has_fee: e.target.checked })} />
            Terá Taxa (financeiro gera link de pagamento)
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição completa da atividade</label>
          <textarea rows={4} className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium">Cancelar</button>
          <button type="submit" className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">Criar Atividade</button>
        </div>
      </form>
    </div>
  </div>
);

// ---------- Modal detalhe / ação ----------
const STEP_META: { key: StepKey; label: string; icon: any }[] = [
  { key: 'cozinha', label: 'Cozinha (Equipe Formiga)', icon: ChefHat },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { key: 'edson', label: 'Aprovação Édson', icon: ShieldCheck },
  { key: 'arte', label: 'Arte (Comunicação)', icon: Palette },
  { key: 'revisao', label: 'Revisão do Chefe', icon: Eye },
];

const DetailModal: React.FC<any> = ({ a, onClose, canAct, onDecision, fmt }) => {
  const [obs, setObs] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [team, setTeam] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [artUrl, setArtUrl] = useState('');
  const step = statusToStep(a.status);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert('Arquivo muito grande (máx. 2MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachment(reader.result as string);
    reader.readAsDataURL(f);
  };

  const order = buildOrder(a.needs_formiga, a.has_fee);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold">{a.name}</h2>
            <p className="text-xs text-gray-500 mt-1">{a.branch} • criada por {a.created_by_name || '-'}</p>
            <span className={cn("inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase", STATUS_COLOR[a.status])}>{STATUS_LABEL[a.status]}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Dados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <p><strong>Início:</strong> {fmt(a.start_at)}</p>
            <p><strong>Término:</strong> {fmt(a.end_at)}</p>
            <p><strong>Local:</strong> {a.local || '-'}</p>
            <p><strong>Equipe Formiga:</strong> {a.needs_formiga ? 'Sim' : 'Não'} • <strong>Taxa:</strong> {a.has_fee ? 'Sim' : 'Não'}</p>
          </div>
          {a.description && <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{a.description}</p>}
          {a.reject_reason && a.status !== 'confirmed' && (
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg"><strong>Observação da recusa/ajuste:</strong> {a.reject_reason}</p>
          )}

          {/* Histórico das etapas */}
          <div>
            <h3 className="text-xs font-black uppercase text-gray-400 mb-2">Histórico do fluxo</h3>
            <div className="space-y-2">
              {STEP_META.filter(s => order.includes(s.key)).map(s => {
                const d = (a.steps || {})[s.key];
                return (
                  <div key={s.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                    <s.icon size={16} className="text-gray-400 mt-0.5" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-gray-800">{s.label}</p>
                      {d ? (
                        <div className="text-xs text-gray-600 mt-0.5 space-y-0.5">
                          <p>{d.decision === 'deny' ? '❌ Negado' : d.decision === 'reject' ? '↩️ Reprovado' : '✔️ OK'} por {d.by} em {fmt(d.at)}</p>
                          {d.team && <p>Equipe escalada: {d.team}</p>}
                          {d.payment_link && <p>Link de pagamento: <a href={d.payment_link} target="_blank" rel="noreferrer" className="text-blue-600 underline">abrir</a></p>}
                          {d.art_url && <p>Arte: <a href={d.art_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">abrir</a></p>}
                          {d.obs && <p>Obs.: {d.obs}</p>}
                          {d.attachment && <p><a href={d.attachment} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1"><Paperclip size={12} /> anexo</a></p>}
                        </div>
                      ) : <p className="text-xs text-gray-400 mt-0.5">Pendente</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ação da etapa atual */}
          {canAct && step && (
            <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 space-y-3">
              <h3 className="font-bold text-amber-800">Sua etapa: {STATUS_LABEL[a.status]}</h3>

              {step === 'cozinha' && (
                <input type="text" placeholder="Equipe escalada (nomes)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={team} onChange={(e) => setTeam(e.target.value)} />
              )}
              {step === 'financeiro' && (
                <input type="text" placeholder="Link de pagamento (com a taxa)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
              )}
              {step === 'arte' && (
                <input type="text" placeholder="Link da arte (Canva/Drive) — ou anexe abaixo" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  value={artUrl} onChange={(e) => setArtUrl(e.target.value)} />
              )}

              <textarea rows={2} placeholder="Observações" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                value={obs} onChange={(e) => setObs(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                <Paperclip size={14} /> Anexo (opcional, máx. 2MB)
                <input type="file" className="hidden" onChange={onFile} />
                {attachment && <span className="text-green-600 font-bold">arquivo anexado ✓</span>}
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                {step === 'arte' ? (
                  <button onClick={() => onDecision(a, 'done', { obs, attachment, art_url: artUrl })}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 inline-flex items-center gap-1.5">
                    <Check size={15} /> Arte pronta — enviar p/ revisão
                  </button>
                ) : step === 'revisao' ? (
                  <>
                    <button onClick={() => onDecision(a, 'approve', { obs, attachment })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 inline-flex items-center gap-1.5">
                      <Check size={15} /> Aprovar arte — confirmar atividade
                    </button>
                    <button onClick={() => { if (!obs.trim()) { alert('Diga o que precisa alterar na arte.'); return; } onDecision(a, 'reject', { obs, attachment }); }}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 inline-flex items-center gap-1.5">
                      <X size={15} /> Reprovar arte (voltar p/ Comunicação)
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onDecision(a, 'approve', { obs, attachment, team, payment_link: paymentLink })}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 inline-flex items-center gap-1.5">
                      <Check size={15} /> Aprovar
                    </button>
                    <button onClick={() => { if (!obs.trim()) { alert('Informe o motivo da recusa nas observações.'); return; } onDecision(a, 'deny', { obs, attachment }); }}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 inline-flex items-center gap-1.5">
                      <X size={15} /> Negar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Atividades;
