import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Wrench } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import { ItemSelect } from './ItemSelect';
import { formatNumber, todayISO } from '../utils/format';

export const STOCK_ACTIONS = [
  { value: 'Stock In', label: 'Stock In', hint: 'Receive new units into the inventory.', icon: ArrowDownToLine },
  { value: 'Stock Out', label: 'Stock Out', hint: 'Release or consume units already in stock.', icon: ArrowUpFromLine },
  {
    value: 'Adjustment',
    label: 'Adjustment',
    hint: 'Correct the counted quantity after a physical count (administrators only).',
    icon: Wrench,
  },
];

/**
 * Single stock-editing modal. Replaces the separate "Stock In" and "Stock Out"
 * buttons: the user picks the action, the item, the quantity and notes.
 * Client-side validation mirrors the server rules (positive integers, no
 * stock-out beyond the available quantity, reason required for out/adjustment).
 */
export function EditStockModal({ open, onClose, items = [], initialAction = 'Stock In', initialItemId = '', onSaved }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';

  const [action, setAction] = useState(initialAction);
  const [form, setForm] = useState({ itemId: '', quantity: 1, date: todayISO(), supplier: '', reason: '', remarks: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAction(isAdmin || initialAction !== 'Adjustment' ? initialAction : 'Stock In');
    setForm({
      itemId: initialItemId || items[0]?.id || '',
      quantity: 1,
      date: todayISO(),
      supplier: '',
      reason: '',
      remarks: '',
    });
    setErrors({});
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAction, initialItemId]);

  const selectedItem = useMemo(() => items.find((item) => item.id === form.itemId), [items, form.itemId]);

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const next = {};
    const quantity = Number(form.quantity);

    if (!form.itemId) next.itemId = 'Select an inventory item.';
    if (action === 'Adjustment') {
      if (!Number.isInteger(quantity) || quantity < 0) next.quantity = 'Enter a counted quantity of 0 or more.';
      else if (selectedItem && quantity === selectedItem.quantity) {
        next.quantity = 'This matches the current stock. No adjustment is needed.';
      }
    } else if (!Number.isInteger(quantity) || quantity < 1) {
      next.quantity = 'Quantity must be a whole number of at least 1.';
    } else if (action === 'Stock Out' && selectedItem && quantity > selectedItem.quantity) {
      next.quantity = `Only ${formatNumber(selectedItem.quantity)} ${selectedItem.unit} available.`;
    }
    if (action === 'Stock Out' && !form.reason.trim()) next.reason = 'Provide a reason for releasing the stock.';
    if (action === 'Adjustment' && !form.reason.trim()) next.reason = 'Provide a reason for the adjustment.';
    if (!form.date) next.date = 'Choose a transaction date.';

    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const result = await api.post('/transactions', {
        type: action,
        itemId: form.itemId,
        quantity,
        date: form.date,
        supplier: action === 'Stock In' ? form.supplier : '',
        reason: action === 'Stock In' ? '' : form.reason,
        remarks: form.remarks,
      });
      onSaved(result.message || 'Stock updated.');
      onClose();
    } catch (error) {
      setServerError(error.message || 'Unable to save the stock change.');
      if (error.details) {
        const fieldMap = {};
        error.details.forEach((detail) => {
          fieldMap[detail.field] = detail.message;
        });
        setErrors(fieldMap);
      }
    } finally {
      setSaving(false);
    }
  };

  const preview = useMemo(() => {
    if (!selectedItem) return null;
    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) return null;
    if (action === 'Stock In') return selectedItem.quantity + quantity;
    if (action === 'Stock Out') return Math.max(0, selectedItem.quantity - quantity);
    return quantity;
  }, [action, form.quantity, selectedItem]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit stock"
      description="Pick the action, then confirm the item and quantity. Every change is written to the transaction history."
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="edit-stock-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} Save stock change
          </button>
        </>
      }
    >
      <form id="edit-stock-form" onSubmit={submit} noValidate>
        <div className="field" style={{ marginBottom: 14 }}>
          <span className="field-label">Action</span>
          <div className="action-picker" role="radiogroup" aria-label="Stock action">
            {STOCK_ACTIONS.map((entry) => {
              const Icon = entry.icon;
              const disabled = entry.value === 'Adjustment' && !isAdmin;
              return (
                <button
                  type="button"
                  key={entry.value}
                  role="radio"
                  aria-checked={action === entry.value}
                  className={`action-option ${action === entry.value ? 'active' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    setAction(entry.value);
                    setErrors({});
                  }}
                  title={disabled ? 'Only administrators can adjust stock' : entry.hint}
                >
                  <Icon size={15} />
                  <span>
                    <b>{entry.label}</b>
                    <small>{entry.hint}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="stock-item">
              Inventory item <span className="req">*</span>
            </label>
            <ItemSelect
              id="stock-item"
              items={items}
              value={form.itemId}
              invalid={Boolean(errors.itemId)}
              onChange={(itemId) => setForm({ ...form, itemId })}
            />
            {errors.itemId && <span className="field-error">{errors.itemId}</span>}
            {selectedItem && (
              <span className="field-hint">
                Current stock: <strong>{formatNumber(selectedItem.quantity)} {selectedItem.unit}</strong> · Minimum level{' '}
                {formatNumber(selectedItem.minimumStock)} · {selectedItem.category}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="stock-quantity">
              {action === 'Adjustment' ? 'Counted quantity' : 'Quantity'} <span className="req">*</span>
            </label>
            <input
              id="stock-quantity"
              type="number"
              min={action === 'Adjustment' ? 0 : 1}
              step={1}
              className={`input ${errors.quantity ? 'invalid' : ''}`}
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            />
            {errors.quantity ? (
              <span className="field-error">{errors.quantity}</span>
            ) : (
              <span className="field-hint">
                {action === 'Adjustment' ? 'The stock level is set to this counted value.' : 'Whole units only.'}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="stock-date">Transaction date</label>
            <input
              id="stock-date"
              type="date"
              className={`input ${errors.date ? 'invalid' : ''}`}
              value={form.date}
              max={todayISO()}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </div>

          {action === 'Stock In' && (
            <div className="field span-2">
              <label htmlFor="stock-supplier">Supplier / source</label>
              <input
                id="stock-supplier"
                className="input"
                value={form.supplier}
                onChange={(event) => setForm({ ...form, supplier: event.target.value })}
                placeholder="e.g. Metro Manila IT Supplies"
                maxLength={120}
              />
            </div>
          )}

          {action !== 'Stock In' && (
            <div className="field span-2">
              <label htmlFor="stock-reason">
                {action === 'Adjustment' ? 'Reason for adjustment' : 'Reason for releasing'} <span className="req">*</span>
              </label>
              <input
                id="stock-reason"
                className={`input ${errors.reason ? 'invalid' : ''}`}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder={action === 'Adjustment' ? 'e.g. Physical count correction' : 'e.g. Issued to Computer Laboratory 1'}
                maxLength={160}
              />
              {errors.reason && <span className="field-error">{errors.reason}</span>}
            </div>
          )}

          <div className="field span-2">
            <label htmlFor="stock-remarks">Notes</label>
            <textarea
              id="stock-remarks"
              className="textarea"
              rows={2}
              value={form.remarks}
              onChange={(event) => setForm({ ...form, remarks: event.target.value })}
              placeholder="Optional notes about this stock change"
              maxLength={300}
            />
          </div>
        </div>

        {selectedItem && preview !== null && (
          <div className="stock-preview" aria-live="polite">
            <span>
              {selectedItem.name}: <strong>{formatNumber(selectedItem.quantity)}</strong> {selectedItem.unit}
            </span>
            <span aria-hidden="true">→</span>
            <strong>{formatNumber(preview)} {selectedItem.unit}</strong>
            {action === 'Stock Out' && Number(form.quantity) > selectedItem.quantity && (
              <span className="text-danger">insufficient stock</span>
            )}
          </div>
        )}

        {action === 'Adjustment' && (
          <div className="login-note" style={{ marginTop: 12 }}>
            <Wrench size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Adjustments are restricted to administrators and are recorded in the transaction history.</span>
          </div>
        )}

        {serverError && <div className="login-error" style={{ marginTop: 12 }}>{serverError}</div>}
      </form>
    </Modal>
  );
}

export default EditStockModal;
