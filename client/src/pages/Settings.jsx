import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Moon,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tags,
  X,
} from 'lucide-react';
import api, { setMemoryToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, SectionCard } from '../components/common';
import { PasswordStrength, passwordIssues } from './Signup';
import { formatNumber } from '../utils/format';

const TABS = [
  { id: 'password', label: 'Password', icon: KeyRound },
  { id: 'preferences', label: 'Preferences', icon: Sun },
  { id: 'system', label: 'Inventory rules', icon: SlidersHorizontal, adminOnly: true },
];

export default function Settings() {
  const { isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'preferences');
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [referenceLists, setReferenceLists] = useState({ units: [], conditions: [] });
  const [referenceDrafts, setReferenceDrafts] = useState({ units: '', conditions: '' });
  const [referenceListsLoaded, setReferenceListsLoaded] = useState(false);
  const [referenceSaving, setReferenceSaving] = useState(false);

  const visibleTabs = TABS.filter((entry) => !entry.adminOnly || isAdmin);

  useEffect(() => {
    const wanted = searchParams.get('tab');
    const requestedTab = TABS.find((entry) => entry.id === wanted && (!entry.adminOnly || isAdmin));
    setTab(requestedTab?.id || 'preferences');
  }, [searchParams, isAdmin]);

  const loadSettings = useCallback(async () => {
    try {
      const result = await api.get('/settings');
      setSettings(result.settings);
      setReferenceLists({
        units: result.settings.units || [],
        conditions: result.settings.conditions || [],
      });
    } catch (error) {
      setSettings(null);
      toast.error(error.message || 'Unable to load settings.');
    } finally {
      setReferenceListsLoaded(true);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (!passwords.current) return setPasswordError('Enter your current password.');
    const issues = passwordIssues(passwords.next);
    if (issues.length) return setPasswordError(`Your new password needs ${issues.join(', ')}.`);
    if (passwords.next !== passwords.confirm) return setPasswordError('The new passwords do not match.');

    setPasswordSaving(true);
    try {
      const result = await api.post('/auth/change-password', {
        currentPassword: passwords.current,
        password: passwords.next,
      });
      // The password change invalidates old sessions; keep this tab signed in.
      if (result.token) setMemoryToken(result.token);
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated. Other sessions were signed out.');
    } catch (error) {
      setPasswordError(error.message || 'Unable to change the password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSettingsSaving(true);
    try {
      const result = await api.patch('/settings', {
        lowStockThreshold: Number(settings.lowStockThreshold),
        borrowPeriodDays: Number(settings.borrowPeriodDays),
      });
      setSettings(result.settings);
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message || 'Unable to save the settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const addReferenceOption = (field, maxLength) => {
    const value = referenceDrafts[field].trim();
    if (!value) {
      toast.error('Enter an option before adding it.');
      return;
    }
    if (referenceLists[field].length >= 50) {
      toast.error('A list can contain no more than 50 options.');
      return;
    }
    if (referenceLists[field].some((option) => option.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      toast.error('That option is already in the list.');
      return;
    }
    if (value.length > maxLength) {
      toast.error(`Options must be ${maxLength} characters or fewer.`);
      return;
    }
    setReferenceLists((current) => ({ ...current, [field]: [...current[field], value] }));
    setReferenceDrafts((current) => ({ ...current, [field]: '' }));
  };

  const saveReferenceLists = async () => {
    const normalized = {
      units: referenceLists.units.map((unit) => unit.trim()),
      conditions: referenceLists.conditions.map((condition) => condition.trim()),
    };
    if (Object.values(normalized).some((values) => !values.length || values.some((value) => !value))) {
      toast.error('Each list must contain at least one non-empty option.');
      return;
    }
    if (Object.values(normalized).some((values) => new Set(values.map((value) => value.toLocaleLowerCase())).size !== values.length)) {
      toast.error('Remove duplicate options before saving.');
      return;
    }

    setReferenceSaving(true);
    try {
      const result = await api.patch('/settings', normalized);
      setSettings(result.settings);
      setReferenceLists({ units: result.settings.units, conditions: result.settings.conditions });
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message || 'Unable to save the reference lists.');
    } finally {
      setReferenceSaving(false);
    }
  };

  const updateReferenceOption = (field, index, value) => {
    setReferenceLists((current) => ({
      ...current,
      [field]: current[field].map((option, optionIndex) => optionIndex === index ? value : option),
    }));
  };

  const removeReferenceOption = (field, index) => {
    if (referenceLists[field].length <= 1) {
      toast.error('Each list must keep at least one option.');
      return;
    }
    setReferenceLists((current) => ({
      ...current,
      [field]: current[field].filter((_, optionIndex) => optionIndex !== index),
    }));
  };

  const renderReferenceList = (field, label, placeholder, maxLength) => (
    <div className="field">
      <span className="field-label">{label}</span>
      {isAdmin ? (
        <>
          <div className="reference-option-grid">
            {referenceLists[field].map((option, index) => (
              <div className="reference-option" key={`${field}-${index}`}>
                <input
                  className="input"
                  value={option}
                  maxLength={maxLength}
                  aria-label={`${label} option ${index + 1}`}
                  onChange={(event) => updateReferenceOption(field, index, event.target.value)}
                  disabled={referenceSaving || !referenceListsLoaded}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm reference-option-remove"
                  aria-label={`Remove ${option || `${field} option ${index + 1}`}`}
                  title="Remove option"
                  onClick={() => removeReferenceOption(field, index)}
                  disabled={referenceSaving || !referenceListsLoaded || referenceLists[field].length <= 1}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="reference-add-row">
            <input
              className="input"
              value={referenceDrafts[field]}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-label={`New ${label.toLowerCase()} option`}
              onChange={(event) => setReferenceDrafts((current) => ({ ...current, [field]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addReferenceOption(field, maxLength);
                }
              }}
              disabled={referenceSaving || !referenceListsLoaded || referenceLists[field].length >= 50}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => addReferenceOption(field, maxLength)}
              disabled={referenceSaving || !referenceListsLoaded || referenceLists[field].length >= 50}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </>
      ) : (
        <div className="unit-chips">
          {referenceLists[field].map((option) => <span className="unit-chip" key={option}>{option}</span>)}
        </div>
      )}
    </div>
  );

  const referenceListsChanged = settings && (
    JSON.stringify(referenceLists.units) !== JSON.stringify(settings.units)
    || JSON.stringify(referenceLists.conditions) !== JSON.stringify(settings.conditions)
  );

  const applyThreshold = async () => {
    setApplying(true);
    try {
      const result = await api.post('/settings/apply-threshold');
      toast.success(result.message);
    } catch (error) {
      toast.error(error.message || 'Unable to apply the threshold.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? 'Manage your password, appearance, shared inventory options and inventory rules.'
            : 'Manage your password and appearance preferences.'
        }
      />

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {visibleTabs.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              type="button"
              key={entry.id}
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
            >
              <Icon size={13} style={{ marginRight: 6, verticalAlign: '-2px' }} />
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'password' && (
        <div className="settings-grid settings-password-grid">
          <SectionCard title="Change password" description="Use a strong password you do not use elsewhere" icon={KeyRound}>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <div className="field span-2">
                  <label htmlFor="current-password">Current password</label>
                  <div className="input-icon-wrap password-input-wrap">
                    <Lock size={14} />
                    <input
                      id="current-password"
                      type={showPw.current ? 'text' : 'password'}
                      className="input"
                      autoComplete="current-password"
                      value={passwords.current}
                      onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPw((current) => ({ ...current, current: !current.current }))}
                      aria-label={showPw.current ? 'Hide current password' : 'Show current password'}
                      aria-pressed={showPw.current}
                    >
                      {showPw.current ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <div className="pw-wrap">
                    <input
                      id="new-password"
                      type={showPw.next ? 'text' : 'password'}
                      className="input"
                      autoComplete="new-password"
                      value={passwords.next}
                      onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPw((current) => ({ ...current, next: !current.next }))}
                      aria-label={showPw.next ? 'Hide new password' : 'Show new password'}
                      aria-pressed={showPw.next}
                    >
                      {showPw.next ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordStrength value={passwords.next} />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <div className="pw-wrap">
                    <input
                      id="confirm-password"
                      type={showPw.confirm ? 'text' : 'password'}
                      className="input"
                      autoComplete="new-password"
                      value={passwords.confirm}
                      onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setShowPw((current) => ({ ...current, confirm: !current.confirm }))}
                      aria-label={showPw.confirm ? 'Hide confirm new password' : 'Show confirm new password'}
                      aria-pressed={showPw.confirm}
                    >
                      {showPw.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              {passwordError && (
                <div className="login-error" style={{ marginTop: 12 }}>
                  {passwordError}
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }} disabled={passwordSaving}>
                {passwordSaving ? <span className="spinner" /> : <KeyRound size={15} />} Update password
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Security" description="How this system protects your data" icon={Lock}>
            <div className="security-list">
              <div className="security-item">
                <CheckCircle2 size={14} /> Passwords are hashed with bcrypt — never stored in plain text.
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Sessions use signed, httpOnly, sameSite cookies.
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Every API request is checked against your role on the server.
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Inputs are validated and sanitized against NoSQL injection.
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Changing your password signs out every other session.
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="settings-grid">
          <SectionCard title="Appearance" description="Choose how the interface looks on this device" icon={Sun}>
            <div className="theme-options">
              <button
                type="button"
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                <span className="theme-preview light" /> <Sun size={14} /> Light
              </button>
              <button
                type="button"
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                <span className="theme-preview dark" /> <Moon size={14} /> Dark
              </button>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Your theme preference is stored on this device. Charts, tables, badges and dialogs adapt automatically.
            </p>
          </SectionCard>

          <SectionCard title="Units and conditions" description="Reference lists used by the inventory forms" icon={Tags}>
            {!referenceListsLoaded ? (
              <div className="loading-block"><span className="spinner" /> Loading preferences…</div>
            ) : (
              <>
                {renderReferenceList('units', 'Units of measurement', 'Add a unit', 20)}
                <div style={{ marginTop: 14 }}>
                  {renderReferenceList('conditions', 'Item conditions', 'Add a condition', 50)}
                </div>
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  {isAdmin
                    ? 'Changes are shared with all users and appear in inventory forms.'
                    : 'These shared options are managed by administrators and used in inventory forms.'}
                </p>
                {isAdmin && (
                  <div className="reference-settings-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={saveReferenceLists}
                      disabled={!referenceListsChanged || referenceSaving}
                    >
                      {referenceSaving ? <span className="spinner" /> : <Save size={14} />} Save lists
                    </button>
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'system' && isAdmin && (
        <div className="settings-grid">
          <SectionCard
            title="Inventory rules"
            description="System-wide defaults applied to new inventory items"
            icon={SlidersHorizontal}
          >
            {!settings ? (
              <div className="loading-block">
                <span className="spinner" /> Loading settings…
              </div>
            ) : (
              <form onSubmit={saveSettings}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="low-stock-threshold">Default low-stock threshold</label>
                    <input
                      id="low-stock-threshold"
                      type="number"
                      min={0}
                      step={1}
                      className="input"
                      value={settings.lowStockThreshold}
                      onChange={(event) => setSettings({ ...settings, lowStockThreshold: event.target.value })}
                    />
                    <span className="field-hint">
                      Used as the minimum stock level when a new item does not specify one.
                    </span>
                  </div>
                  <div className="field">
                    <label htmlFor="borrow-period">Default borrowing period (days)</label>
                    <input
                      id="borrow-period"
                      type="number"
                      min={1}
                      max={180}
                      step={1}
                      className="input"
                      value={settings.borrowPeriodDays}
                      onChange={(event) => setSettings({ ...settings, borrowPeriodDays: event.target.value })}
                    />
                    <span className="field-hint">Pre-fills the expected return date on the borrowing form.</span>
                  </div>
                </div>
                <div className="threshold-preview">
                  <SlidersHorizontal size={14} />
                  An item at or below{' '}
                  <strong style={{ color: 'var(--text)' }}>{formatNumber(settings.lowStockThreshold)}</strong> units is
                  reported as low stock.
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <button type="submit" className="btn btn-primary" disabled={settingsSaving}>
                    {settingsSaving ? <span className="spinner" /> : <Save size={15} />} Save rules
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={applyThreshold} disabled={applying}>
                    {applying ? <span className="spinner" /> : <Tags size={15} />} Apply threshold to all items
                  </button>
                </div>
                <p className="tiny muted" style={{ marginTop: 10 }}>
                  “Apply threshold to all items” sets the minimum stock level of every active item to the value above.
                  Item-specific levels can still be edited on the Inventory page.
                </p>
              </form>
            )}
          </SectionCard>

          <SectionCard title="Where to manage the rest" description="Everything else lives on its own page" icon={ShieldCheck}>
            <div className="security-list">
              <div className="security-item">
                <CheckCircle2 size={14} /> Product categories — Categories page (add, edit, delete when empty).
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Storage places — Storage Places page (administrators and inventory staff).
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Accounts, roles and deactivation — User Management page.
              </div>
              <div className="security-item">
                <CheckCircle2 size={14} /> Audit trail — Activity Logs page.
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </>
  );
}
