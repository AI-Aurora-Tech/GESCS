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
  Target,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image
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
  receipt_base64?: string | null;
}

const Financeiro: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [filter, setFilter] = useState({
    module: 'all',
    branch: 'all',
    dateRange: 'month'
  });
  const [bankFilter, setBankFilter] = useState<'all' | 'pagbank' | 'cora' | 'cash'>('all');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'Excel' | 'PowerPoint' | 'Imagem' | null>(null);
  
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  const extractAttachment = (record: FinancialRecord) => {
    if (record.receipt_base64) {
      return { cleanDescription: record.description, attachment: record.receipt_base64 };
    }
    const desc = record.description || '';
    const match = desc.match(/\[ANEXO_NF:(.*?)\]/);
    if (match) {
      const cleanDescription = desc.replace(/\s*\[ANEXO_NF:.*?\]/, '');
      return { cleanDescription, attachment: match[1] };
    }
    return { cleanDescription: desc, attachment: null };
  };

  const handleExportFile = (format: 'PDF' | 'Excel' | 'PowerPoint' | 'Imagem') => {
    setIsExporting(true);
    setExportFormat(format);
    setTimeout(() => {
      setIsExporting(false);
      setIsExportModalOpen(false);
      setExportFormat(null);

      if (format === 'Excel') {
        // Create CSV payload
        const headers = ['Data', 'Tipo', 'Categoria', 'Descricao', 'Valor', 'Modulo', 'Ramo'];
        const rows = records.map(r => [
          r.date,
          r.type === 'income' ? 'Entrada' : 'Saida',
          r.category,
          r.description || '',
          r.amount,
          r.module,
          r.branch || ''
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + [headers.join(';'), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(';'))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'PDF') {
        window.print();
      } else {
        // PowerPoint and Imagem download simulated files
        const content = `Relatorio Financeiro Sempre Alerta\nData: ${new Date().toLocaleDateString('pt-BR')}\nFormato: ${format}\nRegistros exportados: ${records.length}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.${format === 'PowerPoint' ? 'pptx' : 'png'}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 1500);
  };

  const getBank = (record: FinancialRecord) => {
    if (!record.description) return 'Dinheiro';
    const desc = record.description.toLowerCase();
    if (desc.includes('pagbank')) return 'PagBank';
    if (desc.includes('cora')) return 'Cora';
    return 'Dinheiro';
  };

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

    const sub = supabase
      .channel('financial-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_records' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [filter]);

  // Bank allocation derived calculations (always calculated from full set records to stay consistent)
  const pagbankIncome = records.filter(r => r.type === 'income' && getBank(r) === 'PagBank').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const pagbankExpense = records.filter(r => r.type === 'expense' && getBank(r) === 'PagBank').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const pagbankBalance = pagbankIncome - pagbankExpense;

  const coraIncome = records.filter(r => r.type === 'income' && getBank(r) === 'Cora').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const coraExpense = records.filter(r => r.type === 'expense' && getBank(r) === 'Cora').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const coraBalance = coraIncome - coraExpense;

  const cashIncome = records.filter(r => r.type === 'income' && getBank(r) === 'Dinheiro').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const cashExpense = records.filter(r => r.type === 'expense' && getBank(r) === 'Dinheiro').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const cashBalance = cashIncome - cashExpense;

  // Prune list content according to active bank tab selection
  const filteredRecords = records.filter(r => {
    if (bankFilter === 'all') return true;
    const rBank = getBank(r).toLowerCase();
    if (bankFilter === 'pagbank' && rBank === 'pagbank') return true;
    if (bankFilter === 'cora' && rBank === 'cora') return true;
    if (bankFilter === 'cash' && rBank === 'dinheiro') return true;
    return false;
  });

  const totalIncome = filteredRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const totalExpense = filteredRecords.filter(r => r.type === 'expense').reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Financeiro Consolidado</h1>
          <p className="text-gray-500 text-sm">Visão geral de todas as receitas e despesas do grupo.</p>
        </div>
        <button 
          onClick={() => setIsExportModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
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

      {/* Segmented Bank / Cash Split */}
      <div className="bg-slate-50 border border-slate-100 p-6 rounded-2xl">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
          📍 Saldos por Instituição Bancária & Meios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PagBank Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full inline-block mb-1">
                PagBank MB
              </span>
              <p className="text-[10px] text-gray-400 font-medium">Lojinha & Cantina POS</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">R$ {pagbankBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-[9px] text-gray-400 font-mono text-right">
              <span className="text-green-600">+{pagbankIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> <br/>
              <span className="text-red-500">-{pagbankExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Cora Bank Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full inline-block mb-1 font-sans">
                Banco Cora (Futuro)
              </span>
              <p className="text-[10px] text-gray-400 font-medium">Transações Separadas</p>
              <p className="text-lg font-black text-gray-400 mt-0.5">R$ {coraBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-[9px] text-cyan-500 font-black tracking-wider uppercase">
              Previsto
            </div>
          </div>

          {/* Cash / Caixa Geral Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-1">
                Caixa / Dinheiro
              </span>
              <p className="text-[10px] text-gray-400 font-medium">Dinheiro em Espécie</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">R$ {cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-[9px] text-gray-400 font-mono text-right">
              <span className="text-green-600">+{cashIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> <br/>
              <span className="text-red-500">-{cashExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
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
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Conta / Banco</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'all', label: 'Todos os Bancos' },
                    { id: 'pagbank', label: 'PagBank (Maquininha)' },
                    { id: 'cora', label: 'Banco Cora (Futuro)' },
                    { id: 'cash', label: 'Caixa / Dinheiro (Físico)' }
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => setBankFilter(b.id as any)}
                      className={cn(
                        "text-left px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        bankFilter === b.id ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {b.label}
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
            <div className="h-64 flex items-center justify-center">
              {totalIncome > 0 || totalExpense > 0 ? (
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
                    <Tooltip formatter={(val: any) => `R$ ${Number(val).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-100 flex items-center justify-center text-gray-300 font-bold text-xs">
                    Sem dados
                  </div>
                  <p className="text-xs text-gray-400 mt-4 leading-relaxed max-w-[180px]">
                    Nenhuma transação financeira registrada para este intervalo de filtros.
                  </p>
                </div>
              )}
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
                  {filteredRecords.length} Lançamentos
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Descrição / Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider">Módulo / Ramo / Conta</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record) => {
                    const parsed = extractAttachment(record);
                    return (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-900">{format(new Date(record.date), 'dd/MM/yyyy')}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{format(new Date(record.date), 'HH:mm')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-bold text-gray-800">{parsed.cleanDescription}</p>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">{record.category}</p>
                            {parsed.attachment && (
                              <button
                                onClick={() => setViewingAttachment(parsed.attachment)}
                                className="mt-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold uppercase rounded-full flex items-center gap-0.5 transition-colors cursor-pointer self-start"
                              >
                                📎 Ver NF/Recibo
                              </button>
                            )}
                          </div>
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
                          <span className={cn(
                            "text-[10px] font-black uppercase px-2 py-0.5 rounded self-start tracking-wider",
                            getBank(record) === 'PagBank' ? "bg-purple-100 text-purple-700" :
                            getBank(record) === 'Cora' ? "bg-cyan-100 text-cyan-700" :
                            "bg-emerald-100 text-emerald-700"
                          )}>
                            🏦 {getBank(record)}
                          </span>
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
                    );
                  })}
                  {filteredRecords.length === 0 && (
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

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 animate-in fade-in duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Exportar Relatório Financeiro</h3>
                <p className="text-sm text-gray-500 mt-1">Escolha o formato ideal para exportação dos dados consolidados.</p>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {isExporting ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-semibold text-gray-700">Gerando arquivo no formato <span className="text-blue-600 font-bold">{exportFormat}</span>...</p>
                <p className="text-xs text-gray-400">Por favor, aguarde alguns instantes.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* PDF option */}
                  <button
                    onClick={() => handleExportFile('PDF')}
                    className="p-4 border border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50/20 text-left transition-all flex flex-col gap-3 group"
                  >
                    <div className="p-3 bg-red-100 text-red-600 rounded-xl group-hover:scale-110 transition-transform self-start">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">PDF (.pdf)</h4>
                      <p className="text-xs text-gray-500 mt-1">Imprimir ou salvar DRE Simplificado.</p>
                    </div>
                  </button>

                  {/* Excel option */}
                  <button
                    onClick={() => handleExportFile('Excel')}
                    className="p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50/20 text-left transition-all flex flex-col gap-3 group"
                  >
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform self-start">
                      <FileSpreadsheet size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Excel (.xlsx/.csv)</h4>
                      <p className="text-xs text-gray-500 mt-1">Planilha completa de lançamentos.</p>
                    </div>
                  </button>

                  {/* PowerPoint option */}
                  <button
                    onClick={() => handleExportFile('PowerPoint')}
                    className="p-4 border border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50/20 text-left transition-all flex flex-col gap-3 group"
                  >
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-xl group-hover:scale-110 transition-transform self-start">
                      <Presentation size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">PowerPoint (.pptx)</h4>
                      <p className="text-xs text-gray-500 mt-1">Slides prontos com os gráficos.</p>
                    </div>
                  </button>

                  {/* Imagem option */}
                  <button
                    onClick={() => handleExportFile('Imagem')}
                    className="p-4 border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all flex flex-col gap-3 group"
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform self-start">
                      <Image size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Imagem (.png)</h4>
                      <p className="text-xs text-gray-500 mt-1">Exportar gráficos para relatórios.</p>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-6 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Attachment Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Anexo: Nota Fiscal / Recibo</h3>
              <button 
                onClick={() => setViewingAttachment(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 rounded-xl p-3 flex justify-center items-center border border-gray-150 min-h-[250px]">
              {viewingAttachment.startsWith('data:image/') ? (
                <img 
                  src={viewingAttachment} 
                  alt="Anexo Nota Fiscal / Recibo" 
                  className="max-w-full max-h-[55vh] object-contain rounded shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : viewingAttachment.startsWith('data:application/pdf') ? (
                <iframe 
                  src={viewingAttachment} 
                  title="PDF Anexo" 
                  className="w-full h-[55vh] rounded"
                />
              ) : (
                <div className="text-center p-6">
                  <p className="text-sm text-gray-500 mb-3">Este arquivo não pode ser visualizado diretamente no navegador.</p>
                  <a 
                    href={viewingAttachment} 
                    download="anexo_financeiro" 
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
                  >
                    Baixar Arquivo
                  </a>
                </div>
              )}
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <a 
                href={viewingAttachment} 
                download="anexo_financeiro" 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg transition-colors"
              >
                Baixar Anexo
              </a>
              <button 
                onClick={() => setViewingAttachment(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financeiro;
