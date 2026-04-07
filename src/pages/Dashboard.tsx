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

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Lojinha Sales (sum of stock_transactions where type is 'out')
      let lojinhaTotal = 0;
      try {
        const { data: lojinhaData, error: lojinhaError } = await supabase
          .from('stock_transactions')
          .select('quantity, products(price)')
          .eq('type', 'out');
        
        if (!lojinhaError && lojinhaData) {
          lojinhaTotal = lojinhaData.reduce((acc, curr: any) => acc + (curr.quantity * (curr.products?.price || 0)), 0);
        }
      } catch (e) {}

      // Cantina Balance
      let cantinaBalance = 0;
      try {
        const { data: cantinaData, error: cantinaError } = await supabase
          .from('financial_records')
          .select('type, amount');
        
        if (!cantinaError && cantinaData) {
          cantinaBalance = cantinaData.reduce((acc, curr) => {
            return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
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
    (isGeral || role.includes('lojinha')) && { name: 'Lojinha', value: stats.lojinhaSales },
    (isGeral || role.includes('cantina') || role.includes('financeiro')) && { name: 'Cantina', value: stats.cantinaBalance },
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Geral</h1>
        <p className="text-gray-500">Visão geral de todos os sistemas integrados.</p>
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
          <div className="space-y-4">
            {[
              { title: 'Estoque Baixo: Camiseta G', type: 'warning', time: '2h atrás' },
              { title: 'Novo Ativo para Aprovação', type: 'info', time: '5h atrás' },
              { title: 'Inadimplência: 12 Membros', type: 'error', time: '1d atrás' },
              { title: 'Evento Cantina: Festa Junina', type: 'info', time: '2d atrás' },
            ].map((alert, i) => (
              <div key={i} className="flex items-start p-4 rounded-lg bg-gray-50 border border-gray-100">
                <AlertCircle size={20} className={cn(
                  "mt-0.5 mr-3",
                  alert.type === 'warning' ? "text-orange-500" : 
                  alert.type === 'error' ? "text-red-500" : "text-blue-500"
                )} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  <p className="text-xs text-gray-500">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
