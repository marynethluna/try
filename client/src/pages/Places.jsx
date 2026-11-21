import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, MapPin, Package, Pencil, Plus, Search, Trash2, Warehouse } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, SectionCard } from '../components/common';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatNumber } from '../utils/format';
import { can } from '../utils/permissions';

/** Suggested groupings — staff can type any value, these just keep lists tidy. */
const AREA_SUGGESTIONS = ['Laboratories', 'Storage', 'Facilities', 'Offices', 'Other'];

function PlaceModal({ open, onClose, place, onSaved }) {
  const [form, setForm] = useState({ name: '', area: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: place?.name || '', area: place?.area || '', description: place?.description || '' });
    setError('');
  }, [open, place]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const name = form.name.trim();
    if (name.length < 2) {
      setError('Place name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name, area: form.area.trim(), description: form.description.trim() };
      if (place) await api.patch(`/places/${place.id}`, payload);
      else await api.post('/places', payload);
      onSaved(place ? 'Place updated.' : 'Place created.', place ? 'updated' : 'created');
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to save the place.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={place ? 'Edit storage place' : 'Add storage place'}
      description="Places are the physical locations where inventory is stored. They appear on the item form and in filters."
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="place-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} {place ? 'Save changes' : 'Create place'}
          </button>
        </>
      }
    >
      <form id="place-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="place-name">
            Place name <span className="req">*</span>
          </label>
          <input
            id="place-name"
            className="input"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="e.g. Computer Laboratory 3"
            maxLength={80}
            autoFocus
          />
          {place && (
            <span className="field-hint">
              Renaming a place also updates every inventory item currently stored there.
            </span>
          )}
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="place-area">Area</label>
          <input
            id="place-area"
            className="input"
            list="place-area-options"
            value={form.area}
            onChange={(event) => setForm({ ...form, area: event.target.value })}
            placeholder="e.g. Laboratories"
            maxLength={60}
          />
          <datalist id="place-area-options">
            {AREA_SUGGESTIONS.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="place-description">Description</label>
          <textarea
            id="place-description"
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="What is kept here?"
            maxLength={240}
          />
        </div>
        {error && (
          <div className="login-error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Places() {
  const { user } = useAuth();
  const toast = useToast();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canManage = can(user?.role, 'places:manage');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/places');
      setPlaces(result.places);
    } catch {
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const areas = useMemo(() => [...new Set(places.map((place) => place.area).filter(Boolean))].sort(), [places]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => {
      if (areaFilter !== 'all' && place.area !== areaFilter) return false;
      if (!needle) return true;
      return `${place.name} ${place.area} ${place.description}`.toLowerCase().includes(needle);
    });
  }, [places, query, areaFilter]);

  const totalItems = places.reduce((sum, place) => sum + place.itemCount, 0);
  const totalQuantity = places.reduce((sum, place) => sum + place.totalQuantity, 0);
  const unused = places.filter((place) => place.itemCount === 0).length;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/places/${deleteTarget.id}`);
      toast.success(`Place "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(error.message || 'Unable to delete the place.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Storage Places"
        description="Locations and storage areas where inventory is kept. These feed the location picker on items and the filters in inventory and reports."
      >
        {canManage && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus size={15} /> Add place
          </button>
        )}
      </PageHeader>

      <div className="grid grid-stats grid-stats-4" style={{ marginBottom: 14 }}>
        <StatCard label="Total Places" value={formatNumber(places.length)} icon={MapPin} tone="dark" sub={`${areas.length} area${areas.length === 1 ? '' : 's'}`} />
        <StatCard label="Items Stored" value={formatNumber(totalItems)} icon={Boxes} sub="Across all places" />
        <StatCard label="Total Quantity" value={formatNumber(totalQuantity)} icon={Package} tone="accent" sub="Units on hand" />
        <StatCard label="Empty Places" value={formatNumber(unused)} icon={Warehouse} sub="No items assigned" />
      </div>

      <div className="filters places-filters">
        <div className="input-icon-wrap search">
          <Search size={15} />
          <input
            className="input"
            placeholder="Search storage places…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search places"
          />
        </div>
        {areas.length > 0 && (
          <select className="select" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)} aria-label="Filter by area">
            <option value="all">All areas</option>
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        )}
        <span className="filter-count">
          {visible.length} of {places.length} place(s)
        </span>
      </div>

      <SectionCard className="places-card" bodyClassName="places-body">
        {loading ? (
          <LoadingState label="Loading places…" rows={4} columns={3} />
        ) : !places.length ? (
          <EmptyState
            icon={MapPin}
            title="No storage places yet"
            description="Add the laboratories, stockrooms and offices where inventory is kept so items can be assigned to a place."
            action={
              canManage ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <Plus size={14} /> Add place
                </button>
              ) : null
            }
          />
        ) : !visible.length ? (
          <EmptyState icon={Search} title="No places match your filters" description="Try a different search term or area." />
        ) : (
          <div className="grid grid-3">
            {visible.map((place) => (
              <div className="cat-card" key={place.id}>
                <div className="cat-card-head">
                  <div className="cat-icon">
                    <MapPin size={17} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{place.name}</h3>
                    <p>{place.description || place.area || 'No description provided.'}</p>
                  </div>
                </div>
                <div className="cat-metrics">
                  <div className="cat-metric">
                    <b>{formatNumber(place.itemCount)}</b>
                    <span>Items</span>
                  </div>
                  <div className="cat-metric">
                    <b>{formatNumber(place.totalQuantity)}</b>
                    <span>Total qty</span>
                  </div>
                  {place.area && (
                    <div className="cat-metric">
                      <b style={{ fontSize: 13 }}>{place.area}</b>
                      <span>Area</span>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="cat-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditing(place);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setDeleteTarget(place)}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <PlaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        place={editing}
        onSaved={(message) => {
          toast.success(message);
          load();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete storage place"
        message={`Delete the place "${deleteTarget?.name}"? This is only possible when no inventory items are stored there.`}
        confirmLabel="Delete place"
        loading={deleteLoading}
      />
    </>
  );
}
