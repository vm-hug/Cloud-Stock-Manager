import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  InventoryBalance,
  ProductVariant,
  StockDocType,
  StockMovement,
  Warehouse,
} from '@cloud-stock/shared';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { catalogApi } from '../../features/catalog/catalog.api';
import { useI18n } from '../../features/i18n/I18nContext';
import {
  Box,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Plus,
  Search,
  X,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import './DashboardPage.scss';

interface VariantWithMeta extends ProductVariant {
  productName: string;
  categoryName: string;
}

interface DayFlowPoint {
  key: string;
  label: string;
  inbound: number;
  outbound: number;
}

export const DashboardPage: React.FC = () => {
  const { t, lang } = useI18n();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWh, setSelectedWh] = useState<string>('');
  const [variants, setVariants] = useState<VariantWithMeta[]>([]);
  const [allBalances, setAllBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Table filter & pagination state
  const [statusTab, setStatusTab] = useState<'' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 8;

  // Quick Inbound Modal (matching screenshot 2)
  const [inboundModalOpen, setInboundModalOpen] = useState<boolean>(false);
  const [inboundWhId, setInboundWhId] = useState<string>('');
  const [inboundVariantId, setInboundVariantId] = useState<string>('');
  const [inboundQty, setInboundQty] = useState<number>(100);
  const [inboundPoCode, setInboundPoCode] = useState<string>('');
  const [submittingInbound, setSubmittingInbound] = useState<boolean>(false);
  const [inboundError, setInboundError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<{ message: string; docId?: string } | null>(
    null
  );

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [whRes, prodRes, balRes, movRes] = await Promise.all([
        inventoryApi.getWarehouses({ isActive: true, limit: 100 }),
        catalogApi.getProducts({ limit: 500, isActive: true }),
        inventoryApi.getBalances({
          page: 1,
          limit: 1000,
          warehouseId: selectedWh || undefined,
        }),
        inventoryApi.getMovements({
          page: 1,
          limit: 500,
          warehouseId: selectedWh || undefined,
        }),
      ]);

      if (whRes.success && whRes.data) {
        setWarehouses(whRes.data);
      }

      if (prodRes.success && prodRes.data) {
        const extracted: VariantWithMeta[] = [];
        prodRes.data.forEach((p) => {
          if (p.variants && p.variants.length > 0) {
            p.variants.forEach((v) => {
              if (v.isActive) {
                extracted.push({
                  ...v,
                  productName: p.name,
                  categoryName: p.category?.name || (lang === 'vi' ? 'Chưa phân loại' : 'Uncategorized'),
                });
              }
            });
          }
        });
        setVariants(extracted);
      }

      if (balRes.success && balRes.data) {
        setAllBalances(balRes.data);
      }

      if (movRes.success && movRes.data) {
        setMovements(movRes.data);
      }
    } catch {
      // Non-blocking fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [selectedWh]);

  // Build unified display rows so even when 0 warehouses exist yet, newly created SKUs appear immediately
  const unifiedRows = useMemo(() => {
    if (allBalances.length > 0) {
      return allBalances.map((b) => {
        const qty = b.quantity;
        const minT = b.minThreshold ?? 5;
        const status: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK' =
          qty === 0 ? 'OUT_OF_STOCK' : qty <= minT ? 'LOW_STOCK' : 'IN_STOCK';
        return {
          key: `${b.warehouseId}-${b.variantId}`,
          warehouseId: b.warehouseId,
          warehouseCode: b.warehouse?.code || 'WH-01',
          warehouseName: b.warehouse?.name || '',
          variantId: b.variantId,
          sku: b.variant?.sku || 'SKU',
          productName: b.variant?.product?.name || b.variant?.name || '—',
          variantName: b.variant?.name || '',
          categoryName:
            b.variant?.product?.category?.name ||
            (lang === 'vi' ? ' Hàng tiêu chuẩn' : 'Standard Goods'),
          quantity: qty,
          minThreshold: minT,
          status,
        };
      });
    }

    // Fallback when SKUs exist in catalog but no warehouse balance rows exist yet
    return variants.map((v) => ({
      key: `unassigned-${v.id}`,
      warehouseId: warehouses[0]?.id || '',
      warehouseCode: warehouses[0]?.code || (lang === 'vi' ? 'CHƯA-KHO' : 'NO-WH'),
      warehouseName: warehouses[0]?.name || (lang === 'vi' ? 'Chưa tạo kho' : 'No warehouse'),
      variantId: v.id,
      sku: v.sku,
      productName: v.productName,
      variantName: v.name,
      categoryName: v.categoryName,
      quantity: 0,
      minThreshold: 5,
      status: 'OUT_OF_STOCK' as const,
    }));
  }, [allBalances, variants, warehouses, lang]);

  // Compute KPI Card metrics
  const kpi = useMemo(() => {
    const uniqueSkuSet = new Set<string>();
    variants.forEach((v) => uniqueSkuSet.add(v.id));
    unifiedRows.forEach((r) => uniqueSkuSet.add(r.variantId));

    let totalUnits = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    unifiedRows.forEach((r) => {
      totalUnits += r.quantity;
      if (r.status === 'IN_STOCK') inStockCount += 1;
      else if (r.status === 'LOW_STOCK') lowStockCount += 1;
      else outOfStockCount += 1;
    });

    return {
      totalSkus: selectedWh ? unifiedRows.length : Math.max(uniqueSkuSet.size, unifiedRows.length),
      totalRows: unifiedRows.length,
      totalUnits,
      inStockCount,
      lowStockCount,
      outOfStockCount,
    };
  }, [unifiedRows, variants, selectedWh]);

  // Compute 7-day Inbound vs Outbound bar chart (T2 -> CN)
  const sevenDayFlow = useMemo<DayFlowPoint[]>(() => {
    const dayLabelsVi = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const points: DayFlowPoint[] = [];

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      const yyyyMmDd = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      points.push({
        key: yyyyMmDd,
        label: lang === 'vi' ? dayLabelsVi[dow] : dayLabelsEn[dow],
        inbound: 0,
        outbound: 0,
      });
    }

    const indexByDate = new Map<string, DayFlowPoint>();
    points.forEach((p) => indexByDate.set(p.key, p));

    movements.forEach((m) => {
      const dateStr = new Date(m.createdAt).toISOString().slice(0, 10);
      const bucket = indexByDate.get(dateStr);
      if (bucket) {
        if (m.delta > 0) {
          bucket.inbound += m.delta;
        } else if (m.delta < 0) {
          bucket.outbound += Math.abs(m.delta);
        }
      }
    });

    return points;
  }, [movements, lang]);

  const maxFlowValue = useMemo(() => {
    let maxVal = 0;
    sevenDayFlow.forEach((p) => {
      if (p.inbound > maxVal) maxVal = p.inbound;
      if (p.outbound > maxVal) maxVal = p.outbound;
    });
    return maxVal > 0 ? Math.ceil(maxVal * 1.15) : 100;
  }, [sevenDayFlow]);

  // Compute Warehouse / Zone Capacity & Distribution bars
  const zoneAllocation = useMemo(() => {
    const capacityPerZone = 1000;
    if (!selectedWh && warehouses.length > 0) {
      return warehouses.slice(0, 4).map((wh, idx) => {
        const whUnits = unifiedRows
          .filter((r) => r.warehouseId === wh.id)
          .reduce((sum, r) => sum + r.quantity, 0);
        const skuCount = unifiedRows.filter((r) => r.warehouseId === wh.id).length;
        const pct = Math.min(100, Math.round((whUnits / capacityPerZone) * 100));
        return {
          id: wh.id,
          title: `${wh.code} — ${wh.name}`,
          units: whUnits,
          capacity: capacityPerZone,
          skuCount,
          pct,
          tone: pct >= 85 ? 'warning' : idx % 2 === 0 ? 'primary' : 'info',
        };
      });
    }

    // Group by category if filtered to a single warehouse or when no warehouse exists yet
    const byCat = new Map<string, { units: number; skuCount: number }>();
    unifiedRows.forEach((r) => {
      const curr = byCat.get(r.categoryName) || { units: 0, skuCount: 0 };
      curr.units += r.quantity;
      curr.skuCount += 1;
      byCat.set(r.categoryName, curr);
    });

    const entries = Array.from(byCat.entries()).slice(0, 4);
    return entries.map(([catName, stats], idx) => {
      const pct = Math.min(100, Math.round((stats.units / capacityPerZone) * 100));
      return {
        id: catName,
        title: `${lang === 'vi' ? 'Khu' : 'Zone'} ${String.fromCharCode(65 + idx)} — ${catName}`,
        units: stats.units,
        capacity: capacityPerZone,
        skuCount: stats.skuCount,
        pct,
        tone: pct >= 85 ? 'warning' : idx % 2 === 0 ? 'primary' : 'info',
      };
    });
  }, [warehouses, unifiedRows, selectedWh, lang]);

  // Filtered & paginated table rows
  const filteredRows = useMemo(() => {
    return unifiedRows.filter((r) => {
      if (statusTab && r.status !== statusTab) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.sku.toLowerCase().includes(q) ||
          r.productName.toLowerCase().includes(q) ||
          r.variantName.toLowerCase().includes(q) ||
          r.warehouseCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedRows, statusTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  const openQuickInbound = (whId?: string, varId?: string) => {
    setInboundError(null);
    setInboundWhId(whId || selectedWh || warehouses[0]?.id || '');
    setInboundVariantId(varId || variants[0]?.id || '');
    setInboundQty(100);
    setInboundPoCode(`PO-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`);
    setInboundModalOpen(true);
  };

  const handleConfirmQuickInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundVariantId || inboundQty < 1) {
      setInboundError(
        lang === 'vi'
          ? 'Vui lòng chọn mã SKU và nhập số lượng hợp lệ (>= 1).'
          : 'Please select a valid SKU and quantity (>= 1).'
      );
      return;
    }

    try {
      setSubmittingInbound(true);
      setInboundError(null);

      let targetWarehouseId = inboundWhId;
      // If user hasn't created any warehouse yet, automatically create default WH-01 so workflow is seamless
      if (!targetWarehouseId && warehouses.length === 0) {
        const newWhRes = await inventoryApi.createWarehouse({
          code: 'WH-01',
          name: lang === 'vi' ? 'Kho Tổng Trung Tâm' : 'Main Central Warehouse',
        });
        if (newWhRes.success && newWhRes.data) {
          targetWarehouseId = newWhRes.data.id;
        }
      }

      if (!targetWarehouseId) {
        setInboundError(
          lang === 'vi' ? 'Vui lòng chọn kho nhận hàng.' : 'Please select a destination warehouse.'
        );
        return;
      }

      const createRes = await inventoryApi.createDocument({
        type: StockDocType.INBOUND,
        destinationWarehouseId: targetWarehouseId,
        note: inboundPoCode.trim()
          ? `${lang === 'vi' ? 'Chứng từ' : 'PO'}: ${inboundPoCode.trim()}`
          : undefined,
        items: [
          {
            variantId: inboundVariantId,
            quantity: Number(inboundQty),
          },
        ],
      });

      if (createRes.success && createRes.data) {
        const doc = createRes.data;
        await inventoryApi.submitDocument(doc.id);
        setBannerSuccess({
          message:
            lang === 'vi'
              ? `Đã tạo và gửi duyệt phiếu nhập kho ${doc.documentCode}. Vào mục Phê duyệt phiếu để chốt tồn kho!`
              : `Created and submitted inbound voucher ${doc.documentCode} for approval.`,
          docId: doc.id,
        });
        setInboundModalOpen(false);
        fetchOverviewData();
      }
    } catch (err: unknown) {
      setInboundError(
        err instanceof Error
          ? err.message
          : lang === 'vi'
          ? 'Không thể tạo phiếu nhập kho.'
          : 'Failed to create inbound voucher.'
      );
    } finally {
      setSubmittingInbound(false);
    }
  };

  return (
    <div className="ops-dashboard-page">
      {/* Top Header Strip */}
      <div className="ops-header">
        <div className="ops-header-left">
          <h1>{lang === 'vi' ? 'Tổng quan vận hành kho' : 'Warehouse Operations Overview'}</h1>
          <p>
            {lang === 'vi'
              ? 'Giám sát thời gian thực định mức SKU, lưu lượng Nhập/Xuất và tỷ trọng lấp đầy kho'
              : 'Real-time monitoring of SKU thresholds, Inbound/Outbound flow, and warehouse utilization'}
          </p>
        </div>

        <div className="ops-header-actions">
          <div className="wh-selector">
            <WarehouseIcon size={15} />
            <select
              value={selectedWh}
              onChange={(e) => {
                setSelectedWh(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t('inventory.allWarehouses')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-create-inbound"
            onClick={() => openQuickInbound()}
          >
            <Plus size={16} />
            <span>{t('inventory.newInboundBtn')}</span>
          </button>
        </div>
      </div>

      {bannerSuccess && (
        <div className="ops-success-banner">
          <span>{bannerSuccess.message}</span>
          <div className="banner-links">
            {bannerSuccess.docId && (
              <Link to={`/stock-documents/${bannerSuccess.docId}`} className="banner-btn">
                <span>{t('inventory.openVoucher')}</span>
                <ArrowUpRight size={14} />
              </Link>
            )}
            <button type="button" className="banner-close" onClick={() => setBannerSuccess(null)}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 4 KPI Cards matching Reference Screenshot */}
      <div className="ops-kpi-grid">
        <div className="ops-kpi-card">
          <div className="kpi-head">
            <span className="kpi-title">{t('inventory.kpiTotalSkus')}</span>
            <span className="kpi-icon-box blue">
              <Box size={18} />
            </span>
          </div>
          <div className="kpi-main-number">{kpi.totalSkus.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="kpi-pill positive">
              {variants.length} SKU
            </span>
            <span className="kpi-caption">
              {lang === 'vi' ? 'đang quản lý trên hệ thống' : 'tracked in catalog'}
            </span>
            <svg className="kpi-sparkline" viewBox="0 0 64 22" fill="none">
              <path
                d="M2 18L15 14L27 16L40 9L52 11L62 4"
                stroke="#3b5bdb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="ops-kpi-card">
          <div className="kpi-head">
            <span className="kpi-title">{t('inventory.kpiTotalUnits')}</span>
            <span className="kpi-icon-box sky">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="kpi-main-number">{kpi.totalUnits.toLocaleString()}</div>
          <div className="kpi-footer">
            <span className="kpi-pill positive">
              {kpi.inStockCount} SKU
            </span>
            <span className="kpi-caption">
              {lang === 'vi' ? 'đơn vị sẵn sàng xuất' : 'units ready to ship'}
            </span>
            <svg className="kpi-sparkline" viewBox="0 0 64 22" fill="none">
              <path
                d="M2 17L16 15L28 11L42 13L53 7L62 5"
                stroke="#0ca678"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="ops-kpi-card">
          <div className="kpi-head">
            <span className="kpi-title">{t('inventory.kpiLowStock')}</span>
            <span className="kpi-icon-box amber">
              <AlertTriangle size={18} />
            </span>
          </div>
          <div className="kpi-main-number">
            {kpi.lowStockCount} <small>SKU</small>
          </div>
          <div className="kpi-footer">
            <span className="kpi-pill warning">
              {lang === 'vi' ? 'Cần bổ sung' : 'Restock'}
            </span>
            <span className="kpi-caption">
              {lang === 'vi' ? 'dưới mức an toàn' : 'below safety threshold'}
            </span>
            <svg className="kpi-sparkline" viewBox="0 0 64 22" fill="none">
              <path
                d="M2 8L16 10L30 9L43 14L54 15L62 18"
                stroke="#d97706"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="ops-kpi-card">
          <div className="kpi-head">
            <span className="kpi-title">{t('inventory.kpiOutOfStock')}</span>
            <span className="kpi-icon-box rose">
              <Ban size={18} />
            </span>
          </div>
          <div className="kpi-main-number">
            {kpi.outOfStockCount} <small>SKU</small>
          </div>
          <div className="kpi-footer">
            <span className="kpi-pill danger">
              {lang === 'vi' ? 'Ưu tiên cao' : 'High Priority'}
            </span>
            <span className="kpi-caption">
              {lang === 'vi' ? 'đang chờ PO về kho' : 'awaiting inbound PO'}
            </span>
            <svg className="kpi-sparkline" viewBox="0 0 64 22" fill="none">
              <path
                d="M2 15L14 11L26 16L38 10L50 15L62 9"
                stroke="#e03131"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Middle Analytics Charts Row */}
      <div className="ops-charts-row">
        {/* Left: 7-Day Inbound vs Outbound Bar Chart */}
        <div className="ops-chart-card flow-chart-card">
          <div className="chart-card-header">
            <div>
              <h2>
                {lang === 'vi'
                  ? 'Lưu lượng Nhập kho vs Xuất kho (7 ngày)'
                  : 'Inbound vs Outbound Flow (7 Days)'}
              </h2>
              <p>
                {lang === 'vi'
                  ? 'Đối chiếu số lượng kiện hàng luân chuyển thực tế qua cổng kiểm soát'
                  : 'Comparison of physical stock units moving through warehouse checkpoints'}
              </p>
            </div>
            <div className="chart-legend">
              <span className="legend-item">
                <i className="legend-dot inbound" />
                {lang === 'vi' ? 'Nhập kho (Inbound)' : 'Inbound'}
              </span>
              <span className="legend-item">
                <i className="legend-dot outbound" />
                {lang === 'vi' ? 'Xuất kho (Outbound)' : 'Outbound'}
              </span>
            </div>
          </div>

          <div className="bar-chart-area">
            <div className="y-axis">
              <span>{maxFlowValue}</span>
              <span>{Math.round(maxFlowValue * 0.75)}</span>
              <span>{Math.round(maxFlowValue * 0.5)}</span>
              <span>{Math.round(maxFlowValue * 0.25)}</span>
              <span>0</span>
            </div>

            <div className="bars-stage">
              <div className="grid-lines">
                <div className="grid-line" />
                <div className="grid-line" />
                <div className="grid-line" />
                <div className="grid-line" />
                <div className="grid-line" />
              </div>

              <div className="day-columns">
                {sevenDayFlow.map((pt) => {
                  const inHeight =
                    pt.inbound > 0 ? Math.max(8, Math.round((pt.inbound / maxFlowValue) * 100)) : 4;
                  const outHeight =
                    pt.outbound > 0
                      ? Math.max(8, Math.round((pt.outbound / maxFlowValue) * 100))
                      : 4;
                  return (
                    <div className="day-col" key={pt.key}>
                      <div className="bars-pair">
                        <div
                          className={`bar inbound ${pt.inbound === 0 ? 'empty' : ''}`}
                          style={{ height: `${inHeight}%` }}
                          title={`${pt.label} Inbound: ${pt.inbound}`}
                        >
                          {pt.inbound > 0 && <span className="bar-val">{pt.inbound}</span>}
                        </div>
                        <div
                          className={`bar outbound ${pt.outbound === 0 ? 'empty' : ''}`}
                          style={{ height: `${outHeight}%` }}
                          title={`${pt.label} Outbound: ${pt.outbound}`}
                        >
                          {pt.outbound > 0 && <span className="bar-val">{pt.outbound}</span>}
                        </div>
                      </div>
                      <span className="day-label">{pt.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Warehouse / Zone Capacity Progress Bars */}
        <div className="ops-chart-card capacity-chart-card">
          <div className="chart-card-header">
            <div>
              <h2>
                {lang === 'vi' ? 'Sức chứa theo khu vực kệ' : 'Capacity by Storage Zone'}
              </h2>
              <p>
                {lang === 'vi'
                  ? 'Mật độ lấp đầy vị trí lưu trữ hiện tại'
                  : 'Current storage rack density and SKU distribution'}
              </p>
            </div>
            <span className="capacity-total-badge">
              {warehouses.length} {lang === 'vi' ? 'Kho' : 'WH'}
            </span>
          </div>

          <div className="zone-bars-list">
            {zoneAllocation.length === 0 ? (
              <div className="empty-zones">
                <p>
                  {lang === 'vi'
                    ? 'Chưa có dữ liệu phân bổ kho hoặc danh mục.'
                    : 'No warehouse or category allocation data yet.'}
                </p>
                <Link to="/warehouses" className="zone-action-link">
                  {lang === 'vi' ? '+ Tạo kho hàng đầu tiên' : '+ Create first warehouse'}
                </Link>
              </div>
            ) : (
              zoneAllocation.map((z) => (
                <div className="zone-item" key={z.id}>
                  <div className="zone-top">
                    <span className="zone-name">{z.title}</span>
                    <span className={`zone-pct ${z.tone}`}>{z.pct}%</span>
                  </div>
                  <div className="zone-track">
                    <div
                      className={`zone-fill ${z.tone}`}
                      style={{ width: `${Math.max(z.units > 0 ? 6 : 0, z.pct)}%` }}
                    />
                  </div>
                  <div className="zone-meta">
                    <span>
                      {z.units.toLocaleString()} / {z.capacity.toLocaleString()}{' '}
                      {lang === 'vi' ? 'đơn vị' : 'units'}
                    </span>
                    <span>
                      {z.skuCount} SKU
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="capacity-footer">
            <span>{lang === 'vi' ? 'Tổng tồn kho khả dụng:' : 'Total available stock:'}</span>
            <strong>
              {kpi.totalUnits.toLocaleString()} {lang === 'vi' ? 'đơn vị' : 'units'}
            </strong>
          </div>
        </div>
      </div>

      {/* Bottom Table: Danh sách tồn kho & Trạng thái SKU */}
      <div className="ops-table-card">
        <div className="ops-table-header">
          <div className="table-title-block">
            <h2>
              {lang === 'vi'
                ? 'Danh sách tồn kho & Trạng thái SKU'
                : 'SKU Inventory List & Stock Status'}
            </h2>
            <p>
              {lang === 'vi'
                ? 'Kiểm soát định mức an toàn và vị trí lưu trữ chi tiết từng mã hàng'
                : 'Safety threshold control and storage location per SKU'}
            </p>
          </div>

          <div className="table-controls">
            <div className="segmented-filter-pills">
              <button
                type="button"
                className={statusTab === '' ? 'active' : ''}
                onClick={() => {
                  setStatusTab('');
                  setPage(1);
                }}
              >
                {t('inventory.allStatuses')} <b>{kpi.totalRows}</b>
              </button>
              <button
                type="button"
                className={statusTab === 'IN_STOCK' ? 'active' : ''}
                onClick={() => {
                  setStatusTab('IN_STOCK');
                  setPage(1);
                }}
              >
                {t('inventory.inStock')} <b>{kpi.inStockCount}</b>
              </button>
              <button
                type="button"
                className={statusTab === 'LOW_STOCK' ? 'active' : ''}
                onClick={() => {
                  setStatusTab('LOW_STOCK');
                  setPage(1);
                }}
              >
                {t('inventory.lowStock')} <b>{kpi.lowStockCount}</b>
              </button>
              <button
                type="button"
                className={statusTab === 'OUT_OF_STOCK' ? 'active' : ''}
                onClick={() => {
                  setStatusTab('OUT_OF_STOCK');
                  setPage(1);
                }}
              >
                {t('inventory.outOfStock')} <b>{kpi.outOfStockCount}</b>
              </button>
            </div>

            <div className="mini-search-input">
              <Search size={15} />
              <input
                type="text"
                placeholder={
                  lang === 'vi' ? 'Lọc mã SKU, tên hàng, kệ...' : 'Filter SKU, product, rack...'
                }
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        <div className="ops-table-scroll">
          <table>
            <thead>
              <tr>
                <th>{lang === 'vi' ? 'MÃ SKU' : 'SKU CODE'}</th>
                <th>{lang === 'vi' ? 'TÊN SẢN PHẨM' : 'PRODUCT NAME'}</th>
                <th>{lang === 'vi' ? 'VỊ TRÍ KỆ (KHO)' : 'LOCATION (WH)'}</th>
                <th>{lang === 'vi' ? 'TỒN THỰC TẾ' : 'ON-HAND QTY'}</th>
                <th>{lang === 'vi' ? 'ĐỊNH MỨC TỐI THIỂU' : 'MIN THRESHOLD'}</th>
                <th>{lang === 'vi' ? 'TRẠNG THÁI' : 'STATUS'}</th>
                <th>{lang === 'vi' ? 'THAO TÁC' : 'ACTION'}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {t('inventory.loading')}
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {lang === 'vi'
                      ? 'Chưa có mã SKU nào. Hãy tạo Sản phẩm -> Thêm biến thể SKU -> Tạo phiếu nhập kho.'
                      : 'No SKUs found. Create a Product -> Add SKU Variant -> Create Inbound Voucher.'}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const statusClass =
                    row.status === 'OUT_OF_STOCK'
                      ? 'out-of-stock'
                      : row.status === 'LOW_STOCK'
                      ? 'low-stock'
                      : 'in-stock';
                  const statusLabel =
                    row.status === 'OUT_OF_STOCK'
                      ? t('inventory.outOfStock')
                      : row.status === 'LOW_STOCK'
                      ? t('inventory.lowStock')
                      : t('inventory.inStock');

                  return (
                    <tr key={row.key}>
                      <td>
                        <span className="sku-code-text">{row.sku}</span>
                      </td>
                      <td>
                        <div className="prod-info-cell">
                          <span className="prod-main">{row.productName}</span>
                          {row.variantName && row.variantName !== row.productName && (
                            <span className="prod-sub">{row.variantName}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="rack-badge">{row.warehouseCode}</span>
                      </td>
                      <td>
                        <strong className={`qty-number ${statusClass}`}>
                          {row.quantity.toLocaleString()}
                        </strong>
                      </td>
                      <td>
                        <span className="threshold-number">{row.minThreshold}</span>
                      </td>
                      <td>
                        <span className={`status-pill-dot ${statusClass}`}>
                          <i className="dot" />
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-link-inbound"
                          onClick={() => openQuickInbound(row.warehouseId, row.variantId)}
                        >
                          {t('inventory.addInboundAction')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="ops-table-footer">
          <span>
            {t('common.showingOf', {
              count: paginatedRows.length,
              total: filteredRows.length,
            })}
          </span>

          <div className="pager-buttons">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              <span>{t('common.previous')}</span>
            </button>
            <span className="page-pill">{page}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>{t('common.next')}</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Inbound Modal matching Screenshot 2 */}
      {inboundModalOpen && (
        <div className="ops-modal-backdrop" onClick={() => setInboundModalOpen(false)}>
          <div className="ops-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-head">
              <div>
                <h3>{t('inventory.quickInboundTitle')}</h3>
                <p>
                  {lang === 'vi'
                    ? 'Cập nhật số lượng tồn thực tế cho mã SKU qua phiếu nhập kho'
                    : 'Update physical stock for SKU via an inbound stock voucher'}
                </p>
              </div>
              <button
                type="button"
                className="modal-close-x"
                onClick={() => setInboundModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickInbound} className="ops-modal-body">
              {inboundError && <div className="modal-err-box">{inboundError}</div>}

              {warehouses.length > 0 && (
                <div className="modal-field">
                  <label>{t('inventory.selectWarehouseLabel')}</label>
                  <select
                    value={inboundWhId}
                    onChange={(e) => setInboundWhId(e.target.value)}
                    required
                  >
                    <option value="">{t('inventory.selectWarehousePlaceholder')}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-field">
                <label>{t('inventory.selectSkuLabel')}</label>
                <select
                  value={inboundVariantId}
                  onChange={(e) => setInboundVariantId(e.target.value)}
                  required
                >
                  <option value="">{t('inventory.selectSkuPlaceholder')}</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.sku} — {v.productName} ({v.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-row-2col">
                <div className="modal-field">
                  <label>{t('inventory.inboundQtyLabel')}</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={inboundQty}
                    onChange={(e) => setInboundQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
                <div className="modal-field">
                  <label>{lang === 'vi' ? 'Mã chứng từ PO' : 'PO Reference Code'}</label>
                  <input
                    type="text"
                    placeholder="PO-2026-884"
                    value={inboundPoCode}
                    onChange={(e) => setInboundPoCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="ops-modal-actions">
                <button
                  type="button"
                  className="btn-cancel-pill"
                  onClick={() => setInboundModalOpen(false)}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-confirm-pill"
                  disabled={submittingInbound}
                >
                  {submittingInbound
                    ? t('common.loading')
                    : lang === 'vi'
                    ? 'Xác nhận nhập kho'
                    : 'Confirm Inbound'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
