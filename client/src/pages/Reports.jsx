import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FilterX,
  PackageCheck,
  PackageX,
  Printer,
  Search,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, LoadingState, SectionCard, StatusBadge } from '../components/common';
import { BorrowStatusBadge, TransactionTypeBadge } from '../components/badges';
import { REPORT_TYPES } from '../utils/constants';
import { exportCSV, exportPDF, formatDate, formatDateTime, formatNumber, todayISO } from '../utils/format';

const TYPE_ICONS = {
  inventory: Boxes,
  available: PackageCheck,
  low: AlertTriangle,
  out: PackageX,
  'stock-in': ArrowDownToLine,
  'stock-out': ArrowUpFromLine,
  borrows: ClipboardList,
  transactions: ArrowLeftRight,
};

const SUMMARY_LABELS = {
  totalItems: 'Total items',
  totalQuantity: 'Total quantity',
  lowStock: 'Low stock',
  outOfStock: 'Out of stock',
  totalTransactions: 'Transactions',
  stockIn: 'Stock in',
  stockOut: 'Stock out',
  totalRecords: 'Records',
  active: 'Active',
  overdue: 'Overdue',
  returned: 'Returned',
};

const DATE_KEYS = new Set(['date', 'dateAdded', 'lastUpdated', 'dateBorrowed', 'expectedReturnDate', 'actualReturnDate']);

function renderCell(row, column) {
  const value = row[column.key];
  if (column.key === 'status') return <StatusBadge status={value} />;
  if (column.key === 'displayStatus') return <BorrowStatusBadge status={value} />;
  if (column.key === 'type') return <TransactionTypeBadge type={value} />;
  if (column.key === 'recordedBy') return value?.name || '—';
  if (column.key === 'quantity' || column.key === 'balanceAfter' || column.key === 'minimumStock') return formatNumber(value);
  if (DATE_KEYS.has(column.key)) return formatDate(value);
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [type, setType] = useState(searchParams.get('type') || 'inventory');
  const [filters, setFilters] = useState({ from: '', to: '', category: '', search: '' });
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/categories')
      .then((result) => setCategories(result.categories))
      .catch(() => setCategories([]));
  }, []);

  // /reports?type=low deep links from the dashboard.
  useEffect(() => {
    const wanted = searchParams.get('type');
    if (wanted) {
      setType(wanted);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/reports', { type, ...filters });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [type, filters]);

  useEffect(() => {
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const activeType = REPORT_TYPES.find((entry) => entry.value === type);
  const rows = data?.rows || [];
  const columns = data?.columns || [];
  const summary = data?.summary || {};

  const summaryItems = useMemo(
    () =>
      Object.entries(summary)
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => ({ label: SUMMARY_LABELS[key] || key, value: formatNumber(value) })),
    [summary]
  );

  const subtitle = useMemo(() => {
    const parts = [];
    if (filters.from || filters.to) {
      parts.push(
        `Period: ${filters.from ? formatDate(filters.from) : 'start'} – ${filters.to ? formatDate(filters.to) : 'today'}`
      );
    } else parts.push('All dates');
    if (filters.category) parts.push(`Category: ${filters.category}`);
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    return parts.join(' · ');
  }, [filters]);

  const fileBase = `inventory-${type}-${todayISO()}`;

  const handleExportCSV = () => {
    if (!rows.length) {
      toast.error('There are no records to export.');
      return;
    }
    exportCSV(`${fileBase}.csv`, columns, rows);
    toast.success('CSV report downloaded.');
  };

  const handleExportPDF = async () => {
    if (!rows.length) {
      toast.error('There are no records to export.');
      return;
    }
    try {
      await exportPDF({
        filename: `${fileBase}.pdf`,
        title: activeType?.label || 'Inventory report',
        subtitle: `${subtitle} · Generated ${formatDateTime(new Date())} by ${user?.name}`,
        columns,
        rows,
        summary: summaryItems,
      });
      toast.success('PDF report downloaded.');
    } catch {
      toast.error('Unable to generate the PDF. Please try again.');
    }
  };

  const handlePrint = () => {
    if (!rows.length) {
      toast.error('There are no records to print.');
      return;
    }
    window.print();
  };

  const hasFilters = Boolean(filters.search || filters.from || filters.to || filters.category);

  return (
    <div className="reports-page">
      {/* Sticky zone: title, actions, report type cards and the filter bar. */}
      <div className="reports-sticky no-print">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <div>
            <h1>Reports</h1>
            <p>Generate inventory and transaction reports, then print or export them for filing and review.</p>
          </div>
          <div className="page-head-actions">
            <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
              <FileSpreadsheet size={15} /> Export CSV
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleExportPDF}>
              <Download size={15} /> Export PDF
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        <SectionCard title="Report type" description="Choose the report you want to generate" icon={FileBarChart2}>
          <div className="report-types">
            {REPORT_TYPES.map((entry) => {
              const Icon = TYPE_ICONS[entry.value] || FileBarChart2;
              return (
                <button
                  type="button"
                  key={entry.value}
                  className={`report-type ${type === entry.value ? 'active' : ''}`}
                  aria-pressed={type === entry.value}
                  onClick={() => setType(entry.value)}
                >
                  <span className="rt-icon">
                    <Icon size={15} />
                  </span>
                  <span>
                    <b>{entry.label}</b>
                    <small>{entry.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="filters" style={{ borderBottom: 'none', padding: 0 }}>
            <div className="input-icon-wrap search">
              <Search size={15} />
              <input
                className="input"
                placeholder="Search item, borrower, reference…"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                aria-label="Search report"
              />
            </div>
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
              aria-label="Report from date"
            />
            <input
              type="date"
              className="input"
              style={{ width: 'auto' }}
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
              aria-label="Report to date"
            />
            <select
              className="select"
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value })}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setFilters({ from: '', to: '', category: '', search: '' })}
              >
                <FilterX size={14} /> Clear
              </button>
            )}
            <div className="spacer" />
            <span className="filter-count">{loading ? 'Generating…' : `${rows.length} record(s)`}</span>
          </div>
        </div>
      </div>

      {/* Only this area scrolls. */}
      <div className="reports-scroll">
        <SectionCard className="flush print-area">
          <div className="report-title">
            <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
              <div>
                <h2>{activeType?.label}</h2>
                <p>{subtitle}</p>
              </div>
              <span className="badge badge-neutral no-dot">Generated {formatDate(new Date())}</span>
            </div>
          </div>

          {summaryItems.length > 0 && (
            <div className="report-summary">
              {summaryItems.map((item) => (
                <div className="rs" key={item.label}>
                  <b>{item.value}</b>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <LoadingState label="Generating report…" rows={7} columns={6} />
          ) : !rows.length ? (
            <EmptyState
              icon={FileBarChart2}
              title="No records for this report"
              description="Try adjusting the date range, category or search filters. Reports reflect the records currently stored in MongoDB."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className={column.align === 'right' ? 'num' : ''}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id || `${row.reference || index}`}>
                      {columns.map((column) => (
                        <td key={column.key} className={column.align === 'right' ? 'num' : ''}>
                          {renderCell(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="report-meta">
            <span>
              Generated by <strong>{user?.name}</strong> ({user?.role}) on {formatDateTime(data?.generatedAt || new Date())}
            </span>
            <span>School Inventory Management System · Cavite State University</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
