import React, { useEffect, useState } from 'react';
import { Warehouse, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { Plus, Search, Building2, Edit2, Power, X } from 'lucide-react';
import './WarehousesPage.scss';

export const WarehousesPage: React.FC = () => {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '' });
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.MANAGER;

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryApi.getWarehouses({ search: search || undefined });
      if (res.success && res.data) {
        setWarehouses(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadWarehouses();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleOpenCreate = () => {
    setEditingWh(null);
    setFormData({ code: '', name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (wh: Warehouse) => {
    setEditingWh(wh);
    setFormData({ code: wh.code, name: wh.name });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      if (editingWh) {
        await inventoryApi.updateWarehouse(editingWh.id, {
          name: formData.name,
          code: formData.code,
        });
      } else {
        await inventoryApi.createWarehouse({
          code: formData.code,
          name: formData.name,
        });
      }
      setIsModalOpen(false);
      loadWarehouses();
    } catch (err: any) {
      setError(err.message || 'Failed to save warehouse');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (wh: Warehouse) => {
    const action = wh.isActive ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} warehouse '${wh.name}' (${wh.code})?`)) {
      return;
    }

    try {
      setError(null);
      await inventoryApi.updateWarehouseStatus(wh.id, !wh.isActive);
      loadWarehouses();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} warehouse`);
    }
  };

  return (
    <div className="warehouses-page">
      <div className="page-header">
        <div className="title-group">
          <h1>Warehouse Network</h1>
          <p>Manage physical storage locations, distribution facilities, and balance thresholds.</p>
        </div>
        {canManage && (
          <button className="btn-create" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>New Warehouse</span>
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by warehouse code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="loading-state">Loading facilities...</p>
      ) : warehouses.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} />
          <p>No warehouses found. Click "New Warehouse" to add one.</p>
        </div>
      ) : (
        <div className="warehouses-grid">
          {warehouses.map((wh) => (
            <div key={wh.id} className="warehouse-card">
              <div>
                <div className="card-top">
                  <span className="badge-code">{wh.code}</span>
                  <span className={`status-pill ${wh.isActive ? 'active' : 'inactive'}`}>
                    <span className="dot" />
                    {wh.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="wh-info">
                  <h3>{wh.name}</h3>
                  <div className="wh-meta">
                    <div className="meta-item">
                      <strong>{wh._count?.inventoryBalances ?? 0}</strong> SKU balances
                    </div>
                    <div className="meta-item">
                      <strong>{wh._count?.stockMovements ?? 0}</strong> Movements
                    </div>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="card-actions">
                  <button onClick={() => handleOpenEdit(wh)}>
                    <Edit2 size={14} />
                    <span>Edit</span>
                  </button>
                  <button onClick={() => handleToggleStatus(wh)}>
                    <Power size={14} />
                    <span>{wh.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingWh ? 'Edit Warehouse' : 'Create Warehouse'}</h2>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Warehouse Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WH-SOUTH"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="form-group">
                <label>Warehouse Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. South Regional Hub"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting ? 'Saving...' : editingWh ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
