import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  ChartLine,
  PackageCheck,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { ChartCard } from '../components/ChartCard';
import { formatDate, formatDateTime, formatNumber } from '../utils/format';
import { can } from '../utils/permissions';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const result = await api.get('/dashboard');
      setData(result);
    } catch {
      /* the empty states below cover failures */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const interval = setInterval(refreshWhenVisible, 30000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [load]);

  const stats = data?.stats;

  const movementData = useMemo(
    () =>
      (data?.movement || []).map((entry) => ({
        ...entry,
        label: new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      })),
    [data?.movement]
  );

  const categoryData = useMemo(
    () =>
      (data?.categories || []).map((category) => ({
        name: category.name,
        value: category.quantity,
        items: category.items,
      })),
    [data?.categories]
  );

  const lowItems = data?.lowStockItems || [];
  // Counts come from the aggregate stats, not from the truncated chip list.
  const lowCount = stats?.lowStockItems ?? 0;
  const outCount = stats?.outOfStockItems ?? 0;
  const recentTransactions = data?.recentTransactions || [];

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading the latest inventory information…" />
        <div className="grid grid-stats grid-stats-4" style={{ marginBottom: 14 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="stat-card" key={index}>
              <div className="skeleton" style={{ width: '55%', height: 10 }} />
              <div className="skeleton" style={{ width: '40%', height: 22, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div className="grid grid-main">
          <div className="card">
            <div className="skeleton" style={{ height: 240 }} />
          </div>
          <div className="card">
            <div className="skeleton" style={{ height: 240 }} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" description={`Inventory overview as of ${formatDate(new Date())}.`}>
        <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} />
          Refresh
        </button>
        {can(user?.role, 'transactions:create') && (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/transactions?edit=1')}>
            <ArrowLeftRight size={15} /> Edit stock
          </button>
        )}
      </PageHeader>

      {/* Four key figures only — everything else lives on its own page. */}
      <div className="grid grid-stats grid-stats-4" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="stat-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/inventory')}
        >
          <div className="stat-top">
            <div>
              <div className="stat-label">Total products</div>
              <div className="stat-value">{formatNumber(stats?.totalItems)}</div>
            </div>
            <div className="stat-icon">
              <Boxes size={17} strokeWidth={1.9} />
            </div>
          </div>
          <div className="stat-sub">{stats?.totalCategories || 0} categories · {formatNumber(stats?.inStockItems)} in stock</div>
        </button>

        <button
          type="button"
          className="stat-card accent"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/reports?type=available')}
        >
          <div className="stat-top">
            <div>
              <div className="stat-label">Available stock</div>
              <div className="stat-value">{formatNumber(stats?.totalAvailableStocks)}</div>
            </div>
            <div className="stat-icon">
              <PackageCheck size={17} strokeWidth={1.9} />
            </div>
          </div>
          <div className="stat-sub">Units across every active item</div>
        </button>

        <button
          type="button"
          className="stat-card warning"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/inventory?status=Low%20Stock')}
        >
          <div className="stat-top">
            <div>
              <div className="stat-label">Low-stock items</div>
              <div className="stat-value">{formatNumber(stats?.lowStockItems)}</div>
            </div>
            <div className="stat-icon">
              <AlertTriangle size={17} strokeWidth={1.9} />
            </div>
          </div>
          <div className="stat-sub">{formatNumber(stats?.outOfStockItems)} out of stock — needs replenishment</div>
        </button>

        <button
          type="button"
          className="stat-card"
          style={{ textAlign: 'left', cursor: 'pointer' }}
          onClick={() => navigate('/transactions')}
        >
          <div className="stat-top">
            <div>
              <div className="stat-label">Transactions this month</div>
              <div className="stat-value">{formatNumber(stats?.transactionsThisMonth)}</div>
            </div>
            <div className="stat-icon">
              <ArrowLeftRight size={17} strokeWidth={1.9} />
            </div>
          </div>
          <div className="stat-sub">
            {formatNumber(stats?.stockInThisMonth)} in · {formatNumber(stats?.stockOutThisMonth)} out
          </div>
        </button>
      </div>

      {/* Low-stock notifications are a project requirement — surface them first. */}
      <section className="low-stock-panel" style={{ marginBottom: 14 }}>
        <div className="low-stock-head">
          <h2>
            <AlertTriangle size={15} />
            Low-stock and out-of-stock alerts
          </h2>
          <div className="row ls-chips" style={{ gap: 8 }}>
            <span className="badge badge-danger no-dot">{outCount} out of stock</span>
            <span className="badge badge-warning no-dot">{lowCount} low stock</span>
            <button type="button" className="btn-text" onClick={() => navigate('/inventory?status=Low%20Stock')}>
              View inventory
            </button>
          </div>
        </div>
        {lowItems.length ? (
          <div className="low-stock-grid">
            {lowItems.slice(0, 8).map((item) => (
              <button
                type="button"
                className="low-stock-chip"
                key={item.id}
                onClick={() => navigate(`/inventory?search=${encodeURIComponent(item.name)}`)}
                title={`${item.name} — minimum ${item.minimumStock} ${item.unit}`}
              >
                <span className="ls-body">
                  <b>{item.name}</b>
                  <small>
                    {item.itemCode} · min {formatNumber(item.minimumStock)} {item.unit}
                  </small>
                </span>
                <span className="ls-right">
                  <span className="ls-qty">
                    {formatNumber(item.quantity)} {item.unit}
                  </span>
                  <StatusBadge status={item.status} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="small" style={{ color: 'var(--warning)' }}>
            Every active item is above its minimum stock level.
          </p>
        )}
      </section>

      <div className="grid grid-main" style={{ marginBottom: 14 }}>
        <ChartCard
          chartId="dashboard-stock-movement"
          title="Stock movement"
          description="Recorded stock movements over the last 7 days"
          icon={TrendingUp}
          data={movementData}
          nameKey="label"
          series={[
            { key: 'stockIn', label: 'Stock in' },
            { key: 'stockOut', label: 'Stock out' },
            { key: 'borrowed', label: 'Borrowed' },
            { key: 'returned', label: 'Returned' },
            { key: 'adjustment', label: 'Adjustment' },
          ]}
          defaultType="bar"
        />
        <ChartCard
          chartId="dashboard-categories"
          title="Stock by category"
          description="Available units per category"
          icon={Boxes}
          data={categoryData}
          defaultType="donut"
        />
      </div>

      <div className="grid grid-main">
        <SectionCard
          title="Recent transactions"
          description="Latest stock movements across all items"
          icon={ArrowLeftRight}
          actions={
            <button type="button" className="btn-text" onClick={() => navigate('/transactions')}>
              View all
            </button>
          }
          className="flush dashboard-recent-card"
        >
          <div className="table-wrap">
            <table className="data dashboard-recent-table">
              <colgroup>
                <col className="recent-date-col" />
                <col className="recent-item-col" />
                <col className="recent-type-col" />
                <col className="recent-quantity-col" />
                <col className="recent-balance-col" />
                <col className="recent-recorder-col" />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th className="num">Balance</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="nowrap">{formatDate(txn.date)}</td>
                    <td>
                      <div className="cell-main">{txn.itemName}</div>
                      <div className="cell-sub">{txn.itemCode}</div>
                    </td>
                    <td>
                      <TransactionTypeBadge type={txn.type} />
                    </td>
                    <td className="num">
                      <strong>
                        {txn.type === 'Stock Out' || txn.type === 'Borrowed' ? '−' : txn.type === 'Adjustment' ? '±' : '+'}
                        {formatNumber(txn.quantity)}
                      </strong>
                    </td>
                    <td className="num">{formatNumber(txn.balanceAfter)}</td>
                    <td><div className="cell-main recent-recorder">{txn.recordedBy?.name || '—'}</div></td>
                  </tr>
                ))}
                {!recentTransactions.length && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No transactions yet" description="Stock movements will appear here once they are recorded." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Stock this month"
          description="Totals recorded since the 1st"
          icon={ChartLine}
        >
          <div className="alert-list">
            <div className="alert-row">
              <span className="notif-icon warn" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                <PackageCheck size={14} />
              </span>
              <div className="alert-main">
                <b>Stock in</b>
                <small>New units received</small>
              </div>
              <span className="strong" style={{ color: 'var(--success)' }}>
                +{formatNumber(stats?.stockInThisMonth)}
              </span>
            </div>
            <div className="alert-row">
              <span className="notif-icon warn">
                <ArrowLeftRight size={14} />
              </span>
              <div className="alert-main">
                <b>Stock out</b>
                <small>Units released or consumed</small>
              </div>
              <span className="strong" style={{ color: 'var(--warning)' }}>
                −{formatNumber(stats?.stockOutThisMonth)}
              </span>
            </div>
            <div className="alert-row">
              <span className="notif-icon info">
                <ArrowLeftRight size={14} />
              </span>
              <div className="alert-main">
                <b>Borrowed</b>
                <small>{formatNumber(stats?.activeBorrowRecords)} active borrow record(s)</small>
              </div>
              <span className="strong">{formatNumber(stats?.borrowedThisMonth)}</span>
            </div>
            <div className="alert-row">
              <span className="notif-icon info" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                <PackageCheck size={14} />
              </span>
              <div className="alert-main">
                <b>Returned</b>
                <small>{formatNumber(stats?.overdueBorrows)} overdue return(s)</small>
              </div>
              <span className="strong">{formatNumber(stats?.returnedThisMonth)}</span>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/borrowing')}>
              Borrowing &amp; returns
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')}>
              Open reports
            </button>
          </div>
        </SectionCard>
      </div>

      <p className="tiny muted" style={{ marginTop: 16 }}>
        Data refreshed from MongoDB at {formatDateTime(data?.generatedAt || new Date())}. Figures update automatically
        after every recorded transaction.
      </p>
    </>
  );
}
