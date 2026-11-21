import { Link } from 'react-router-dom';
import { BarChart3, Boxes, ClipboardList, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

const FEATURES = [
  { icon: ShieldCheck, text: 'Role-based access for administrators, inventory staff and viewers.' },
  { icon: Boxes, text: 'Accurate stock levels with low-stock and out-of-stock alerts.' },
  { icon: ClipboardList, text: 'Borrowing and return tracking with overdue monitoring.' },
  { icon: BarChart3, text: 'Printable reports, CSV exports and a complete audit trail.' },
];

/**
 * Shared two-panel frame used by the public auth pages
 * (login, sign up, forgot password, reset password).
 */
export function AuthLayout({ children }) {
  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="brand-row">
            <Logo height={30} tone="dark" alt="" />
            <div className="brand-copy">
              <b>School Inventory System</b>
              <small>Management System with Access Control</small>
            </div>
          </div>
          <h1>
            Laboratory inventory,
            <br />
            <em>organized and accountable.</em>
          </h1>
          <p className="lead">
            A centralized platform for computer laboratory equipment, school resources and borrowed items — with
            access control that keeps every record accountable.
          </p>
          <div className="login-features">
            {FEATURES.map((feature) => (
              <div className="login-feature" key={feature.text}>
                <span className="lf-icon">
                  <feature.icon size={14} />
                </span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-brand-foot">
          <b>Cavite State University</b> · Don Severino de las Alas Campus
          <br />
          College of Engineering and Information Technology · Indang, Cavite
        </div>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-brand">
            <Logo height={26} tone="light" alt="" />
            <div className="brand-copy">
              <b>School Inventory System</b>
              <small>Management System with Access Control</small>
            </div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export function AuthFooter() {
  return (
    <p className="login-foot">
      Protected by role-based access control ·{' '}
      <Link to="/privacy" className="login-foot-link">
        Data privacy
      </Link>{' '}
      · School Inventory Management System v1.0
    </p>
  );
}
