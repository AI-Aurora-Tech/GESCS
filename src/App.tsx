import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import Lojinha from './pages/Lojinha';
import Cantina from './pages/Cantina';
import Scouts from './pages/Scouts';
import Inventory from './pages/Inventory';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Users from './pages/Users';

import ForcePasswordChange from './components/ForcePasswordChange';

const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.requires_password_change) return <ForcePasswordChange />;
  
  if (allowedRoles && profile) {
    const isGeral = profile.role === 'admin_geral';
    const hasAccess = isGeral || allowedRoles.some(role => profile.role.includes(role));
    
    if (!hasAccess) {
      return <Navigate to="/" />;
    }
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="lojinha" element={<ProtectedRoute allowedRoles={['lojinha']}><Lojinha /></ProtectedRoute>} />
            <Route path="cantina" element={<ProtectedRoute allowedRoles={['cantina', 'financeiro']}><Cantina /></ProtectedRoute>} />
            <Route path="scouts" element={<ProtectedRoute allowedRoles={['scout']}><Scouts /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute allowedRoles={['ativos']}><Inventory /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute allowedRoles={['admin_']}><Users /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
