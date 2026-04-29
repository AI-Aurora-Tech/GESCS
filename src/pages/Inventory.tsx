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
  Download,
  Barcode as BarcodeIcon
} from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../AuthContext';
import Barcode from 'react-barcode';
import Logo from '../components/Logo';

interface Asset {
  id: string;
  name: string;
  barcode?: string;
  description: string;
  value: number;
  status: 'active' | 'disposed' | 'pending_approval';
  justification?: string;
  branch: 'Lobinho' | 'Escoteiro' | 'Senior' | 'Pioneiro' | 'Grupo';
  date_acquired: string;
  date_disposed?: string;
}

const Inventory: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'ativos' | 'demandas' | 'etiquetas' | 'baixas' | 'relatorios'>('ativos');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisposalModalOpen, setIsDisposalModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [disposalJustification, setDisposalJustification] = useState('');

  const [newAsset, setNewAsset] = useState({
    name: '',
    barcode: '',
    description: '',
    value: 0,
    branch: 'Grupo' as Asset['branch'],
    status: 'pending_approval' as 'pending_approval'
  });

  const generateBarcode = () => {
    return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
  };

  useEffect(() => {
    if (!user || authLoading) return;

    fetchAssets();

    const subscription = supabase
      .channel('assets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => fetchAssets())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, authLoading]);

  const fetchAssets = async () => {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setAssets(data);
    if (error) console.error(error);
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const barcode = newAsset.barcode || generateBarcode();
      const { error } = await supabase.from('assets').insert([{ ...newAsset, barcode }]);
      if (error) throw error;
      
      setIsModalOpen(false);
      setNewAsset({ name: '', barcode: '', description: '', value: 0, branch: 'Grupo', status: 'pending_approval' });
      fetchAssets();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (assetId: string) => {
    try {
      const { error } = await supabase
        .from('assets')
        .update({ status: 'active' })
        .eq('id', assetId);
      if (error) throw error;
      fetchAssets();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    try {
      const { error } = await supabase
        .from('assets')
        .update({ 
          status: 'disposed',
          justification: disposalJustification,
          date_disposed: new Date().toISOString()
        })
        .eq('id', selectedAsset.id);
      
      if (error) throw error;

      setIsDisposalModalOpen(false);
      setDisposalJustification('');
      setSelectedAsset(null);
      fetchAssets();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleAssetSelection = (id: string) => {
    setSelectedAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAssets = () => {
    const activeAssets = assets.filter(a => a.status === 'active');
    if (selectedAssetIds.size === activeAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(activeAssets.map(a => a.id)));
    }
  };

  const isUserAtivos = profile?.role === 'user_ativos';

  const allTabs = [
    { id: 'ativos', label: 'Gestão de Ativos', icon: Box },
    { id: 'demandas', label: 'Fluxo de Novas Demandas', icon: ClipboardCheck },
    { id: 'etiquetas', label: 'Etiquetas', icon: FileText },
    { id: 'baixas', label: 'Baixa de Ativos', icon: Trash2 },
    { id: 'relatorios', label: 'Relatórios de Inventário', icon: FileText },
  ];

  const tabs = isUserAtivos
    ? allTabs.filter(t => !['relatorios'].includes(t.id))
    : allTabs;

  return (
    <div className="space-y-8 print:hidden">
      <div className="hidden print:block p-4">
        <div className="grid grid-cols-4 gap-4">
          {assets.filter(a => selectedAssetIds.has(a.id)).map((asset) => (
            <div key={asset.id} className="bg-white p-4 border border-gray-300 rounded-xl flex flex-col items-center text-center shadow-sm text-black">
              <Logo size={48} branch={asset.branch} className="mb-2" />
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">{asset.branch}</span>
              <span className="font-bold text-xs mb-2 leading-tight h-8 flex items-center">{asset.name}</span>
              {asset.barcode && (
                <div className="mt-auto">
                  <Barcode 
                    value={asset.barcode} 
                    height={30} 
                    width={1.2} 
                    fontSize={8} 
                    margin={0}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <header className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">4. Sistema de Inventário</h1>
          <p className="text-gray-500">Controle patrimonial e gestão de ativos do grupo.</p>
        </div>
      </header>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center px-4 md:px-6 py-3 border-b-2 font-medium text-sm transition-all flex-shrink-0",
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
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="rounded text-blue-600 focus:ring-blue-500"
                        checked={selectedAssetIds.has(asset.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleAssetSelection(asset.id);
                        }}
                      />
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        asset.status === 'active' ? "bg-green-100 text-green-600" :
                        asset.status === 'pending_approval' ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-600"
                      )}>
                        {asset.status === 'active' ? 'Ativo' : asset.status === 'pending_approval' ? 'Pendente' : 'Baixado'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900">R$ {asset.value.toFixed(2)}</p>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{asset.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{asset.description}</p>
                  
                  <div className="flex items-center text-xs text-gray-400">
                    <Clock size={14} className="mr-1" />
                    Adquirido em: {asset.date_acquired ? format(new Date(asset.date_acquired), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
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
                    <div className="flex gap-2 w-full">
                      <button 
                        onClick={() => {
                          setSelectedAsset(asset);
                          setIsDisposalModalOpen(true);
                        }}
                        className="flex-1 flex items-center justify-center py-2 bg-white border border-gray-200 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-100"
                      >
                        <Trash2 size={14} className="mr-1" /> Dar Baixa
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAssetIds(new Set([asset.id]));
                          setTimeout(() => window.print(), 100);
                        }}
                        className="p-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100"
                        title="Imprimir Etiqueta"
                      >
                        <BarcodeIcon size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full text-center text-xs text-gray-400 italic py-2">
                      Baixado em: {asset.date_disposed ? format(new Date(asset.date_disposed), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
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

      {activeTab === 'etiquetas' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
            <div>
              <h3 className="text-lg font-bold">Impressão de Etiquetas de Ativos</h3>
              <p className="text-sm text-gray-500">Selecione os ativos abaixo para gerar as etiquetas.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <input 
                    id="select-all-assets"
                    type="checkbox"
                    className="rounded text-blue-600 focus:ring-blue-500"
                    checked={selectedAssetIds.size === assets.filter(a => a.status === 'active').length && assets.length > 0}
                    onChange={toggleAllAssets}
                  />
                  <label htmlFor="select-all-assets" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Selecionar Todos ({assets.filter(a => a.status === 'active').length})
                  </label>
                </div>
                <span className="text-xs text-gray-400">
                  {selectedAssetIds.size} selecionados
                </span>
              </div>
            </div>
            <button 
              onClick={() => {
                if (selectedAssetIds.size === 0) {
                  alert("Selecione ao menos um ativo para imprimir.");
                  return;
                }
                window.print();
              }}
              className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              Imprimir Etiquetas ({selectedAssetIds.size})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {assets.filter(a => a.status === 'active').map((asset) => (
              <div 
                key={asset.id} 
                onClick={() => toggleAssetSelection(asset.id)}
                className={cn(
                  "bg-white p-4 border rounded-xl flex flex-col items-center text-center shadow-sm cursor-pointer transition-all",
                  selectedAssetIds.has(asset.id) ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-100 hover:border-blue-200"
                )}
              >
                <div className="self-end mb-1">
                  <input 
                    type="checkbox" 
                    className="rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                    checked={selectedAssetIds.has(asset.id)}
                    readOnly
                  />
                </div>
                <Logo size={48} branch={asset.branch} className="mb-2" />
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{asset.branch}</span>
                <span className="font-bold text-xs mb-2 leading-tight h-8 flex items-center">{asset.name}</span>
                {asset.barcode && (
                  <div className="mt-auto">
                    <Barcode 
                      value={asset.barcode} 
                      height={30} 
                      width={1.2} 
                      fontSize={8} 
                      margin={0}
                    />
                  </div>
                )}
              </div>
            ))}
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
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                  <select 
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newAsset.branch}
                    onChange={(e) => setNewAsset({...newAsset, branch: e.target.value as any})}
                  >
                    <option value="Grupo">Grupo</option>
                    <option value="Lobinho">Lobinho</option>
                    <option value="Escoteiro">Escoteiro</option>
                    <option value="Senior">Senior</option>
                    <option value="Pioneiro">Pioneiro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cód. Barras (Opcional)</label>
                <input 
                  type="text"
                  placeholder="Gerado se vazio"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newAsset.barcode}
                  onChange={(e) => setNewAsset({...newAsset, barcode: e.target.value})}
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
