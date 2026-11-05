import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Layers,
  Building2,
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign,
  PieChart,
  RefreshCw,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  AnalyticsSummary,
  CategoryDistributionItem,
  InventoryValueBreakdown,
  StockTrendItem,
  TopStockedSkuItem,
  LowStockAlertItem,
  Warehouse,
  Role,
} from '@cloud-stock/shared';
import { analyticsApi } from '../../features/analytics/analytics.api';
import { inventoryApi } from '../../features/inventory/inventory.api';
import { useAuth } from '../../features/auth/AuthContext';
import './DashboardPage.scss';

export const DashboardPage: React.FC = () => {
  const { role } = useAuth();
  const isAdminOrManager = role === Role.ADMIN || role === Role.MANAGER;

  // Filter States
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [trendDays, setTrendDays] = useState<number>(30);

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [categories, setCategories] = useState<CategoryDistributionItem[]>([]);
  const [valueBreakdown, setValueBreakdown] = useState<InventoryValueBreakdown | null>(null);
  const [trends, setTrends] = useState<StockTrendItem[]>([]);
  const [topSkus, setTopSkus] = useState<TopStockedSkuItem[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlertItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Initial load: fetch warehouses list
  useEffect(() => {
    async function loadWarehouses() {
      const res = await inventoryApi.getWarehouses({ limit: 100 });
      if (res.success && res.data) {
        setWarehouses(res.data.filter((w: Warehouse) => w.isActive));
      }
    }
    loadWarehouses();
  }, []);

  // Fetch all analytics datasets
  const fetchDashboardData = async () => {
    try {
      const [
        summaryRes,
        categoryRes,
        trendsRes,
        topSkusRes,
        lowStockRes,
        valueRes,
      ] = await Promise.all([
        analyticsApi.getSummary(selectedWarehouseId || undefined),
        analyticsApi.getProductsByCategory(selectedWarehouseId || undefined),
        analyticsApi.getStockTrends(trendDays, selectedWarehouseId || undefined),
        analyticsApi.getTopStockedSkus(5, selectedWarehouseId || undefined),
        analyticsApi.getLowStockAlerts(selectedWarehouseId || undefined),
        isAdminOrManager ? analyticsApi.getInventoryValueBreakdown() : Promise.resolve(null),
      ]);

      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }
      if (categoryRes.success && categoryRes.data) {
        setCategories(categoryRes.data);
      }
      if (trendsRes.success && trendsRes.data) {
        setTrends(trendsRes.data);
      }
      if (topSkusRes.success && topSkusRes.data) {
        setTopSkus(topSkusRes.data);
      }
      if (lowStockRes.success && lowStockRes.data) {
        setLowStockAlerts(lowStockRes.data.slice(0, 5));
      }
      if (valueRes && valueRes.success && valueRes.data) {
        setValueBreakdown(valueRes.data);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load analytics dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedWarehouseId, trendDays]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatCurrency = (val?: number | null) => {
    if (val === null || val === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Compute maximum trend movement for scaling SVG chart
  const maxTrendVal = Math.max(
    1,
    ...trends.map((t) => Math.max(t.inboundQty, t.outboundQty, Math.abs(t.adjustmentQty), t.transferQty))
  );

  return (
    <div className="dashboard-container">
      {/* Header Controls */}
      <div className="dashboard-header">
        <div className="header-title">
          <h2>Executive Warehouse & Stock Intelligence</h2>
          <p>Real-time analytics powered by PostgreSQL indexing and Redis Cache-Aside acceleration.</p>
        </div>

        <div className="header-controls">
          <div className="filter-group">
            <Building2 size={16} />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="warehouse-select"
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <Clock size={16} />
            <select
              value={trendDays}
              onChange={(e) => setTrendDays(Number(e.target.value))}
              className="days-select"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </div>

          <button
            className={`refresh-btn ${refreshing ? 'loading' : ''}`}
            onClick={handleRefresh}
            title="Refresh analytics data"
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>

          {lastUpdated && (
            <span className="last-updated-text" title="Last time metrics were computed">
              Updated {lastUpdated}
            </span>
          )}

          {summary?.cached && (
            <div className="cache-pill" title="Accelerated via Redis Cache-Aside">
              <span className="dot pulse" />
              <span>Redis Cached</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Computing inventory balances and aggregate metrics...</p>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon blue">
                <Boxes size={22} />
              </div>
              <div className="kpi-body">
                <div className="kpi-label">Total Stock Quantity</div>
                <div className="kpi-value">{summary?.totalStock.toLocaleString() ?? 0}</div>
                <div className="kpi-sub">Across active warehouses</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon indigo">
                <Layers size={22} />
              </div>
              <div className="kpi-body">
                <div className="kpi-label">Active SKUs / Variants</div>
                <div className="kpi-value">{summary?.totalVariants.toLocaleString() ?? 0}</div>
                <div className="kpi-sub">{summary?.totalProducts} product models</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon green">
                <DollarSign size={22} />
              </div>
              <div className="kpi-body">
                <div className="kpi-label">Retail Potential Value</div>
                <div className="kpi-value">{formatCurrency(summary?.totalRetailValue)}</div>
                <div className="kpi-sub">Selling value at catalog price</div>
              </div>
            </div>

            {isAdminOrManager && (
              <div className="kpi-card highlight">
                <div className="kpi-icon purple">
                  <TrendingUp size={22} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-label">Cost Valuation & Margin</div>
                  <div className="kpi-value">
                    {formatCurrency(summary?.totalInventoryCostValue)}
                  </div>
                  <div className="kpi-sub">
                    Margin: {valueBreakdown?.marginPercentage ?? 0}% ({formatCurrency(valueBreakdown?.potentialGrossMargin)})
                  </div>
                </div>
              </div>
            )}

            <div className={`kpi-card ${(summary?.lowStockCount ?? 0) > 0 ? 'warning' : ''}`}>
              <div className="kpi-icon amber">
                <AlertTriangle size={22} />
              </div>
              <div className="kpi-body">
                <div className="kpi-label">Low & Out of Stock SKUs</div>
                <div className="kpi-value">
                  {summary?.lowStockCount ?? 0} <span className="sub-val">({summary?.outOfStockCount ?? 0} Zero)</span>
                </div>
                <div className="kpi-sub">At or below reorder threshold</div>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon teal">
                <FileText size={22} />
              </div>
              <div className="kpi-body">
                <div className="kpi-label">Pending Approval Queue</div>
                <div className="kpi-value">{summary?.pendingDocumentsCount ?? 0}</div>
                <div className="kpi-sub">Vouchers awaiting review</div>
              </div>
            </div>
          </div>

          {/* Middle Row: Trend Chart & Category Distribution */}
          <div className="analytics-row">
            {/* Stock Movements Trend Chart */}
            <div className="chart-panel trend-panel">
              <div className="panel-header">
                <div>
                  <h3>Stock Movement Trends ({trendDays} Days)</h3>
                  <p>Inbound, outbound, adjustments, and internal warehouse transfers</p>
                </div>
                <div className="chart-legend">
                  <span className="legend-item"><span className="color-box inbound" /> Inbound</span>
                  <span className="legend-item"><span className="color-box outbound" /> Outbound</span>
                  <span className="legend-item"><span className="color-box transfer" /> Transfer</span>
                  <span className="legend-item"><span className="color-box adjustment" /> Adjustment</span>
                </div>
              </div>

              {trends.length === 0 ? (
                <div className="empty-chart">No movement records found for this period.</div>
              ) : (
                <div className="svg-chart-container">
                  <svg className="trend-svg" viewBox="0 0 800 240" preserveAspectRatio="none">
                    {/* Horizontal grid lines */}
                    <line x1="0" y1="40" x2="800" y2="40" className="grid-line" />
                    <line x1="0" y1="100" x2="800" y2="100" className="grid-line" />
                    <line x1="0" y1="160" x2="800" y2="160" className="grid-line" />
                    <line x1="0" y1="220" x2="800" y2="220" className="grid-line" />

                    {/* Bars for each day */}
                    {trends.map((t, i) => {
                      const totalDays = trends.length;
                      const barWidth = Math.max(4, 760 / totalDays - 4);
                      const x = 20 + i * (760 / totalDays);

                      const inH = (t.inboundQty / maxTrendVal) * 180;
                      const outH = (t.outboundQty / maxTrendVal) * 180;
                      const trH = (t.transferQty / maxTrendVal) * 180;

                      return (
                        <g key={t.date} className="bar-group">
                          <title>{`${t.date}\nInbound: +${t.inboundQty}\nOutbound: -${t.outboundQty}\nTransfer: ${t.transferQty}\nAdjustment: ${t.adjustmentQty}`}</title>
                          {inH > 0 && (
                            <rect
                              x={x}
                              y={220 - inH}
                              width={barWidth / 3}
                              height={inH}
                              className="bar inbound"
                              rx="2"
                            />
                          )}
                          {outH > 0 && (
                            <rect
                              x={x + barWidth / 3}
                              y={220 - outH}
                              width={barWidth / 3}
                              height={outH}
                              className="bar outbound"
                              rx="2"
                            />
                          )}
                          {trH > 0 && (
                            <rect
                              x={x + (barWidth / 3) * 2}
                              y={220 - trH}
                              width={barWidth / 3}
                              height={trH}
                              className="bar transfer"
                              rx="2"
                            />
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <div className="chart-dates">
                    <span>{trends[0]?.date}</span>
                    <span>{trends[Math.floor(trends.length / 2)]?.date}</span>
                    <span>{trends[trends.length - 1]?.date}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Category Distribution */}
            <div className="chart-panel category-panel">
              <div className="panel-header">
                <div>
                  <h3>Category Distribution</h3>
                  <p>Stock volumes and product counts by category</p>
                </div>
                <PieChart size={18} />
              </div>

              <div className="category-list">
                {categories.length === 0 ? (
                  <div className="empty-chart">No category data.</div>
                ) : (
                  categories.map((cat) => {
                    const totalAllStock = summary?.totalStock || 1;
                    const pct = Math.round((cat.totalStock / totalAllStock) * 100);

                    return (
                      <div key={cat.categoryId} className="category-row">
                        <div className="cat-info">
                          <span className="cat-name">{cat.categoryName}</span>
                          <span className="cat-counts">
                            {cat.totalStock.toLocaleString()} units • {cat.productCount} models
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div className="fill" style={{ width: `${Math.max(5, pct)}%` }} />
                        </div>
                        <div className="cat-footer">
                          <span>{pct}% of inventory</span>
                          <span className="val">{formatCurrency(cat.retailValue)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Warehouse Distribution, Top Stocked SKUs, and Low Stock Alerts */}
          <div className="analytics-row bottom-row">
            {/* Top Stocked SKUs */}
            <div className="chart-panel list-panel">
              <div className="panel-header">
                <div>
                  <h3>Top Stocked SKU Leaders</h3>
                  <p>Highest volume inventory items across facilities</p>
                </div>
                <ArrowUpRight size={18} />
              </div>

              <div className="table-responsive">
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Retail Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSkus.map((sku) => (
                      <tr key={sku.variantId}>
                        <td>
                          <span className="sku-badge">{sku.sku}</span>
                        </td>
                        <td>
                          <div className="prod-name">{sku.productName}</div>
                          <div className="var-name">{sku.variantName}</div>
                        </td>
                        <td>
                          <strong>{sku.totalStock.toLocaleString()}</strong>
                        </td>
                        <td>{formatCurrency(sku.totalStock * sku.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Low Stock Watchlist */}
            <div className="chart-panel list-panel">
              <div className="panel-header">
                <div>
                  <h3>Critical Low Stock Watchlist</h3>
                  <p>SKUs requiring replenishment</p>
                </div>
                <ShieldAlert size={18} />
              </div>

              {lowStockAlerts.length === 0 ? (
                <div className="empty-ok">
                  <CheckCircle2 size={32} />
                  <span>All SKUs are comfortably above safety thresholds!</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="mini-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>SKU</th>
                        <th>Current Stock</th>
                        <th>Threshold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockAlerts.map((item) => (
                        <tr key={item.variantId}>
                          <td>
                            <span className={`status-pill ${item.alertLevel.toLowerCase()}`}>
                              {item.alertLevel.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <span className="sku-badge">{item.sku}</span>
                            <div className="var-name">{item.productName}</div>
                          </td>
                          <td>
                            <strong className={item.totalStock === 0 ? 'zero-stock' : 'low-stock'}>
                              {item.totalStock} units
                            </strong>
                          </td>
                          <td>{item.minThreshold} units (Deficit: {item.deficit})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
