import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminPage } from './pages/AdminPage';
import { CapaVerificationPage } from './pages/CapaVerificationPage';
import { DashboardPage } from './pages/DashboardPage';
import { InputDashboardPage } from './pages/InputDashboardPage';
import { InvestigationPage } from './pages/InvestigationPage';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E5E7EB] flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Loading OHS EXPERT workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/input" element={<InputDashboardPage />} />
        <Route path="/investigations" element={<InvestigationPage />} />
        <Route path="/capa" element={<CapaVerificationPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/admin"
          element={user.role === 'ADMIN' ? <AdminPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
