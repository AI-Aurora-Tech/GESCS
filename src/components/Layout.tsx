import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Coffee, 
  Users, 
  Package, 
  LogOut,
  Menu,
  X,
  Settings,
  Key,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { supabase } from '../supabase';

const Layout: React.FC = () => {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  
  // Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setPasswordSuccess(true);
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setPasswordError('Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard }
  ];

  const role = profile?.role || '';
  const isGeral = role === 'admin_geral';

  if (isGeral || role.includes('lojinha')) {
    navigation.push({ name: '1. Lojinha', href: '/lojinha', icon: Store });
  }
  if (isGeral || role.includes('cantina') || role.includes('financeiro')) {
    navigation.push({ name: '2. Cantina & Financeiro', href: '/cantina', icon: Coffee });
  }
  if (isGeral || role.includes('scout')) {
    navigation.push({ name: '3. Escoteiros', href: '/scouts', icon: Users });
  }
  if (isGeral || role.includes('ativos')) {
    navigation.push({ name: '4. Inventário', href: '/inventory', icon: Package });
  }

  if (role.startsWith('admin_')) {
    navigation.push({ name: '5. Usuários', href: '/users', icon: Settings });
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col print:hidden",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <span className="font-bold text-xl text-blue-600">GESCS Admin</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-gray-100 rounded">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center p-3 rounded-lg transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-600" 
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon size={20} />
                {isSidebarOpen && <span className="ml-3 font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                {profile?.display_name?.[0] || 'U'}
              </div>
            )}
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{profile?.display_name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center w-full p-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors mb-2"
          >
            <Key size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Trocar Senha</span>}
          </button>
          <button 
            onClick={logout}
            className="flex items-center w-full p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-slate-100 relative">
            <button 
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {passwordSuccess ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Senha Atualizada!</h2>
                <p className="text-slate-500">Sua senha foi alterada com sucesso.</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Trocar Senha</h2>
                  <p className="text-slate-500 text-sm">
                    Defina uma nova senha para sua conta.
                  </p>
                </div>

                {passwordError && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center text-red-600 text-sm font-semibold">
                    <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium text-slate-700"
                        placeholder="Mínimo 6 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirmar Nova Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none font-medium text-slate-700"
                        placeholder="Repita a nova senha"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl shadow-lg shadow-blue-200 font-bold text-lg transition-all flex items-center justify-center"
                  >
                    {isChangingPassword ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Atualizar Senha'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
