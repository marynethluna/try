import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, Send } from 'lucide-react';
import api from '../api/client';
import { AuthFooter, AuthLayout } from '../components/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter the email address registered on your account.');
      return;
    }
    setLoading(true);
    try {
      // The API always answers with the same generic message whether or not the
      // address exists — that is deliberate, so the page must not echo it back.
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Unable to send the reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h2>Forgot password</h2>
      <p className="sub">Enter your account email and we will send a single-use reset link.</p>

      {sent ? (
        <div className="auth-done" role="status">
          <span className="auth-done-icon">
            <CheckCircle2 size={22} />
          </span>
          <h3>Request submitted</h3>
          <p className="sub">
            Check your inbox for the reset link. It expires after 30 minutes and can only be used once.
          </p>
        </div>
      ) : (
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <div className="input-icon-wrap">
              <Mail size={15} />
              <input
                id="email"
                type="email"
                className={`input ${error ? 'invalid' : ''}`}
                autoComplete="email"
                placeholder="name@cvsu.edu.ph"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError('');
                }}
                autoFocus
                maxLength={120}
              />
            </div>
            {error && <span className="field-error">{error}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ minHeight: 40 }}>
            {loading ? <span className="spinner" /> : <Send size={15} />}
            {loading ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>
      )}

      <div className="auth-switch">
        <Link to="/login">
          <ArrowLeft size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> Back to sign in
        </Link>
      </div>

      <AuthFooter />
    </AuthLayout>
  );
}
