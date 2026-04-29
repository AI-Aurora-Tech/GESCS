import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Upload, 
  Download, 
  Filter,
  UserCheck,
  UserX,
  CreditCard,
  AlertTriangle,
  BarChart3,
  FileText
} from 'lucide-react';
import { supabase } from '../supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../AuthContext';

interface ScoutMember {
  id: string;
  paxtu_id: string;
  name: string;
  status: 'active' | 'inactive' | 'exempt';
  payment_status: 'paid' | 'overdue' | 'exempt';
  email: string;
  last_update: string;
}

const Scouts: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'membros' | 'pagamentos' | 'paxtu' | 'relatorios'>('membros');
  const [members, setMembers] = useState<ScoutMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    paxtu_id: '',
    name: '',
    status: 'active' as 'active' | 'inactive' | 'exempt',
    payment_status: 'paid' as 'paid' | 'overdue' | 'exempt',
    email: ''
  });

  useEffect(() => {
    if (!user || authLoading) return;

    fetchMembers();

    const subscription = supabase
      .channel('members_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scout_members' }, () => fetchMembers())
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, authLoading]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('scout_members')
      .select('*')
      .order('name', { ascending: true });
    
    if (data) setMembers(data);
    if (error) console.error(error);
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('scout_members').insert([newMember]);
      if (error) throw error;
      
      setIsModalOpen(false);
      setNewMember({ paxtu_id: '', name: '', status: 'active', payment_status: 'paid', email: '' });
      fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.paxtu_id?.includes(searchTerm)
  );

  const stats = {
    active: members.filter(m => m.status === 'active').length,
    overdue: members.filter(m => m.payment_status === 'overdue').length,
    exempt: members.filter(m => m.status === 'exempt').length,
    inactive: members.filter(m => m.status === 'inactive').length,
  };

  const isUserScout = profile?.role === 'user_scout';

  const allTabs = [
    { id: 'membros', label: 'Cadastro de Membros', icon: UserCheck },
    { id: 'pagamentos', label: 'Controle de Pagamentos (CORA)', icon: CreditCard },
    { id: 'paxtu', label: 'Importação PAXTU', icon: Upload },
    { id: 'relatorios', label: 'Relatórios e Dashboards', icon: BarChart3 },
  ];

  const tabs = isUserScout
    ? allTabs.filter(t => !['relatorios'].includes(t.id))
    : allTabs;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">3. Sistema de Membros</h1>
          <p className="text-gray-500">Gestão de efetivo, registros e financeiro individual.</p>
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

      {activeTab === 'membros' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
              { label: 'Inadimplentes', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
              { label: 'Isentos', value: stats.exempt, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-100' },
              { label: 'Inativos', value: stats.inactive, icon: UserX, color: 'text-gray-600', bg: 'bg-gray-100' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("p-2 rounded-lg", stat.bg)}>
                    <stat.icon size={18} className={stat.color} />
                  </div>
                  <span className="text-xl md:text-2xl font-bold text-gray-900">{stat.value}</span>
                </div>
                <p className="text-xs md:text-sm text-gray-500 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome ou ID PAXTU..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Member Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-lg font-bold">Efetivo Atual</h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full md:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={18} className="mr-2" /> Novo Cadastro
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Membro</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID PAXTU</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Pagamento</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Última Atualização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {member.paxtu_id}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          member.status === 'active' ? "bg-green-100 text-green-600" :
                          member.status === 'exempt' ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
                        )}>
                          {member.status === 'active' ? 'Ativo' : member.status === 'exempt' ? 'Isento' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          member.payment_status === 'paid' ? "bg-green-100 text-green-600" :
                          member.payment_status === 'overdue' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                        )}>
                          {member.payment_status === 'paid' ? 'Em dia' : member.payment_status === 'overdue' ? 'Inadimplente' : 'Isento'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {member.last_update ? format(new Date(member.last_update), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pagamentos' && (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Integração CORA</h2>
            <p className="text-gray-500 mb-8">
              Conecte sua conta bancária CORA para conciliação automática de mensalidades e taxas de eventos.
            </p>
            <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all">
              Vincular Conta CORA
            </button>
          </div>
        </div>
      )}

      {activeTab === 'paxtu' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Importação de Dados PAXTU</h2>
            <p className="text-gray-500 mb-8">Sincronize o efetivo do grupo através da exportação de dados do sistema nacional PAXTU.</p>
            
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-blue-400 transition-all cursor-pointer">
              <Upload className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="font-medium text-gray-900">Clique para selecionar ou arraste o arquivo .csv</p>
              <p className="text-xs text-gray-500 mt-2">Apenas arquivos exportados do PAXTU são suportados.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'relatorios' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-6">Distribuição por Ramo</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-sm text-gray-400">Gráfico de Pizza: Alcatéia, Tropa, Clã...</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-bold mb-6">Inadimplência Mensal</h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-sm text-gray-400">Gráfico de Barras: Histórico de 6 meses</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold mb-4">Exportações Disponíveis</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="flex items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                <FileText className="mr-2 text-blue-600" size={20} />
                <span className="text-sm font-medium">Lista de Contatos</span>
              </button>
              <button className="flex items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                <FileText className="mr-2 text-blue-600" size={20} />
                <span className="text-sm font-medium">Relatório Financeiro</span>
              </button>
              <button className="flex items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                <FileText className="mr-2 text-blue-600" size={20} />
                <span className="text-sm font-medium">Ficha Médica Coletiva</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
            <h2 className="text-xl font-bold mb-6">Novo Cadastro de Escoteiro</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  required
                  type="text"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID PAXTU</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMember.paxtu_id}
                    onChange={(e) => setNewMember({...newMember, paxtu_id: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input 
                    required
                    type="email"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMember.email}
                    onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMember.status}
                    onChange={(e) => setNewMember({...newMember, status: e.target.value as any})}
                  >
                    <option value="active">Ativo</option>
                    <option value="exempt">Isento</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pagamento</label>
                  <select 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    value={newMember.payment_status}
                    onChange={(e) => setNewMember({...newMember, payment_status: e.target.value as any})}
                  >
                    <option value="paid">Em dia</option>
                    <option value="overdue">Inadimplente</option>
                    <option value="exempt">Isento</option>
                  </select>
                </div>
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
    </div>
  );
};

export default Scouts;
