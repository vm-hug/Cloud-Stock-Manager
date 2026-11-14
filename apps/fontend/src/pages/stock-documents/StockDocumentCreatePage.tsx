import React, { useEffect, useState } from 'react';
import { StockDocType, Warehouse, ProductVariant } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useI18n } from '../../features/i18n/I18nContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import './StockDocumentCreatePage.scss';

interface DocumentItemRow {
  variantId: string;
  quantity: number;
  adjustmentDelta?: number;
  unitPrice?: number;
}

export const StockDocumentCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();

  const rawType = searchParams.get('type') as StockDocType | null;
  const initialType =
    rawType && Object.values(StockDocType).includes(rawType)
      ? rawType
      : StockDocType.INBOUND;
  const initialWh = searchParams.get('warehouseId') || '';
  const initialVar = searchParams.get('variantId') || '';

  const [type, setType] = useState<StockDocType>(initialType);
  const [sourceWarehouseId, setSourceWarehouseId] = useState(
    initialType === StockDocType.INBOUND ? '' : initialWh
  );
  const [destinationWarehouseId, setDestinationWarehouseId] = useState(
    initialType === StockDocType.INBOUND ? initialWh : ''
  );
  const [note, setNote] = useState('');
  const [items, setItems] = useState<DocumentItemRow[]>([
    {
      variantId: initialVar,
      quantity: 1,
      adjustmentDelta: initialType === StockDocType.ADJUSTMENT ? 1 : undefined,
    },
  ]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [allVariants, setAllVariants] = useState<Array<ProductVariant & { productName?: string }>>(
    []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.getWarehouses({ isActive: true }).then((res) => {
      if (res.success && res.data) setWarehouses(res.data);
    });

    catalogApi.getProducts({ limit: 200, isActive: true }).then((res) => {
      if (res.success && res.data) {
        const flattened: Array<ProductVariant & { productName?: string }> = [];
        res.data.forEach((p) => {
          if (p.variants) {
            p.variants.forEach((v) => {
              if (v.isActive && !v.deletedAt) {
                flattened.push({ ...v, productName: p.name });
              }
            });
          }
        });
        setAllVariants(flattened);
      }
    });
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        variantId: '',
        quantity: 1,
        adjustmentDelta: type === StockDocType.ADJUSTMENT ? 1 : undefined,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof DocumentItemRow, val: string | number | undefined) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type === StockDocType.INBOUND && !destinationWarehouseId) {
      setError(t('stockDocs.errDestRequired'));
      return;
    }
    if (
      (type === StockDocType.OUTBOUND || type === StockDocType.ADJUSTMENT) &&
      !sourceWarehouseId
    ) {
      setError(t('stockDocs.errSourceRequired'));
      return;
    }
    if (type === StockDocType.TRANSFER) {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        setError(t('stockDocs.errTransferBoth'));
        return;
      }
      if (sourceWarehouseId === destinationWarehouseId) {
        setError(t('stockDocs.errTransferSame'));
        return;
      }
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].variantId) {
        setError(t('stockDocs.errItemSkuRequired', { row: i + 1 }));
        return;
      }
      if (items[i].quantity <= 0) {
        setError(t('stockDocs.errItemQtyMin', { row: i + 1 }));
        return;
      }
      if (
        type === StockDocType.ADJUSTMENT &&
        (!items[i].adjustmentDelta || items[i].adjustmentDelta === 0)
      ) {
        setError(t('stockDocs.errItemDeltaZero', { row: i + 1 }));
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await inventoryApi.createDocument({
        type,
        sourceWarehouseId: sourceWarehouseId || null,
        destinationWarehouseId: destinationWarehouseId || null,
        note: note || null,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
          adjustmentDelta: type === StockDocType.ADJUSTMENT ? i.adjustmentDelta : undefined,
          unitPrice: i.unitPrice,
        })),
      });

      if (res.success && res.data) {
        navigate(`/stock-documents/${res.data.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stockDocs.errSourceRequired'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stock-document-create-page">
      <div className="page-header">
        <Link to="/stock-documents" className="back-link">
          <ArrowLeft size={16} />
          <span>{t('stockDocs.backToList')}</span>
        </Link>
        <h1>{t('stockDocs.createTitle')}</h1>
        <p>{t('stockDocs.createSubtitle')}</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <h3 className="form-section-title">{t('stockDocs.sectionRouting')}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>{t('stockDocs.docTypeLabel')}</label>
            <select
              value={type}
              onChange={(e) => {
                const newType = e.target.value as StockDocType;
                setType(newType);
                if (newType === StockDocType.ADJUSTMENT) {
                  setItems(
                    items.map((i) => ({
                      ...i,
                      adjustmentDelta: i.adjustmentDelta || 1,
                    }))
                  );
                }
              }}
            >
              <option value={StockDocType.INBOUND}>{t('stockDocs.inboundOpt')}</option>
              <option value={StockDocType.OUTBOUND}>{t('stockDocs.outboundOpt')}</option>
              <option value={StockDocType.TRANSFER}>{t('stockDocs.transferOpt')}</option>
              <option value={StockDocType.ADJUSTMENT}>{t('stockDocs.adjustmentOpt')}</option>
            </select>
          </div>

          {(type === StockDocType.OUTBOUND ||
            type === StockDocType.TRANSFER ||
            type === StockDocType.ADJUSTMENT) && (
            <div className="form-group">
              <label>
                {type === StockDocType.ADJUSTMENT
                  ? t('stockDocs.auditWarehouseLabel')
                  : t('stockDocs.sourceWarehouseLabel')}
              </label>
              <select
                required
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
              >
                <option value="">{t('stockDocs.selectSourcePlaceholder')}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(type === StockDocType.INBOUND || type === StockDocType.TRANSFER) && (
            <div className="form-group">
              <label>{t('stockDocs.destWarehouseLabel')}</label>
              <select
                required
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
              >
                <option value="">{t('stockDocs.selectDestPlaceholder')}</option>
                {warehouses
                  .filter((wh) => type !== StockDocType.TRANSFER || wh.id !== sourceWarehouseId)
                  .map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-group">
          <label>{t('stockDocs.noteLabel')}</label>
          <textarea
            placeholder={t('stockDocs.notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <h3 className="form-section-title">{t('stockDocs.sectionItems')}</h3>

        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>{t('stockDocs.colProductSku')}</th>
              <th style={{ width: '20%' }}>{t('stockDocs.colQuantity')}</th>
              {type === StockDocType.ADJUSTMENT && (
                <th style={{ width: '25%' }}>{t('stockDocs.colAdjustmentDelta')}</th>
              )}
              {type === StockDocType.INBOUND && (
                <th style={{ width: '25%' }}>{t('stockDocs.colUnitPrice')}</th>
              )}
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    required
                    value={row.variantId}
                    onChange={(e) => handleItemChange(idx, 'variantId', e.target.value)}
                  >
                    <option value="">
                      {allVariants.length === 0
                        ? t('stockDocs.noSkusFoundOpt')
                        : t('stockDocs.selectSkuPlaceholder')}
                    </option>
                    {allVariants.map((v) => (
                      <option key={v.id} value={v.id}>
                        [{v.sku}] {v.productName} - {v.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    required
                    value={row.quantity}
                    onChange={(e) =>
                      handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)
                    }
                  />
                </td>
                {type === StockDocType.ADJUSTMENT && (
                  <td>
                    <input
                      type="number"
                      required
                      placeholder="e.g. -2 or +5"
                      value={row.adjustmentDelta ?? ''}
                      onChange={(e) =>
                        handleItemChange(
                          idx,
                          'adjustmentDelta',
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                    />
                  </td>
                )}
                {type === StockDocType.INBOUND && (
                  <td>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="0"
                      value={row.unitPrice ?? ''}
                      onChange={(e) =>
                        handleItemChange(
                          idx,
                          'unitPrice',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </td>
                )}
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-delete-row"
                    title={t('common.delete')}
                    disabled={items.length <= 1}
                    onClick={() => handleRemoveItem(idx)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="items-actions">
          <button type="button" className="btn-add-item" onClick={handleAddItem}>
            <Plus size={16} />
            <span>{t('stockDocs.addLineItem')}</span>
          </button>
        </div>

        <div className="form-actions">
          <Link to="/stock-documents" className="btn-cancel">
            {t('common.cancel')}
          </Link>
          <button type="submit" className="btn-submit" disabled={submitting}>
            <Save size={16} />
            <span>{submitting ? t('stockDocs.creatingDraft') : t('stockDocs.saveDraftBtn')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
