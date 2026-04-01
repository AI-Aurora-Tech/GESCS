import React from 'react';
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
  Key
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { supabase } from '../supabase';

const Layout: React.FC = () => {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const handlePasswordChange = async () => {
    if (profile) {
      const { error } = await supabase
        .from('profiles')
        .update({ requires_password_change: true })
        .eq('id', profile.id);
      
      if (!error) {
        window.location.reload();
      }
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
            onClick={handlePasswordChange}
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
    </div>
  );
};

export default Layout;
