import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Package, 
  Store,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const role = profile?.role || '';
  const isGeral = role === 'admin_geral';

  const [stats, setStats] = useState({
    lojinhaSales: 0,
    cantinaBalance: 0,
    activeScouts: 0,
    totalAssets: 0
  });

  type AlertItem = { title: string; type: 'warning' | 'error' | 'info'; subtitle: string; module: string };
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Demandas consolidadas (Admin Geral): lojinha + cantina + ativos
  type UnifiedDemand = { id: string; source: 'lojinha' | 'ativos' | 'purchase'; area: 'lojinha' | 'cantina' | 'ativos'; item: string; quantity: number };
  const [showDemands, setShowDemands] = useState(false);
  const [unifiedDemands, setUnifiedDemands] = useState<UnifiedDemand[]>([]);
  const [newPd, setNewPd] = useState<{ area: 'lojinha' | 'cantina' | 'ativos'; item: string; quantity: number }>({ area: 'cantina', item: '', quantity: 1 });

  const fetchUnifiedDemands = async () => {
    const list: UnifiedDemand[] = [];
    // Lojinha (demandas pendentes, não congeladas)
    try {
      const { data } = await supabase.from('lojinha_demands').select('*').eq('status', 'pending');
      (data || []).filter((d: any) => !d.frozen).forEach((d: any) => list.push({ id: 'lj-' + d.id, source: 'lojinha', area: 'lojinha', item: d.title, quantity: 1 }));
    } catch (e) {}
    // Ativos (patrimônio pendente de aprovação)
    try {
      const { data } = await supabase.from('assets').select('id, name, status').eq('status', 'pending_approval');
      (data || []).forEach((a: any) => list.push({ id: 'at-' + a.id, source: 'ativos', area: 'ativos', item: a.name, quantity: 1 }));
    } catch (e) {}
    // Demandas de compra (cantina/lojinha/ativos) — tabela purchase_demands
    try {
      const { data } = await supabase.from('purchase_demands').select('*').eq('status', 'pending');
      (data || []).forEach((p: any) => list.push({ id: 'pd-' + p.id, source: 'purchase', area: p.area, item: p.item, quantity: p.quantity || 1 }));
    } catch (e) {}
    setUnifiedDemands(list);
  };

  const openDemands = () => { fetchUnifiedDemands(); setShowDemands(true); };

  const handleMarkBought = async (d: UnifiedDemand) => {
    const realId = d.id.substring(3);
    try {
      if (d.source === 'lojinha') {
        await supabase.from('lojinha_demands').update({ status: 'completed', purchased_by: profile?.display_name, purchased_at: new Date().toISOString() }).eq('id', realId);
      } else if (d.source === 'ativos') {
        await supabase.from('assets').update({ status: 'active' }).eq('id', realId);
      } else {
        await supabase.from('purchase_demands').update({ status: 'bought', bought_by: profile?.display_name, bought_at: new Date().toISOString() }).eq('id', realId);
      }
      fetchUnifiedDemands();
    } catch (err: any) {
      alert('Erro ao marcar como comprado: ' + (err?.message || 'Erro inesperado'));
    }
  };

  const handleAddPurchaseDemand = async () => {
    if (!newPd.item.trim()) { alert('Informe o nome do item.'); return; }
    try {
      const { error } = await supabase.from('purchase_demands').insert([{
        area: newPd.area, item: newPd.item.trim(), quantity: Number(newPd.quantity) || 1,
        created_by: profile?.display_name, user_id: profile?.id
      }]);
      if (error) throw error;
      setNewPd({ area: 'cantina', item: '', quantity: 1 });
      fetchUnifiedDemands();
    } catch (err: any) {
      alert('Erro ao adicionar demanda: ' + (err?.message || 'Erro inesperado') + '\n\nSe falar em tabela inexistente, rode o SQL (PARTE 8).');
    }
  };

  const areaLabel: Record<string, string> = { lojinha: 'Lojinha', cantina: 'Cantina', ativos: 'Ativos' };
  const areaBadge: Record<string, string> = { lojinha: 'bg-blue-100 text-blue-700', cantina: 'bg-amber-100 text-amber-700', ativos: 'bg-orange-100 text-orange-700' };

  const canSeeModule = (m: string) => isGeral || role.includes(m);

  const fetchAlerts = async () => {
    const list: AlertItem[] = [];
    try {
      if (canSeeModule('lojinha')) {
        // Estoque baixo
        try {
          const { data: prods } = await supabase.from('products').select('name, size, stock, min_stock');
          (prods || []).forEach((p: any) => {
            const min = Number(p.min_stock) || 5;
            if (Number(p.stock) <= min) {
              list.push({
                title: `Estoque baixo: ${p.name}${p.size ? ` (${p.size})` : ''} — ${p.stock} un`,
                type: Number(p.stock) <= 0 ? 'error' : 'warning',
                subtitle: 'Lojinha • Estoque',
                module: 'lojinha'
              });
            }
          });
        } catch (e) {}

        // Demandas pendentes
        try {
          const { data: dems } = await supabase.from('lojinha_demands').select('*').eq('status', 'pending');
          (dems || [])
            .filter((d: any) => !d.frozen) // demandas congeladas (sazonais) não geram alerta
            .forEach((d: any) => list.push({
              title: `Demanda pendente: ${d.title}`,
              type: 'info',
              subtitle: 'Lojinha • Demanda',
              module: 'lojinha'
            }));
        } catch (e) {}

        // Fiados vencidos
        try {
          const today = new Date().toISOString().split('T')[0];
          const { data: fiados } = await supabase
            .from('lojinha_special_sales')
            .select('chefe_name, due_date, paid, sale_type')
            .eq('sale_type', 'fiado')
            .eq('paid', false);
          (fiados || []).forEach((f: any) => {
            if (f.due_date && f.due_date < today) {
              list.push({
                title: `Fiado vencido: ${f.chefe_name}`,
                type: 'error',
                subtitle: 'Lojinha • Fiado',
                module: 'lojinha'
              });
            }
          });
        } catch (e) {}
      }

      if (canSeeModule('scout')) {
        try {
          const { count } = await supabase
            .from('scout_members')
            .select('*', { count: 'exact', head: true })
            .eq('payment_status', 'overdue');
          if (count && count > 0) {
            list.push({ title: `Inadimplência: ${count} membro(s)`, type: 'error', subtitle: 'Escotismo • Pagamentos', module: 'scout' });
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error(err);
    }
    setAlerts(list);
  };

  useEffect(() => {
    fetchStats();
    fetchAlerts();

    const subStock = supabase
      .channel('dashboard-stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_transactions' }, () => {
        fetchStats();
        fetchAlerts();
      })
      .subscribe();

    const subProducts = supabase
      .channel('dashboard-products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchAlerts();
      })
      .subscribe();

    const subDemands = supabase
      .channel('dashboard-demands-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_demands' }, () => {
        fetchAlerts();
      })
      .subscribe();

    const subFinance = supabase
      .channel('dashboard-finance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, () => {
        fetchStats();
      })
      .subscribe();

    const subScout = supabase
      .channel('dashboard-scout-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scout_members' }, () => {
        fetchStats();
        fetchAlerts();
      })
      .subscribe();

    const subAsset = supabase
      .channel('dashboard-asset-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subStock);
      supabase.removeChannel(subProducts);
      supabase.removeChannel(subDemands);
      supabase.removeChannel(subFinance);
      supabase.removeChannel(subScout);
      supabase.removeChannel(subAsset);
    };
  }, []);

  const fetchStats = async () => {
    try {
      // Lojinha Sales (sum of stock_transactions where type is 'out' or 'exit')
      let lojinhaTotal = 0;
      try {
        const { data: lojinhaData, error: lojinhaError } = await supabase
          .from('stock_transactions')
          .select('quantity, sale_type, notes, products(price, sale_price)')
          .in('type', ['out', 'exit']);

        if (!lojinhaError && lojinhaData) {
          lojinhaTotal = lojinhaData.reduce((acc, curr: any) => {
            // Conta APENAS vendas reais. Exclui doação e ajustes (manual/conferência).
            const notes = (curr.notes || '').toLowerCase();
            const isNaoVenda = curr.sale_type === 'donation' || curr.sale_type === 'adjustment' || notes.includes('ajuste');
            if (isNaoVenda) return acc;
            const pr = Number(curr.products?.sale_price) || Number(curr.products?.price) || 0;
            return acc + ((Number(curr.quantity) || 0) * pr);
          }, 0);
        }
      } catch (e) {}

      // Cantina Balance
      let cantinaBalance = 0;
      try {
        const { data: cantinaData, error: cantinaError } = await supabase
          .from('financial_records')
          .select('type, amount')
          .eq('module', 'cantina');

        if (!cantinaError && cantinaData) {
          cantinaBalance = cantinaData.reduce((acc, curr) => {
            const amt = Number(curr.amount) || 0;
            return curr.type === 'income' ? acc + amt : acc - amt;
          }, 0);
        }
      } catch (e) {}

      // Active Scouts
      let scoutsCount = 0;
      try {
        const { count, error: scoutsError } = await supabase
          .from('scout_members')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        if (!scoutsError) scoutsCount = count || 0;
      } catch (e) {}

      // Total Assets
      let assetsCount = 0;
      try {
        const { count, error: assetsError } = await supabase
          .from('assets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        if (!assetsError) assetsCount = count || 0;
      } catch (e) {}

      setStats({
        lojinhaSales: lojinhaTotal,
        cantinaBalance: cantinaBalance,
        activeScouts: scoutsCount,
        totalAssets: assetsCount
      });
    } catch (err) {
      console.error(err);
    }
  };

  const chartData = [
    (isGeral || role.includes('lojinha')) && { name: 'Lojinha', value: Number(stats.lojinhaSales) || 0 },
    (isGeral || role.includes('cantina') || role.includes('financeiro')) && { name: 'Cantina', value: Number(stats.cantinaBalance) || 0 },
  ].filter(Boolean) as { name: string; value: number }[];

  return (
    <>
    {/* Seção só de impressão: relatório de demandas */}
    <div className="hidden print:block p-8 text-black">
      <h1 className="text-2xl font-black mb-1">Demandas Pendentes — Compras</h1>
      <p className="text-sm mb-6">Relatório consolidado (Lojinha, Cantina e Ativos)</p>
      <table className="w-full text-left border border-black text-sm">
        <thead>
          <tr>
            <th className="border border-black p-2">Área</th>
            <th className="border border-black p-2">Item</th>
            <th className="border border-black p-2 text-center">Qtd</th>
          </tr>
        </thead>
        <tbody>
          {unifiedDemands.map(d => (
            <tr key={d.id}>
              <td className="border border-black p-2">{areaLabel[d.area]}</td>
              <td className="border border-black p-2">{d.item}</td>
              <td className="border border-black p-2 text-center">{d.quantity}</td>
            </tr>
          ))}
          {unifiedDemands.length === 0 && (
            <tr><td colSpan={3} className="border border-black p-3 text-center">Nenhuma demanda pendente.</td></tr>
          )}
        </tbody>
      </table>
    </div>

    <div className="space-y-8 print:hidden">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Geral</h1>
          <p className="text-gray-500">Visão geral de todos os sistemas integrados.</p>
        </div>
        {isGeral && (
          <button
            onClick={openDemands}
            className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 shadow-sm self-start"
          >
            <Package size={18} /> DEMANDAS
          </button>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          (isGeral || role.includes('lojinha')) && { label: 'Vendas Lojinha', value: `R$ ${stats.lojinhaSales.toFixed(2)}`, icon: Store, color: 'text-blue-600', bg: 'bg-blue-100' },
          (isGeral || role.includes('cantina') || role.includes('financeiro')) && { label: 'Saldo Cantina', value: `R$ ${stats.cantinaBalance.toFixed(2)}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
          (isGeral || role.includes('scout')) && { label: 'Escoteiros Ativos', value: stats.activeScouts.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
          (isGeral || role.includes('ativos')) && { label: 'Ativos Patrimônio', value: stats.totalAssets.toString(), icon: Package, color: 'text-orange-600', bg: 'bg-orange-100' },
        ].filter(Boolean).map((stat: any) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
            </div>
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Fluxo Financeiro Atual</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Alertas e Demandas</h3>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Nenhum alerta pendente no momento.
              </div>
            ) : (
              alerts.slice(0, 12).map((alert, i) => (
                <div key={i} className="flex items-start p-4 rounded-lg bg-gray-50 border border-gray-100">
                  <AlertCircle size={20} className={cn(
                    "mt-0.5 mr-3 flex-shrink-0",
                    alert.type === 'warning' ? "text-orange-500" :
                    alert.type === 'error' ? "text-red-500" : "text-blue-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    <p className="text-xs text-gray-500">{alert.subtitle}</p>
                  </div>
                </div>
              ))
            )}
            {alerts.length > 12 && (
              <p className="text-xs text-gray-400 text-center pt-1">+ {alerts.length - 12} outros alertas</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Demandas consolidadas (Admin Geral) */}
      {showDemands && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Demandas Pendentes — Compras</h2>
                <p className="text-xs text-gray-500">Consolidado de Lojinha, Cantina e Ativos.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Imprimir</button>
                <button onClick={() => setShowDemands(false)} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200">Fechar</button>
              </div>
            </div>

            {/* Adicionar demanda (útil p/ Cantina) */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row gap-2">
              <select value={newPd.area} onChange={(e) => setNewPd({ ...newPd, area: e.target.value as any })}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="cantina">Cantina</option>
                <option value="lojinha">Lojinha</option>
                <option value="ativos">Ativos</option>
              </select>
              <input type="text" placeholder="Item a comprar..." value={newPd.item}
                onChange={(e) => setNewPd({ ...newPd, item: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <input type="number" min="1" value={newPd.quantity}
                onChange={(e) => setNewPd({ ...newPd, quantity: parseInt(e.target.value) || 1 })}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button onClick={handleAddPurchaseDemand} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">Adicionar</button>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Área</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qtd</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unifiedDemands.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <span className={cn("px-2 py-1 rounded-full text-[10px] font-black uppercase", areaBadge[d.area])}>{areaLabel[d.area]}</span>
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{d.item}</td>
                      <td className="px-6 py-3 text-center text-sm">{d.quantity}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => handleMarkBought(d)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[11px] font-bold hover:bg-green-700">Comprado</button>
                      </td>
                    </tr>
                  ))}
                  {unifiedDemands.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Nenhuma demanda pendente. 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Dashboard;
