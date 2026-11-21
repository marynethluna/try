import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CalendarRange,
  FilterX,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState, PageHeader, Pagination, SectionCard } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { EditStockModal } from '../components/EditStockModal';
import { formatDate, formatNumber } from '../utils/format';
import { can } from '../utils/permissions';

const LIMIT = 12;

/** The four highlighted, clickable summary filters (plus "All"). */
const SUMMARY_FILTERS = [
  { key: 'Stock In', type: 'Stock In', label: 'Stock In', icon: ArrowDownToLine, tone: 'success' },
  { key: 'Stock Out', type: 'Stock Out', label: 'Stock Out', icon: ArrowUpFromLine, tone: 'warning' },
  { key: 'Borrowed', type: 'Borrowed', label: 'Borrowed', icon: ArrowLeftRight, tone: 'info' },
  { key: 'Returned', type: 'Returned', label: 'Returned', icon: ArrowLeftRight, tone: 'default' },
];

export default function Transactions() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [typeFilter, setTypeFilter] = useState('All');
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialAction, setInitialAction] = useState('Stock In');
  const [reloadKey, setReloadKey] = useState(0);

  const canEditStock = can(user?.role, 'transactions:create');

  // Deep links: /transactions?edit=1 opens the modal, ?type=Stock%20In pre-filters.
  useEffect(() => {
    const wantsEdit = searchParams.get('edit');
    const wantedType = searchParams.get('type');
    if (wantsEdit && canEditStock) {
      setInitialAction(searchParams.get('action') || 'Stock In');
      setModalOpen(true);
    }
    if (wantedType) setTypeFilter(wantedType);
    if (wantsEdit || wantedType) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canEditStock]);

  useEffect(() => {
    api
      .get('/items', { limit: 100, sort: 'name' })
      .then((result) => setItems(result.items))
      .catch(() => setItems([]));
  }, [reloadKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/transactions', {
        type: typeFilter === 'All' ? '' : typeFilter,
        search: filters.search,
        from: filters.from,
        to: filters.to,
        page,
        limit: LIMIT,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const summary = data?.summary || {};
  const refresh = () => setReloadKey((key) => key + 1);

  const applyFilter = (nextType) => {
    setTypeFilter(nextType);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', from: '', to: '' });
    setTypeFilter('All');
    setPage(1);
  };

  const hasFilters = Boolean(filters.search || filters.from || filters.to || typeFilter !== 'All');

  return (
    <>
      <PageHeader
        title="Stock Transactions"
        description="Every quantity change is recorded here. Available stock updates automatically and each movement is logged."
      >
        {canEditStock && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setInitialAction('Stock In');
              setModalOpen(true);
            }}
          >
            <Plus size={15} /> Edit stock
          </button>
        )}
      </PageHeader>

      {/* Clickable summary cards act as the primary type filters. */}
      <div className="grid grid-stats grid-stats-4" style={{ marginBottom: 14 }}>
        {SUMMARY_FILTERS.map((entry) => {
          const Icon = entry.icon;
          const active = typeFilter === entry.type;
          const stat = summary[entry.key] || {};
          return (
            <button
              type="button"
              key={entry.key}
              className="filter-stat"
              aria-pressed={active}
              aria-label={`Filter by ${entry.label}`}
              onClick={() => applyFilter(active ? 'All' : entry.type)}
            >
              <div className="stat-top">
                <div>
                  <div className="stat-label-row">
                    <div className="stat-label">{entry.label}</div>
                    {active && <span className="fs-flag">Filtering</span>}
                  </div>
                  <div className="stat-value">{formatNumber(stat.quantity)}</div>
                </div>
                <div className="stat-icon">
                  <Icon size={17} strokeWidth={1.9} />
                </div>
              </div>
              <div className="stat-sub">{stat.count || 0} transaction(s)</div>
            </button>
          );
        })}
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input
              className="input"
              placeholder="Search reference, item, supplier or person…"
              value={filters.search}
              onChange={(event) => {
                setFilters({ ...filters, search: event.target.value });
                setPage(1);
              }}
              aria-label="Search transactions"
            />
          </div>
          <div style={{ position: 'relative', minWidth: 150 }}>
            <CalendarRange
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }}
            />
            <input
              type="date"
              className="input"
              style={{ paddingLeft: 30 }}
              value={filters.from}
              onChange={(event) => {
                setFilters({ ...filters, from: event.target.value });
                setPage(1);
              }}
              aria-label="From date"
            />
          </div>
          <div style={{ position: 'relative', minWidth: 150 }}>
            <CalendarRange
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }}
            />
            <input
              type="date"
              className="input"
              style={{ paddingLeft: 30 }}
              value={filters.to}
              onChange={(event) => {
                setFilters({ ...filters, to: event.target.value });
                setPage(1);
              }}
              aria-label="To date"
            />
          </div>
          {hasFilters && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} transaction(s)`}</span>
        </div>

        {/* Only "All" and "Adjustment" remain as secondary pills. */}
        <div className="chip-row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <button type="button" className={`chip ${typeFilter === 'All' ? 'active' : ''}`} onClick={() => applyFilter('All')}>
            All transactions
          </button>
          <button
            type="button"
            className={`chip ${typeFilter === 'Adjustment' ? 'active' : ''}`}
            onClick={() => applyFilter('Adjustment')}
          >
            Adjustment
          </button>
        </div>

        {loading ? (
          <LoadingState label="Loading stock transactions…" rows={6} columns={6} />
        ) : !data?.transactions?.length ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No transactions found"
            description={
              hasFilters
                ? 'No records match the current filters. Try a different type, date range or search term.'
                : 'Stock movements appear here as soon as inventory staff record stock in, stock out or borrowing activity.'
            }
            action={
              canEditStock ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setInitialAction('Stock In');
                    setModalOpen(true);
                  }}
                >
                  <Plus size={14} /> Record a stock change
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Balance</th>
                    <th>Supplier / reason</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td className="nowrap">{formatDate(txn.date)}</td>
                      <td className="mono tiny">{txn.reference}</td>
                      <td>
                        <TransactionTypeBadge type={txn.type} />
                      </td>
                      <td>
                        <div className="cell-main">{txn.itemName}</div>
                        <div className="cell-sub mono">{txn.itemCode}</div>
                      </td>
                      <td className="num">
                        <strong
                          style={{
                            color:
                              txn.type === 'Stock In' || txn.type === 'Returned'
                                ? 'var(--success)'
                                : txn.type === 'Adjustment'
                                  ? 'var(--muted)'
                                  : 'var(--warning)',
                          }}
                        >
                          {txn.type === 'Stock In' || txn.type === 'Returned'
                            ? '+'
                            : txn.type === 'Adjustment'
                              ? '±'
                              : '−'}
                          {formatNumber(txn.quantity)}
                        </strong>
                      </td>
                      <td className="num">{formatNumber(txn.balanceAfter)}</td>
                      <td>
                        <div className="small">{txn.supplier || txn.reason || '—'}</div>
                        {txn.remarks && <div className="cell-sub">{txn.remarks}</div>}
                      </td>
                      <td>
                        <div className="small">{txn.recordedBy?.name || '—'}</div>
                        <div className="cell-sub">@{txn.recordedBy?.username || 'system'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="transactions" />
          </>
        )}
      </SectionCard>

      {/* Viewers never see the control; the API also rejects them with 403. */}
      {canEditStock && (
        <EditStockModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          items={items}
          initialAction={initialAction}
          onSaved={(message) => {
            toast.success(message);
            refresh();
          }}
        />
      )}
    </>
  );
}
