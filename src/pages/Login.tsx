import React from 'react';
import { useAuth } from '../AuthContext';
import { Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const { user, login } = useAuth();

  if (user) return <Navigate to="/" />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
          <span className="text-white text-3xl font-bold -rotate-3">G</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">GESCS Management</h1>
        <p className="text-gray-600 mb-8">Sistema Integrado de Gestão do Grupo Escoteiro</p>
        
        <button
          onClick={login}
          className="flex items-center justify-center w-full py-3 px-4 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5 mr-3" />
          Entrar com Google
        </button>
      </div>
    </div>
  );
};

export default Login;
