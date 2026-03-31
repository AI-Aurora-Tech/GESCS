import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  FileText,
  DollarSign,
  Filter,
  Download,
  History,
  Settings,
  CreditCard
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FinancialRecord {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: any;
  isExtraordinary: boolean;
}

const Cantina: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'eventos' | 'movimentacao' | 'pagvendas' | 'materiais' | 'relatorios' | 'configuracoes'>('financeiro');
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    type: 'income' as 'income' | 'expense',
    amount: 0,
    category: 'Venda Direta',
    description: '',
    isExtraordinary: false
  });

  const [newMaterial, setNewMaterial] = useState({
    name: '',
    category: 'Salgados',
    price: 0,
    stock: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'financial_records'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialRecord));
      setRecords(recs);
    });

    const qMaterials = query(collection(db, 'cantina_materials'));
    const unsubscribeMaterials = onSnapshot(qMaterials, (snapshot) => {
      const mats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaterials(mats);
    });

    return () => {
      unsubscribe();
      unsubscribeMaterials();
    };
  }, []);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'financial_records'), {
        ...newRecord,
        date: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewRecord({ type: 'income', amount: 0, category: 'Venda Direta', description: '', isExtraordinary: false });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'cantina_materials'), {
        ...newMaterial,
        createdAt: serverTimestamp()
      });
      setIsMaterialModalOpen(false);
      setNewMaterial({ name: '', category: 'Salgados', price: 0, stock: 0 });
    } catch (err) {
      console.error(err);
    }
  };

  const totalIncome = records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((acc, r) => acc + r.amount, 0);
  const balance = totalIncome - totalExpense;

  const tabs = [
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'eventos', label: 'Eventos', icon: Calendar },
    { id: 'movimentacao', label: 'Movimentação', icon: History },
    { id: 'pagvendas', label: 'PagVendas', icon: CreditCard },
    { id: 'materiais', label: 'Materiais', icon: Plus },
    { id: 'relatorios', label: 'Relatórios', icon: FileText },
    { id: 'configuracoes', label: 'Acesso', icon: Settings },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">2. Sistema de Cantina</h1>
          <p className="text-gray-500">Controle financeiro e de materiais da cantina.</p>
        </div>
      </header>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-all",
              activeTab === tab.id 
                ? "border-blue-600 text-blue-600 bg-blue-50/50" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <tab.icon size={16} className="mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'financeiro' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Financial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp size={24} className="text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Entradas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ {totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown size={24} className="text-red-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saídas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">R$ {totalExpense.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign size={24} className="text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo Atual</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                balance >= 0 ? "text-green-600" : "text-red-600"
              )}>
                R$ {balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">Lançamentos Recentes</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  <Plus size={18} className="mr-2" /> Novo Lançamento
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {record.date?.toDate ? format(record.date.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Pendente'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <p className="font-medium text-gray-900">{record.description}</p>
                          {record.isExtraordinary && (
                            <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-bold uppercase rounded-full">
                              Extraordinário
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg">
                          {record.category}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold",
                        record.type === 'income' ? "text-green-600" : "text-red-600"
                      )}>
                        {record.type === 'income' ? '+' : '-'} R$ {record.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'eventos' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-xl font-bold mb-6">Cadastro de Eventos Extraordinários</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Registre eventos que geram movimentação financeira atípica (ex: Acampamentos, Festas Beneficentes).</p>
              <button 
                onClick={() => {
                  setNewRecord({...newRecord, isExtraordinary: true, category: 'Evento Especial'});
                  setIsModalOpen(true);
                }}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all"
              >
                Criar Novo Evento
              </button>
            </div>
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
              <h4 className="font-bold text-purple-900 mb-2">Próximos Eventos</h4>
              <ul className="space-y-2 text-sm text-purple-700">
                <li>• Festa da Primavera (15/04)</li>
                <li>• Acampamento de Grupo (22/05)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'movimentacao' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Histórico de Entradas e Saídas</h3>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {r.date?.toDate ? format(r.date.toDate(), 'dd/MM/yyyy HH:mm') : 'Pendente'}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {r.description}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        r.type === 'income' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                      )}>
                        {r.type === 'income' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-right font-bold",
                      r.type === 'income' ? "text-green-600" : "text-red-600"
                    )}>
                      R$ {r.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pagvendas' && (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Integração PagVendas</h2>
            <p className="text-gray-500 mb-8">
              Conecte sua conta PagVendas para sincronizar vendas da cantina automaticamente.
            </p>
            <button className="px-8 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-all">
              Configurar Token de API
            </button>
          </div>
        </div>
      )}

      {activeTab === 'materiais' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Materiais e Produtos Ofertados</h2>
            <button 
              onClick={() => setIsMaterialModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" /> Novo Material
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {materials.map((m) => (
              <div key={m.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {m.category}
                  </span>
                  <span className="text-xs font-bold text-gray-900">R$ {m.price.toFixed(2)}</span>
                </div>
                <h4 className="font-bold text-gray-900">{m.name}</h4>
                <p className="text-xs text-gray-500 mt-1">Estoque: {m.stock} un</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'configuracoes' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-6">Controle de Acesso (Cantina)</h2>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <h4 className="font-bold mb-2">Segregação de Funções</h4>
                <p className="text-sm text-gray-500 mb-4">
                  Controle quem pode registrar gastos, eventos e gerenciar materiais da cantina.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Coordenador da Cantina</span>
                    <span className="text-xs text-green-600 font-bold">Acesso Total</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <span className="text-sm font-medium">Tesoureiro</span>
                    <span className="text-xs text-blue-600 font-bold">Apenas Financeiro</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Relatórios Internos</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="text-sm">Lucratividade por Categoria</span>
                <Download size={16} className="text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="text-sm">Consumo Médio por Evento</span>
                <Download size={16} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Relatórios para Contadora</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                <span className="text-sm">DRE Simplificado (PDF)</span>
                <FileText size={16} />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                <span className="text-sm">Livro Caixa (Excel)</span>
                <FileText size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Novo Lançamento Financeiro</h2>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
                <button 
                  type="button"
                  onClick={() => setNewRecord({...newRecord, type: 'income'})}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                    newRecord.type === 'income' ? "bg-white text-green-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Entrada
                </button>
                <button 
                  type="button"
                  onClick={() => setNewRecord({...newRecord, type: 'expense'})}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                    newRecord.type === 'expense' ? "bg-white text-red-600 shadow-sm" : "text-gray-500"
                  )}
                >
                  Saída
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Venda de salgados, Compra de insumos..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newRecord.description}
                  onChange={(e) => setNewRecord({...newRecord, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newRecord.amount}
                    onChange={(e) => setNewRecord({...newRecord, amount: parseFloat(e.target.value)})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newRecord.category}
                    onChange={(e) => setNewRecord({...newRecord, category: e.target.value})}
                  >
                    <option>Venda Direta</option>
                    <option>Evento Especial</option>
                    <option>Compra de Insumos</option>
                    <option>Manutenção</option>
                    <option>Outros</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox"
                  id="extraordinary"
                  className="w-4 h-4 text-blue-600 rounded"
                  checked={newRecord.isExtraordinary}
                  onChange={(e) => setNewRecord({...newRecord, isExtraordinary: e.target.checked})}
                />
                <label htmlFor="extraordinary" className="text-sm text-gray-600">Evento Extraordinário</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Cadastrar Novo Material/Produto</h2>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newMaterial.name}
                  onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMaterial.category}
                    onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})}
                  >
                    <option>Salgados</option>
                    <option>Bebidas</option>
                    <option>Doces</option>
                    <option>Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMaterial.price}
                    onChange={(e) => setNewMaterial({...newMaterial, price: parseFloat(e.target.value)})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Inicial</label>
                <input 
                  required
                  type="number"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newMaterial.stock}
                  onChange={(e) => setNewMaterial({...newMaterial, stock: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cantina;
