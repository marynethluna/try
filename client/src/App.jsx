import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ChartProvider } from './context/ChartContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Borrowing from './pages/Borrowing';
import Categories from './pages/Categories';
import Places from './pages/Places';
import Reports from './pages/Reports';
import Users from './pages/Users';
import ActivityLogs from './pages/ActivityLogs';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { can } from './utils/permissions';
import { Logo } from './components/Logo';

function FullScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Logo height={34} tone="light" alt="" />
        <span className="spinner lg" />
        <span className="small muted">Loading your workspace…</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Route-level role guard — the API enforces the same rules server-side. */
function RequirePermission({ permission, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user.role, permission)) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 32 }}>
        <div className="empty-icon" style={{ margin: '0 auto 12px' }}>
          <span style={{ fontSize: 20 }}>🔒</span>
        </div>
        <h2 style={{ fontSize: 17 }}>Access restricted</h2>
        <p className="small muted" style={{ marginTop: 6 }}>
          Your role ({user.role}) does not have permission to open this module. If you believe this is a mistake,
          please contact an administrator.
        </p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
          Back to dashboard
        </Link>
      </div>
    );
  }
  return children;
}

/** Public-only route: signed-in users are sent to the dashboard. */
function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      {/* Public routes — the only pages reachable without signing in. */}
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/borrowing" element={<Borrowing />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/places" element={<Places />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/users"
          element={
            <RequirePermission permission="users:read">
              <Users />
            </RequirePermission>
          }
        />
        <Route
          path="/logs"
          element={
            <RequirePermission permission="logs:read">
              <ActivityLogs />
            </RequirePermission>
          }
        />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ChartProvider>
            <AppRoutes />
          </ChartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
