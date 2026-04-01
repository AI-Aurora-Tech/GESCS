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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  if (profile?.requires_password_change) return <ForcePasswordChange />;
  
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
            <Route path="lojinha" element={<Lojinha />} />
            <Route path="cantina" element={<Cantina />} />
            <Route path="scouts" element={<Scouts />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
