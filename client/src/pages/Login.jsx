import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AuthFooter, AuthLayout } from '../components/AuthLayout';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) {
      setError('Enter both your username or email and your password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.username.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Sign in</h2>
      <p className="sub">Use the account issued by your inventory administrator.</p>

      <form className="login-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="username">Username or email</label>
          <div className="input-icon-wrap">
            <UserRound size={15} />
            <input
              id="username"
              className="input"
              autoComplete="username"
              placeholder="Enter your username or email"
              value={form.username}
              onChange={update('username')}
              autoFocus
              maxLength={40}
            />
          </div>
        </div>

        <div className="field">
          <div className="label-row">
            <label htmlFor="password">Password</label>
            <Link to="/forgot-password" className="label-link">
              Forgot password?
            </Link>
          </div>
          <div className="pw-wrap">
            <input
              id="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={form.password}
              onChange={update('password')}
              maxLength={72}
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <Lock size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ minHeight: 40 }}>
          {loading ? <span className="spinner" /> : <Lock size={15} />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-switch">
        Need an account?{' '}
        <Link to="/signup">
          Create one <ArrowRight size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
        </Link>
      </div>

      <p className="login-note auth-note">
        New self-registered accounts receive read-only (Viewer) access. An administrator can upgrade your role after
        reviewing your request.
      </p>

      <AuthFooter />
    </AuthLayout>
  );
}
