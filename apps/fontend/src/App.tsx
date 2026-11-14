import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';
import { ThemeProvider } from './features/theme/ThemeContext';
import { I18nProvider } from './features/i18n/I18nContext';
import { RootRedirect } from './features/auth/RootRedirect';
import { PublicOnlyRoute } from './features/auth/PublicOnlyRoute';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RoleRoute } from './features/auth/RoleRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/login/LoginPage';
import { UsersPage } from './pages/users/UsersPage';
import { AuditLogsPage } from './pages/audit/AuditLogsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SystemHealthPage } from './pages/system/SystemHealthPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { WarehousesPage } from './pages/warehouses/WarehousesPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { InventoryOverviewPage } from './pages/inventory/InventoryOverviewPage';
import { LowStockPage } from './pages/inventory/LowStockPage';
import { StockDocumentsPage } from './pages/stock-documents/StockDocumentsPage';
import { StockDocumentCreatePage } from './pages/stock-documents/StockDocumentCreatePage';
import { StockDocumentDetailPage } from './pages/stock-documents/StockDocumentDetailPage';
import { ApprovalQueuePage } from './pages/stock-documents/ApprovalQueuePage';
import { StockMovementsPage } from './pages/stock-movements/StockMovementsPage';
import { ImportExportPage } from './pages/import-export/ImportExportPage';
import { Role } from '@cloud-stock/shared';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
          {/* Root entry: immediately redirects based on auth state and role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public-only login route: redirects authenticated users to workspace */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Authenticated Workspace Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Profile accessible to all authenticated roles */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* Operations Overview Dashboard */}
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Warehouse & Inventory Management */}
              <Route path="/warehouses" element={<WarehousesPage />} />
              <Route path="/inventory" element={<InventoryOverviewPage />} />
              <Route path="/inventory/low-stock" element={<LowStockPage />} />
              <Route path="/stock-documents" element={<StockDocumentsPage />} />
              <Route path="/stock-documents/new" element={<StockDocumentCreatePage />} />
              <Route path="/stock-documents/create" element={<StockDocumentCreatePage />} />
              <Route path="/stock-documents/:id" element={<StockDocumentDetailPage />} />
              <Route path="/movements" element={<StockMovementsPage />} />
              <Route path="/import-export" element={<ImportExportPage />} />

              {/* Approval Queue accessible to ADMIN & MANAGER */}
              <Route element={<RoleRoute allowedRoles={[Role.ADMIN, Role.MANAGER]} />}>
                <Route path="/approvals" element={<ApprovalQueuePage />} />
              </Route>

              {/* Catalog & Products accessible to ADMIN, MANAGER, STAFF */}
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />

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
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
