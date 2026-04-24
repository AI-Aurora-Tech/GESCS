import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download,
  Calendar,
  Building,
  Target
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  module: 'lojinha' | 'cantina' | 'geral';
  branch?: 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo';
}

const Financeiro: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [filter, setFilter] = useState({
    module: 'all',
    branch: 'all',
    dateRange: 'month'
  });

  const fetchData = async () => {
    let query = supabase.from('financial_records').select('*').order('date', { ascending: false });
    
    if (filter.module !== 'all') {
      query = query.eq('module', filter.module);
    }
    if (filter.branch !== 'all') {
      query = query.eq('branch', filter.branch);
    }

    const { data } = await query;
    if (data) setRecords(data);
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const chartData = [
    { name: 'Entradas', value: totalIncome },
    { name: 'Saídas', value: totalExpense },
  ];

  const COLORS = ['#10b981', '#ef4444'];

  const branches = ['Lobinho', 'Escoteiro', 'Senior', 'Pioneiro', 'Grupo'];
  const modules = [
    { id: 'all', label: 'Todos os Módulos' },
    { id: 'lojinha', label: 'Lojinha' },
    { id: 'cantina', label: 'Cantina' },
    { id: 'geral', label: 'Geral' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Financeiro Consolidado</h1>
          <p className="text-gray-500">Visão geral de todas as receitas e despesas do grupo.</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
          <Download size={18} className="mr-2" /> Exportar Relatório
        </button>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total de Entradas</p>
          <p className="text-3xl font-black text-gray-900 mt-1">R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
              <TrendingDown size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total de Saídas</p>
          <p className="text-3xl font-black text-gray-900 mt-1">R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Saldo em Caixa</p>
          <p className={cn(
            "text-3xl font-black mt-1",
            balance >= 0 ? "text-blue-600" : "text-red-600"
          )}>
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold flex items-center mb-6">
              <Filter size={18} className="mr-2 text-blue-600" /> Filtros de Visualização
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Módulo</label>
                <div className="grid grid-cols-1 gap-2">
                  {modules.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setFilter({...filter, module: m.id})}
                      className={cn(
                        "text-left px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        filter.module === m.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Ramo / Unidade</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFilter({...filter, branch: 'all'})}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all",
                      filter.branch === 'all' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-100"
                    )}
                  >
                    Todos
                  </button>
                  {branches.map(b => (
                    <button
                      key={b}
                      onClick={() => setFilter({...filter, branch: b as any})}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-bold text-center border transition-all",
                        filter.branch === b ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-100"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Distribuição</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-gray-500 uppercase">Entradas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-gray-500 uppercase">Saídas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">Lançamentos Financeiros</h3>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">
                  {records.length} Lançamentos
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Descrição / Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Módulo / Ramo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{format(new Date(record.date), 'HH:mm')}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-800">{record.description}</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{record.category}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-gray-500 uppercase px-2 py-0.5 bg-gray-100 rounded self-start">
                            {record.module}
                          </span>
                          {record.branch && (
                            <span className="text-[10px] font-bold text-indigo-600 uppercase px-2 py-0.5 bg-indigo-50 rounded self-start">
                              {record.branch}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className={cn(
                          "text-sm font-black",
                          record.type === 'income' ? "text-emerald-600" : "text-red-500"
                        )}>
                          {record.type === 'income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
                        </p>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Financeiro;
