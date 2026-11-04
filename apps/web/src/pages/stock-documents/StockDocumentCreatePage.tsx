import React, { useEffect, useState } from 'react';
import { StockDocType, Warehouse, ProductVariant } from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { catalogApi } from '../../features/catalog/catalog.api';
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

  const initialType = (searchParams.get('type') as StockDocType) || StockDocType.INBOUND;
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
  const [allVariants, setAllVariants] = useState<Array<ProductVariant & { productName?: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.getWarehouses({ isActive: true }).then((res) => {
      if (res.success && res.data) setWarehouses(res.data);
    });

    catalogApi.getProducts({ limit: 100, isActive: true }).then((res) => {
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

  const handleItemChange = (index: number, field: keyof DocumentItemRow, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Frontend validation
    if (type === StockDocType.INBOUND && !destinationWarehouseId) {
      setError('Please select a destination warehouse for INBOUND document.');
      return;
    }
    if (
      (type === StockDocType.OUTBOUND || type === StockDocType.ADJUSTMENT) &&
      !sourceWarehouseId
    ) {
      setError('Please select a warehouse for this operation.');
      return;
    }
    if (type === StockDocType.TRANSFER) {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        setError('Please select both source and destination warehouses for TRANSFER.');
        return;
      }
      if (sourceWarehouseId === destinationWarehouseId) {
        setError('Source and destination warehouses cannot be the same for TRANSFER.');
        return;
      }
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].variantId) {
        setError(`Please select an SKU variant for item row ${i + 1}.`);
        return;
      }
      if (items[i].quantity <= 0) {
        setError(`Quantity for item row ${i + 1} must be at least 1.`);
        return;
      }
      if (type === StockDocType.ADJUSTMENT && (!items[i].adjustmentDelta || items[i].adjustmentDelta === 0)) {
        setError(`Adjustment delta for item row ${i + 1} must be a non-zero integer (e.g. -2 or +5).`);
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
    } catch (err: any) {
      setError(err.message || 'Failed to create stock document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="stock-document-create-page">
      <div className="page-header">
        <Link to="/stock-documents" className="back-link">
          <ArrowLeft size={16} />
          <span>Back to Documents</span>
        </Link>
        <h1>Create Stock Document</h1>
        <p>Prepare a draft voucher for physical inventory movement or warehouse audit.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="form-card">
        <h3 className="form-section-title">1. Document Details & Routing</h3>

        <div className="form-grid">
          <div className="form-group">
            <label>Document Type *</label>
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
              <option value={StockDocType.INBOUND}>Inbound (Receipt into warehouse)</option>
              <option value={StockDocType.OUTBOUND}>Outbound (Dispatch out of warehouse)</option>
              <option value={StockDocType.TRANSFER}>Transfer (Move between 2 warehouses)</option>
              <option value={StockDocType.ADJUSTMENT}>Adjustment (Stock audit reconciliation)</option>
            </select>
          </div>

          {(type === StockDocType.OUTBOUND ||
            type === StockDocType.TRANSFER ||
            type === StockDocType.ADJUSTMENT) && (
            <div className="form-group">
              <label>
                {type === StockDocType.ADJUSTMENT ? 'Warehouse *' : 'Source Warehouse *'}
              </label>
              <select
                required
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
              >
                <option value="">Select source warehouse...</option>
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
              <label>Destination Warehouse *</label>
              <select
                required
                value={destinationWarehouseId}
                onChange={(e) => setDestinationWarehouseId(e.target.value)}
              >
                <option value="">Select destination warehouse...</option>
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
          <label>Document Memo / Note</label>
          <textarea
            placeholder="Add reference notes, purchase order numbers, or discrepancy justification..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <h3 className="form-section-title">2. SKU Line Items</h3>

        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Product SKU Variant</th>
              <th style={{ width: '20%' }}>Quantity</th>
              {type === StockDocType.ADJUSTMENT && (
                <th style={{ width: '25%' }}>Adjustment Delta (+/-)</th>
              )}
              {type === StockDocType.INBOUND && (
                <th style={{ width: '25%' }}>Unit Price ($)</th>
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
                    <option value="">Select SKU variant...</option>
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
                      handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)
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
                        handleItemChange(idx, 'adjustmentDelta', parseInt(e.target.value) || 0)
                      }
                    />
                  </td>
                )}
                {type === StockDocType.INBOUND && (
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
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
                    title="Remove item"
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
            <span>Add Line Item</span>
          </button>
        </div>

        <div className="form-actions">
          <Link to="/stock-documents" className="btn-cancel">
            Cancel
          </Link>
          <button type="submit" className="btn-submit" disabled={submitting}>
            <Save size={16} />
            <span>{submitting ? 'Creating Draft...' : 'Save Draft Document'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
