import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon, 
  UserPlus, 
  Trash2, 
  Shield, 
  Mail, 
  User as UserIcon,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'admin_geral' | 'admin_cantina' | 'user_cantina' | 'admin_lojinha' | 'user_lojinha' | 'admin_ativos' | 'user_ativos' | 'admin_financeiro' | 'user_financeiro' | 'admin_scout' | 'user_scout';
  created_at?: string;
}

const Users: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'user_lojinha' as UserProfile['role']
  });

  const isAdmin = profile?.role?.startsWith('admin_');

  useEffect(() => {
    if (!isAdmin) return;

    const fetchUsers = async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });
      
      if (profile?.role && profile.role !== 'admin_geral') {
        const branch = profile.role.split('_')[1];
        if (branch) {
          query = query.like('role', `%${branch}%`);
        }
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching users:', error);
      } else {
        setUsers(data || []);
      }
    };

    fetchUsers();

    const channel = supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
        <Shield className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p>Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar usuário');

      setSuccess('Usuário criado com sucesso!');
      setIsModalOpen(false);
      setNewUser({ email: '', password: '', displayName: '', role: 'user_lojinha' });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === profile?.id) {
      alert('Você não pode excluir seu próprio usuário.');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao excluir usuário');
      }

      setSuccess('Usuário excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleLabels: Record<UserProfile['role'], string> = {
    admin_geral: 'Administrador Geral',
    admin_cantina: 'Admin Cantina',
    user_cantina: 'Usuário Cantina',
    admin_lojinha: 'Admin Lojinha',
    user_lojinha: 'Usuário Lojinha',
    admin_ativos: 'Admin Ativos',
    user_ativos: 'Usuário Ativos',
    admin_financeiro: 'Admin Financeiro',
    user_financeiro: 'Usuário Financeiro',
    admin_scout: 'Admin Escoteiros',
    user_scout: 'Usuário Escoteiros'
  };

  const getAvailableRoles = () => {
    if (profile?.role === 'admin_geral') {
      return Object.entries(roleLabels);
    }
    if (profile?.role === 'admin_cantina') return [['admin_cantina', roleLabels['admin_cantina']], ['user_cantina', roleLabels['user_cantina']]];
    if (profile?.role === 'admin_lojinha') return [['admin_lojinha', roleLabels['admin_lojinha']], ['user_lojinha', roleLabels['user_lojinha']]];
    if (profile?.role === 'admin_ativos') return [['admin_ativos', roleLabels['admin_ativos']], ['user_ativos', roleLabels['user_ativos']]];
    if (profile?.role === 'admin_financeiro') return [['admin_financeiro', roleLabels['admin_financeiro']], ['user_financeiro', roleLabels['user_financeiro']]];
    if (profile?.role === 'admin_scout') return [['admin_scout', roleLabels['admin_scout']], ['user_scout', roleLabels['user_scout']]];
    return [];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
            <UsersIcon className="w-8 h-8 mr-3 text-blue-600" />
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 font-medium">Controle de acessos e permissões do sistema</p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-100 font-bold transition-all transform hover:scale-105"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center text-red-600 font-semibold animate-shake">
          <AlertCircle className="w-5 h-5 mr-3" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center text-emerald-600 font-semibold animate-bounce-in">
          <CheckCircle2 className="w-5 h-5 mr-3" />
          {success}
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nível de Acesso</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mr-3 group-hover:bg-blue-50 transition-colors">
                        <UserIcon className="w-5 h-5 text-slate-500 group-hover:text-blue-600" />
                      </div>
                      <span className="font-bold text-slate-700">{user.display_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-slate-500 font-medium">
                      <Mail className="w-4 h-4 mr-2 opacity-50" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase",
                      user.role.startsWith('admin_') ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={user.id === profile?.id}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <UserPlus className="w-6 h-6 mr-3 text-blue-600" />
                Novo Usuário
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={newUser.displayName}
                    onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                    placeholder="Ex: João Silva"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                    placeholder="exemplo@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha Inicial</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nível de Acesso</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as UserProfile['role']})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium appearance-none"
                  >
                    {getAvailableRoles().map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl shadow-lg shadow-blue-100 font-bold transition-all flex items-center justify-center"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Criar Usuário'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
