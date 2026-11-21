import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { AuthFooter, AuthLayout } from '../components/AuthLayout';
import { PasswordStrength, passwordIssues } from './Signup';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const next = {};
    const issues = passwordIssues(form.password);
    if (issues.length) next.password = `Password needs ${issues.join(', ')}.`;
    if (form.confirmPassword !== form.password) next.confirmPassword = 'The passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setDone(true);
      toast.success('Password reset. Please sign in with your new password.');
      setTimeout(() => navigate('/login', { replace: true }), 2200);
    } catch (err) {
      setServerError(err.message || 'Unable to reset your password.');
      if (err.details) {
        const fieldMap = {};
        err.details.forEach((detail) => {
          fieldMap[detail.field] = detail.message;
        });
        setErrors(fieldMap);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <h2>Reset link required</h2>
        <p className="sub">This page is opened from the link in your password reset email.</p>
        <div className="login-error" role="alert">
          <ShieldAlert size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>This link is missing its reset token. Request a new password reset link to continue.</span>
        </div>
        <div className="auth-switch">
          <Link to="/forgot-password">Request a new reset link</Link>
        </div>
        <AuthFooter />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h2>Password updated</h2>
        <p className="sub">Your password was reset and all other sessions were signed out.</p>
        <div className="login-note auth-note" role="status">
          <CheckCircle2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>Redirecting you to the sign-in page…</span>
        </div>
        <div className="auth-switch">
          <Link to="/login">Go to sign in now</Link>
        </div>
        <AuthFooter />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Choose a new password</h2>
      <p className="sub">Set a password you have not used before. The reset link works only once.</p>

      <form className="login-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="password">New password</label>
          <div className="pw-wrap">
            <input
              id="password"
              className={`input ${errors.password ? 'invalid' : ''}`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Enter a new password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              autoFocus
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
          {errors.password ? <span className="field-error">{errors.password}</span> : <PasswordStrength value={form.password} />}
        </div>

        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <div className="pw-wrap">
            <input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              className={`input ${errors.confirmPassword ? 'invalid' : ''}`}
              autoComplete="new-password"
              placeholder="Re-enter the new password"
              value={form.confirmPassword}
              onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
              maxLength={72}
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowConfirm((current) => !current)}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              aria-pressed={showConfirm}
              title={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
        </div>

        {serverError && (
          <div className="login-error" role="alert">
            <ShieldAlert size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{serverError}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ minHeight: 40 }}>
          {loading ? <span className="spinner" /> : <KeyRound size={15} />}
          {loading ? 'Updating password…' : 'Reset password'}
        </button>
      </form>

      <div className="auth-switch">
        <Link to="/login">
          <ArrowLeft size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> Back to sign in
        </Link>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}
