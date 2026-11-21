import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, UserRound, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AuthFooter, AuthLayout } from '../components/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function passwordIssues(password) {
  const issues = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Za-z]/.test(password)) issues.push('one letter');
  if (!/[0-9]/.test(password)) issues.push('one number');
  return issues;
}

export function PasswordStrength({ value }) {
  const issues = passwordIssues(value);
  const score = value ? 3 - issues.length : 0;
  const label = !value ? 'Enter a password' : issues.length === 0 ? 'Strong password' : `Needs ${issues.join(', ')}`;
  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-bars">
        {[1, 2, 3].map((level) => (
          <span key={level} className={`pw-bar ${score >= level ? `on level-${score}` : ''}`} />
        ))}
      </div>
      <span className="tiny muted">{label}</span>
    </div>
  );
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (serverError) setServerError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    const issues = passwordIssues(form.password);
    if (issues.length) next.password = `Password needs ${issues.join(', ')}.`;
    if (form.confirmPassword !== form.password) next.confirmPassword = 'The passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const user = await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(err.message || 'Unable to create the account.');
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

  return (
    <AuthLayout>
      <h2>Create an account</h2>
      <p className="sub">New accounts start with read-only access until an administrator assigns a role.</p>

      <form className="login-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <div className="input-icon-wrap">
            <UserRound size={15} />
            <input
              id="name"
              className={`input ${errors.name ? 'invalid' : ''}`}
              autoComplete="name"
              placeholder="e.g. Juan Dela Cruz"
              value={form.name}
              onChange={update('name')}
              autoFocus
              maxLength={80}
            />
          </div>
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="field">
          <label htmlFor="email">Email address</label>
          <div className="input-icon-wrap">
            <Mail size={15} />
            <input
              id="email"
              type="email"
              className={`input ${errors.email ? 'invalid' : ''}`}
              autoComplete="email"
              placeholder="name@cvsu.edu.ph"
              value={form.email}
              onChange={update('email')}
              maxLength={120}
            />
          </div>
          {errors.email ? (
            <span className="field-error">{errors.email}</span>
          ) : (
            <span className="field-hint">Used to sign in and to reset your password.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="new-password">Password</label>
          <div className="pw-wrap">
            <input
              id="new-password"
              className={`input ${errors.password ? 'invalid' : ''}`}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Create a password"
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
          {errors.password ? <span className="field-error">{errors.password}</span> : <PasswordStrength value={form.password} />}
        </div>

        <div className="field">
          <label htmlFor="confirm-password">Confirm password</label>
          <div className="pw-wrap">
            <input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              className={`input ${errors.confirmPassword ? 'invalid' : ''}`}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
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
            <Lock size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{serverError}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ minHeight: 40 }}>
          {loading ? <span className="spinner" /> : <UserPlus size={15} />}
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}
