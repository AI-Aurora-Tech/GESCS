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
  AlertCircle,
  Pencil
} from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth, getRoles } from '../AuthContext';
import { cn } from '../lib/utils';

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: string;
  roles?: string[];
  branch?: string;
  created_at?: string;
}

const RAMOS = ['Filhote', 'Lobinho', 'Escoteiro', 'Sênior', 'Pioneiro'];

const roleLabels: Record<string, string> = {
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
  user_scout: 'Usuário Escoteiros',
  chefia: 'Chefe (por ramo)',
  diretor_metodos: 'Diretor de Métodos',
  user_comunicacao: 'Comunicação'
};

const labelOf = (r: string) => roleLabels[r] || r;

const Users: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const emptyNew = {
    username: '',
    password: '',
    displayName: '',
    roles: ['user_lojinha'] as string[],
    branch: ''
  };
  const [newUser, setNewUser] = useState(emptyNew);

  const myRoles = getRoles(profile);
  const isGeral = myRoles.includes('admin_geral');
  const isAdmin = myRoles.some(r => r.startsWith('admin_'));
  const isChefia = myRoles.includes('chefia');
  const canManage = isAdmin || isChefia;

  // Níveis que o gestor atual pode atribuir
  const getAvailableRoles = (): string[] => {
    if (isGeral) return Object.keys(roleLabels);
    const set = new Set<string>();
    if (myRoles.includes('admin_cantina')) { set.add('admin_cantina'); set.add('user_cantina'); }
    if (myRoles.includes('admin_lojinha')) { set.add('admin_lojinha'); set.add('user_lojinha'); }
    if (myRoles.includes('admin_ativos')) { set.add('admin_ativos'); set.add('user_ativos'); }
    if (myRoles.includes('admin_financeiro')) { set.add('admin_financeiro'); set.add('user_financeiro'); }
    if (myRoles.includes('admin_scout')) {
      ['admin_scout', 'user_scout', 'chefia', 'diretor_metodos', 'user_comunicacao'].forEach(r => set.add(r));
    }
    if (isChefia) { set.add('chefia'); set.add('user_scout'); }
    return Array.from(set);
  };
  const availableRoles = getAvailableRoles();

  useEffect(() => {
    if (!canManage) return;

    const fetchUsers = async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });

      if (isChefia && !isGeral && !isAdmin) {
        // Chefe "puro" só vê usuários do próprio ramo
        query = query.eq('branch', profile?.branch || '___');
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

  if (!canManage) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-slate-500">
        <Shield className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p>Apenas administradores ou chefes podem gerenciar usuários.</p>
      </div>
    );
  }

  const primaryOf = (roles: string[]) => (roles.includes('admin_geral') ? 'admin_geral' : roles[0]);
  const needsBranch = (roles: string[]) => roles.includes('chefia');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!newUser.roles.length) throw new Error('Selecione pelo menos um nível de acesso.');

      const emailValue = newUser.username.includes('@') ? newUser.username : `${newUser.username}@scouts.local`;

      // Chefe cria sempre no próprio ramo; admin escolhe o ramo quando há "Chefe".
      let branchToSet: string | null = null;
      if (isChefia && !isGeral && !isAdmin) {
        branchToSet = profile?.branch || null;
      } else if (needsBranch(newUser.roles)) {
        if (!newUser.branch) throw new Error('Selecione o ramo para o nível "Chefe".');
        branchToSet = newUser.branch;
      }

      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailValue,
          password: newUser.password,
          displayName: newUser.displayName,
          role: primaryOf(newUser.roles),
          roles: newUser.roles,
          branch: branchToSet
        })
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
          const errMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Erro ao criar usuário');
          throw new Error(errMsg);
        }
      } else {
        await response.text();
        throw new Error('A API retornou HTML em vez de dados. Isso costuma acontecer no Vercel sem o deploy mais recente. Faça o push/deploy das atualizações.');
      }

      setSuccess('Usuário criado com sucesso!');
      setIsModalOpen(false);
      setNewUser(emptyNew);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const roles = editing.roles || [];
      if (!roles.length) throw new Error('Selecione pelo menos um nível de acesso.');
      const branchToSet = needsBranch(roles) ? (editing.branch || null) : null;
      if (needsBranch(roles) && !branchToSet) throw new Error('Selecione o ramo para o nível "Chefe".');

      const response = await fetch('/api/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: editing.id,
          role: primaryOf(roles),
          roles,
          branch: branchToSet
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar níveis de acesso');

      setSuccess('Níveis de acesso atualizados!');
      setEditing(null);
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
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) return;

    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
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

  const toggleNewRole = (r: string) =>
    setNewUser(prev => ({
      ...prev,
      roles: prev.roles.includes(r) ? prev.roles.filter(x => x !== r) : [...prev.roles, r]
    }));

  const toggleEditRole = (r: string) =>
    setEditing(prev => prev ? ({
      ...prev,
      roles: (prev.roles || []).includes(r) ? (prev.roles || []).filter(x => x !== r) : [...(prev.roles || []), r]
    }) : prev);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center">
            <UsersIcon className="w-8 h-8 mr-3 text-blue-600" />
            Gestão de Usuários
          </h1>
          <p className="text-slate-500 font-medium">Controle de acessos e permissões — um usuário pode ter vários níveis.</p>
        </div>

        <button
          onClick={() => { setNewUser(emptyNew); setIsModalOpen(true); }}
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
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Níveis de Acesso</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const roles = getRoles(user);
                return (
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
                        {user.email.replace('@scouts.local', '')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {roles.map(r => (
                          <span key={r} className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase",
                            r.startsWith('admin_') ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {labelOf(r)}
                          </span>
                        ))}
                        {user.branch && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            {user.branch}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setEditing({ ...user, roles: getRoles(user) })}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all mr-1"
                        title="Editar níveis de acesso"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={user.id === profile?.id}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[94vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <UserPlus className="w-6 h-6 mr-3 text-blue-600" />
                Novo Usuário
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-8 space-y-6 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                <input
                  type="text" required
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuário</label>
                <input
                  type="text" required
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                  placeholder="Ex: joaosilva"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha Inicial</label>
                <input
                  type="password" required minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Níveis de Acesso (pode marcar vários)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto">
                  {availableRoles.map(r => (
                    <label key={r} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-white">
                      <input type="checkbox" className="rounded text-blue-600"
                        checked={newUser.roles.includes(r)} onChange={() => toggleNewRole(r)} />
                      {labelOf(r)}
                    </label>
                  ))}
                </div>
              </div>

              {!(isChefia && !isGeral && !isAdmin) && needsBranch(newUser.roles) && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ramo (para o nível Chefe)</label>
                  <select
                    value={newUser.branch}
                    onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium appearance-none"
                  >
                    <option value="">Selecione o ramo...</option>
                    {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl shadow-lg shadow-blue-100 font-bold transition-all flex items-center justify-center">
                  {loading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Níveis */}
      {editing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[94vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
                <Pencil className="w-6 h-6 mr-3 text-blue-600" />
                Editar Acessos
              </h2>
              <button onClick={() => setEditing(null)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveRoles} className="p-8 space-y-6 overflow-y-auto">
              <p className="text-sm text-slate-500">
                <strong className="text-slate-700">{editing.display_name}</strong> — marque todos os níveis que este usuário terá.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-56 overflow-y-auto">
                {availableRoles.map(r => (
                  <label key={r} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-white">
                    <input type="checkbox" className="rounded text-blue-600"
                      checked={(editing.roles || []).includes(r)} onChange={() => toggleEditRole(r)} />
                    {labelOf(r)}
                  </label>
                ))}
              </div>

              {needsBranch(editing.roles || []) && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ramo (para o nível Chefe)</label>
                  <select
                    value={editing.branch || ''}
                    onChange={(e) => setEditing({ ...editing, branch: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium appearance-none"
                  >
                    <option value="">Selecione o ramo...</option>
                    {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={() => setEditing(null)}
                  className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl shadow-lg shadow-blue-100 font-bold transition-all flex items-center justify-center">
                  {loading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : 'Salvar Acessos'}
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
