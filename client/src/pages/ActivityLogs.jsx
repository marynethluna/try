import { useEffect, useRef, useState } from 'react';
import { Download, FileClock, FilterX, History, Search } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, Pagination, SectionCard, RoleBadge } from '../components/common';
import { exportCSV, formatDate, formatDateTime, relativeTime } from '../utils/format';

const LIMIT = 20;

const ACTIVITY_GROUPS = [
  { id: 'authentication', label: 'Authentication' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'borrowing', label: 'Borrowing' },
  { id: 'account-management', label: 'Account Management' },
  { id: 'system-settings', label: 'System Settings' },
  { id: 'other', label: 'Other Activities' },
];

export default function ActivityLogs() {
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', from: '', to: '', actionGroup: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequest = useRef(0);

  useEffect(() => {
    const requestId = ++latestRequest.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.get('/activity-logs', { ...filters, page, limit: LIMIT });
        if (requestId !== latestRequest.current) return;
        setData(result);
      } catch {
        if (requestId === latestRequest.current) setData(null);
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      latestRequest.current += 1;
    };
  }, [filters, page, reloadKey]);

  const logs = data?.logs || [];

  const handleExport = () => {
    if (!logs.length) {
      toast.error('There are no log entries to export.');
      return;
    }
    exportCSV(
      `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'createdAt', label: 'Date and time' },
        { key: 'actorName', label: 'User' },
        { key: 'actorUsername', label: 'Username' },
        { key: 'actorRole', label: 'Role' },
        { key: 'action', label: 'Action' },
        { key: 'entityType', label: 'Record type' },
        { key: 'entityLabel', label: 'Affected record' },
        { key: 'details', label: 'Details' },
      ],
      logs
    );
    toast.success('Activity log exported.');
  };

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="A complete audit trail of important inventory, account and administrative actions."
      >
        <button type="button" className="btn btn-secondary" onClick={handleExport}>
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>

      <div className="grid grid-stats grid-stats-2" style={{ marginBottom: 14 }}>
        <StatCard label="Total Log Entries" value={data?.total || 0} icon={History} tone="dark" sub="All recorded activities" />
        <StatCard label="Latest Activity" value={logs[0] ? relativeTime(logs[0].createdAt) : '—'} icon={FileClock} tone="accent" sub={logs[0]?.action || 'No activity yet'} />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input className="input" placeholder="Search action, user, record or details…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value, actionGroup: '' }); setPage(1); }} aria-label="Search activity logs" />
          </div>
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} aria-label="From date" />
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} aria-label="To date" />
          {(filters.search || filters.from || filters.to || filters.actionGroup) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ search: '', from: '', to: '', actionGroup: '' }); setPage(1); }}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} entries`}</span>
        </div>

        <div className="activity-filter-groups">
          <div className="activity-filter-categories" role="group" aria-label="Filter activity logs by category">
            {ACTIVITY_GROUPS.map((group) => {
              const active = filters.actionGroup === group.id;
              return (
                <button
                  type="button"
                  className={`activity-filter-category ${active ? 'active' : ''}`}
                  key={group.id}
                  aria-pressed={active}
                  onClick={() => {
                    setFilters({ ...filters, search: '', actionGroup: group.id });
                    setPage(1);
                  }}
                >
                  <span>{group.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading activity logs…" rows={7} columns={5} />
        ) : !logs.length ? (
          <EmptyState icon={History} title="No activity recorded" description="Important actions such as stock movements, account changes and category updates will appear here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date and time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Affected record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap">
                        <div className="small">{formatDateTime(log.createdAt)}</div>
                        <div className="cell-sub">{relativeTime(log.createdAt)}</div>
                      </td>
                      <td>
                        <div className="cell-main">{log.actorName}</div>
                        <div className="cell-sub">@{log.actorUsername}</div>
                        {log.actorRole && <div style={{ marginTop: 3 }}><RoleBadge role={log.actorRole} /></div>}
                      </td>
                      <td><span className="badge badge-orange no-dot">{log.action}</span></td>
                      <td>
                        <div className="small">{log.entityLabel || log.entityType || '—'}</div>
                        {log.entityType && <div className="cell-sub">{log.entityType}</div>}
                      </td>
                      <td>
                        <div className="small muted" style={{ maxWidth: 360 }}>{log.details || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="log entries" />
          </>
        )}
      </SectionCard>

      <p className="tiny muted" style={{ marginTop: 12 }}>
        Logs are stored in MongoDB and cannot be edited or deleted from the application. The latest entry on this page was recorded on {logs[0] ? formatDate(logs[0].createdAt) : '—'}.
      </p>
    </>
  );
}
