import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RoleRoute } from './features/auth/RoleRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/login/LoginPage';
import { UsersPage } from './pages/users/UsersPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SystemHealthPage } from './pages/system/SystemHealthPage';
import { Role } from '@cloud-stock/shared';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Landing & Login */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Workspace Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Profile accessible to all authenticated roles */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* Staff Directory accessible to ADMIN & MANAGER */}
              <Route element={<RoleRoute allowedRoles={[Role.ADMIN, Role.MANAGER]} />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>

              {/* Security Audit Logs accessible to ADMIN only */}
              <Route element={<RoleRoute allowedRoles={[Role.ADMIN]} />}>
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/system/health" element={<SystemHealthPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
