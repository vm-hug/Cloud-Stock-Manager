import React, { useEffect, useState } from 'react';
import { Warehouse, Role } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { Plus, Search, Building2, Edit2, Power, X } from 'lucide-react';
import './WarehousesPage.scss';

export const WarehousesPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('warehouses.emptyDesc'));
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('warehouses.emptyDesc'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (wh: Warehouse) => {
    const confirmMsg = wh.isActive
      ? t('warehouses.confirmDeactivate', { name: wh.name, code: wh.code })
      : t('warehouses.confirmActivate', { name: wh.name, code: wh.code });

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setError(null);
      await inventoryApi.updateWarehouseStatus(wh.id, !wh.isActive);
      loadWarehouses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('warehouses.emptyDesc'));
    }
  };

  return (
    <div className="warehouses-page">
      <div className="page-header">
        <div className="title-group">
          <h1>{t('warehouses.title')}</h1>
          <p>{t('warehouses.subtitle')}</p>
        </div>
        {canManage && (
          <button className="btn-create" onClick={handleOpenCreate}>
            <Plus size={18} />
            <span>{t('warehouses.newWarehouse')}</span>
          </button>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('warehouses.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="loading-state">{t('warehouses.loading')}</p>
      ) : warehouses.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} />
          <p>{t('warehouses.emptyDesc')}</p>
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
                    {wh.isActive ? t('common.active') : t('common.inactive')}
                  </span>
                </div>
                <div className="wh-info">
                  <h3>{wh.name}</h3>
                  <div className="wh-meta">
                    <div className="meta-item">
                      <strong>{wh._count?.inventoryBalances ?? 0}</strong> {t('warehouses.skuBalances')}
                    </div>
                    <div className="meta-item">
                      <strong>{wh._count?.stockMovements ?? 0}</strong> {t('warehouses.movementsCount')}
                    </div>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="card-actions">
                  <button onClick={() => handleOpenEdit(wh)}>
                    <Edit2 size={14} />
                    <span>{t('common.edit')}</span>
                  </button>
                  <button onClick={() => handleToggleStatus(wh)}>
                    <Power size={14} />
                    <span>{wh.isActive ? t('warehouses.deactivateBtn') : t('warehouses.activateBtn')}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>
                  {editingWh ? t('warehouses.editWarehouse') : t('warehouses.createWarehouse')}
                </h2>
                <p className="modal-subtitle">{t('warehouses.modalSubtitle')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{t('warehouses.codeLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('warehouses.codePlaceholder')}
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                />
              </div>
              <div className="form-group">
                <label>{t('warehouses.nameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('warehouses.namePlaceholder')}
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
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                  {submitting
                    ? t('warehouses.saving')
                    : editingWh
                    ? t('common.save')
                    : t('warehouses.createSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
