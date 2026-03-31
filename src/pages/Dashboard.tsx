import React from 'react';
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
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const data = [
  { name: 'Jan', sales: 4000, expenses: 2400 },
  { name: 'Fev', sales: 3000, expenses: 1398 },
  { name: 'Mar', sales: 2000, expenses: 9800 },
  { name: 'Abr', sales: 2780, expenses: 3908 },
  { name: 'Mai', sales: 1890, expenses: 4800 },
  { name: 'Jun', sales: 2390, expenses: 3800 },
];

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Geral</h1>
        <p className="text-gray-500">Visão geral de todos os sistemas integrados.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Vendas Lojinha', value: 'R$ 4.250', icon: Store, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Saldo Cantina', value: 'R$ 1.120', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Escoteiros Ativos', value: '142', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
          { label: 'Ativos Patrimônio', value: '85', icon: Package, color: 'text-orange-600', bg: 'bg-orange-100' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
            </div>
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6">Fluxo Financeiro (Lojinha + Cantina)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
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

import { cn } from '../lib/utils';
export default Dashboard;
