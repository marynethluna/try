import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, RoleBadge, SectionCard } from '../components/common';
import { formatDate, formatDateTime } from '../utils/format';
import { ROLE_DESCRIPTIONS } from '../utils/permissions';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', email: user.email || '' });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (profile.name.trim().length < 2) {
      toast.error('Enter your full name.');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/auth/profile', { name: profile.name.trim(), email: profile.email.trim() });
      await refresh();
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error.message || 'Unable to update the profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Review and update your account information." />
      <div className="settings-grid">
        <SectionCard title="My profile" description="Your account information and role" icon={UserRound}>
          <div className="profile-head">
            <div className="avatar lg">{user?.initials || 'U'}</div>
            <div>
              <h2>{user?.name}</h2>
              <p>@{user?.username}</p>
              <div style={{ marginTop: 6 }}>
                <RoleBadge role={user?.role} />
              </div>
            </div>
          </div>
          <form onSubmit={saveProfile}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="profile-name">Full name</label>
                <input
                  id="profile-name"
                  className="input"
                  autoComplete="name"
                  value={profile.name}
                  onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                  maxLength={80}
                  required
                  minLength={2}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-email">Email address</label>
                <div className="input-icon-wrap">
                  <Mail size={14} />
                  <input
                    id="profile-email"
                    type="email"
                    className="input"
                    autoComplete="email"
                    value={profile.email}
                    onChange={(event) => setProfile({ ...profile, email: event.target.value })}
                    maxLength={120}
                  />
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <span className="spinner" /> : <Save size={15} />} Save profile
              </button>
              <span className="tiny muted">Username and role are managed by an administrator.</span>
            </div>
          </form>
          <div className="divider" />
          <div className="detail-grid">
            <div className="detail-item">
              <div className="dt">Role</div>
              <div className="dd">{user?.role}</div>
            </div>
            <div className="detail-item">
              <div className="dt">Account status</div>
              <div className="dd">
                <span className={`badge badge-${user?.isActive === false ? 'danger' : 'success'} no-dot`}>
                  {user?.isActive === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <div className="dt">Last login</div>
              <div className="dd">{user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</div>
            </div>
            <div className="detail-item">
              <div className="dt">Member since</div>
              <div className="dd">{formatDate(user?.createdAt)}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Your access" description={ROLE_DESCRIPTIONS[user?.role]} icon={ShieldCheck}>
          <div className="security-list">
            <div className="security-item">
              <CheckCircle2 size={14} /> View the dashboard, inventory and reports
            </div>
            {user?.role !== 'Viewer' && (
              <div className="security-item">
                <CheckCircle2 size={14} /> Add and edit inventory items, record stock and borrowing
              </div>
            )}
            {user?.role === 'Administrator' && (
              <div className="security-item">
                <CheckCircle2 size={14} /> Manage accounts, roles, categories, inventory rules and activity logs
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
