import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Trash2,
  FileText,
  ShieldCheck,
  AlertCircle,
  Box,
  ClipboardCheck,
  Download
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Asset {
  id: string;
  name: string;
  description: string;
  value: number;
  status: 'active' | 'disposed' | 'pending_approval';
  justification?: string;
  dateAcquired: any;
  dateDisposed?: any;
}

const Inventory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ativos' | 'demandas' | 'baixas' | 'relatorios'>('ativos');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [disposalJustification, setDisposalJustification] = useState('');

  const [newAsset, setNewAsset] = useState({
    name: '',
    description: '',
    value: 0,
    status: 'pending_approval' as 'pending_approval'
  });

  useEffect(() => {
    const q = query(collection(db, 'assets'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const asts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      setAssets(asts);
    });
    return () => unsubscribe();
  }, []);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'assets'), {
        ...newAsset,
        dateAcquired: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewAsset({ name: '', description: '', value: 0, status: 'pending_approval' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (assetId: string) => {
    try {
      await updateDoc(doc(db, 'assets', assetId), { status: 'active' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      await updateDoc(doc(db, 'assets', selectedAsset.id), { 
        status: 'disposed',
        justification: disposalJustification,
        dateDisposed: serverTimestamp()
      });
      setIsDisposalModalOpen(false);
      setDisposalJustification('');
      setSelectedAsset(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'ativos', label: 'Gestão de Ativos', icon: Box },
    { id: 'demandas', label: 'Fluxo de Novas Demandas', icon: ClipboardCheck },
    { id: 'baixas', label: 'Baixa de Ativos', icon: Trash2 },
    { id: 'relatorios', label: 'Relatórios de Inventário', icon: FileText },
  ];

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">4. Sistema de Inventário</h1>
          <p className="text-gray-500">Controle patrimonial e gestão de ativos do grupo.</p>
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

      {activeTab === 'ativos' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome ou descrição do ativo..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Assets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => (
              <div key={asset.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      asset.status === 'active' ? "bg-green-100 text-green-600" :
                      asset.status === 'pending_approval' ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                    )}>
                      {asset.status === 'active' ? 'Ativo' : asset.status === 'pending_approval' ? 'Pendente' : 'Baixado'}
                    </span>
                    <p className="text-sm font-bold text-gray-900">R$ {asset.value.toFixed(2)}</p>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{asset.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{asset.description}</p>
                  
                  <div className="flex items-center text-xs text-gray-400">
                    <Clock size={14} className="mr-1" />
                    Adquirido em: {asset.dateAcquired?.toDate ? format(asset.dateAcquired.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2">
                  {asset.status === 'pending_approval' ? (
                    <>
                      <button 
                        onClick={() => handleApprove(asset.id)}
                        className="flex-1 flex items-center justify-center py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle2 size={14} className="mr-1" /> Aprovar
                      </button>
                      <button className="flex-1 flex items-center justify-center py-2 bg-white border border-gray-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50">
                        <XCircle size={14} className="mr-1" /> Recusar
                      </button>
                    </>
                  ) : asset.status === 'active' ? (
                    <button 
                      onClick={() => {
                        setSelectedAsset(asset);
                        setIsDisposalModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100"
                    >
                      <Trash2 size={14} className="mr-1" /> Dar Baixa
                    </button>
                  ) : (
                    <div className="w-full text-center text-xs text-gray-400 italic py-2">
                      Baixado em: {asset.dateDisposed?.toDate ? format(asset.dateDisposed.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'demandas' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold mb-6">Fluxo de Novas Demandas</h2>
            <div className="space-y-6">
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-2">Solicitar Novo Ativo</h4>
                <p className="text-sm text-blue-700 mb-4">Inicie um processo de compra ou aquisição para o grupo.</p>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                >
                  Abrir Solicitação
                </button>
              </div>
              
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
                  <h4 className="font-bold text-sm uppercase tracking-wider text-gray-500">Aguardando Aprovação</h4>
                </div>
                <div className="p-12 text-center text-gray-400">
                  <ClipboardCheck size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nenhuma demanda pendente de aprovação.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'baixas' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4 text-red-600">Baixa de Ativos</h2>
            <p className="text-gray-500 mb-8">Registre a saída definitiva de um ativo do patrimônio do grupo (venda, descarte ou perda).</p>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Pesquisar ativo para dar baixa..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
                />
              </div>
              <div className="p-12 border-2 border-dashed border-gray-100 rounded-2xl text-center text-gray-400">
                Selecione um ativo acima para iniciar o processo de baixa.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Relatórios Patrimoniais</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="text-sm">Inventário Geral Detalhado</span>
                <Download size={16} className="text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <span className="text-sm">Depreciação de Ativos</span>
                <Download size={16} className="text-gray-400" />
              </button>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Controle Financeiro in-loco</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                <span className="text-sm">Relatório de Ativos por Local</span>
                <FileText size={16} />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                <span className="text-sm">Termos de Responsabilidade</span>
                <FileText size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Demand Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Nova Demanda de Ativo</h2>
            <form onSubmit={handleAddAsset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Ativo</label>
                <input 
                  required
                  type="text"
                  placeholder="Ex: Barraca 4 pessoas, Projetor..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Especificação</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({...newAsset, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Estimado (R$)</label>
                <input 
                  required
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newAsset.value}
                  onChange={(e) => setNewAsset({...newAsset, value: parseFloat(e.target.value)})}
                />
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
                  Enviar para Aprovação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disposal Modal */}
      {isDisposalModalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-2 text-red-600">Baixa de Ativo</h2>
            <p className="text-sm text-gray-500 mb-6">Você está dando baixa no ativo: <strong>{selectedAsset.name}</strong></p>
            <form onSubmit={handleDispose} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Justificativa da Baixa</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Ex: Danificado sem conserto, Fim da vida útil..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={disposalJustification}
                  onChange={(e) => setDisposalJustification(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setIsDisposalModalOpen(false);
                    setSelectedAsset(null);
                  }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
                >
                  Confirmar Baixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
