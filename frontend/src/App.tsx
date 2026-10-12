import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { RouteFallback } from '@/components/layout/RouteFallback';

// Route-level code splitting keeps the landing page and 3D grid out of each other's bundles.
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DemoPage = lazy(() => import('@/pages/DemoPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const GridPage = lazy(() => import('@/pages/GridPage'));
const TransformersPage = lazy(() => import('@/pages/TransformersPage'));
const TransformerDetailPage = lazy(() => import('@/pages/TransformerDetailPage'));
const AlertsPage = lazy(() => import('@/pages/AlertsPage'));
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));
const FaultHistoryPage = lazy(() => import('@/pages/FaultHistoryPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/demo" element={<DemoPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/grid" element={<GridPage />} />
            <Route path="/transformers" element={<TransformersPage />} />
            <Route path="/transformers/:id" element={<TransformerDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/fault-history" element={<FaultHistoryPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route element={<ProtectedRoute roles={['ADMIN', 'ENGINEER', 'OPERATOR']} />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['ADMIN', 'ENGINEER']} />}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
