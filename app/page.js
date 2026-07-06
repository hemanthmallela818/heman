"use client";

import React, { useState } from 'react';
import { 
  TrendingUp, 
  IndianRupee, 
  Package, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  XCircle,
  Percent
} from 'lucide-react';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

import { useData } from './context';
import Header from './Header';
import VoiceAssistant from './VoiceAssistant';

export default function AnalyticsDashboard() {
  const { 
    data, 
    loading, 
    error, 
    isSyncing,
    toasts, 
    removeToast 
  } = useData();

  const [bestSellersToggle, setBestSellersToggle] = useState('quantity');

  // Chart tailors
  const colors = {
    revenue: '#10b981',
    quantity: '#3b82f6',
    warning: '#f59e0b',
    danger: '#ef4444'
  };

  // Render Skeleton / Loading overlay if first load is pending
  if (loading && data.inventory.length === 0) {
    return (
      <div className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Business Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle size={18} color="var(--emerald)" />
            ) : (
              <XCircle size={18} color="var(--rose)" />
            )}
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>&times;</button>
          </div>
        ))}
      </div>

      {/* Navigation Header */}
      <Header />

      {/* Connection Failure banner if Sheet error exists */}
      {error && (
        <div className="alert-banner alert-red" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed var(--rose)' }}>
          <div className="alert-content">
            <AlertTriangle size={16} />
            <span><strong>Spreadsheet Connection Offline:</strong> {error}. Reverting to local store database cache.</span>
          </div>
        </div>
      )}
      {/* Voice Assistant Widget */}
      <VoiceAssistant />
      {/* KPI Cards Grid */}
      <section className="kpi-grid">
        <div className="kpi-card" style={{ '--accent-color': 'var(--emerald)' }}>
          <div className="kpi-header">
            <span>Total Stock Value (Cost)</span>
            <div className="kpi-icon-container"><IndianRupee size={18} /></div>
          </div>
          <div className="kpi-value">
            ₹{data.kpis.totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">Sum valuation of stock on cost price basis</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--blue)' }}>
          <div className="kpi-header">
            <span>Potential Revenue</span>
            <div className="kpi-icon-container"><TrendingUp size={18} /></div>
          </div>
          <div className="kpi-value">
            ₹{data.kpis.totalPotentialRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">Gross revenue potential at current retail prices</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--emerald)' }}>
          <div className="kpi-header">
            <span>Today's Profit</span>
            <div className="kpi-icon-container"><IndianRupee size={18} /></div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--emerald)' }}>
            ₹{data.kpis.todaysProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">Net profit margins earned from today's sales</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--orange)' }}>
          <div className="kpi-header">
            <span>Today's Revenue</span>
            <div className="kpi-icon-container"><TrendingUp size={18} /></div>
          </div>
          <div className="kpi-value">
            ₹{data.kpis.todaysRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="kpi-subtext">Gross sales revenue generated today</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--amber)' }}>
          <div className="kpi-header">
            <span>Avg Profit Markup</span>
            <div className="kpi-icon-container"><Percent size={18} /></div>
          </div>
          <div className="kpi-value">
            {(data.kpis.averageProfitMargin * 100).toFixed(1)}%
          </div>
          <div className="kpi-subtext">Average markup margin computed per stock row</div>
        </div>

        <div className="kpi-card" style={{ '--accent-color': 'var(--rose)' }}>
          <div className="kpi-header">
            <span>Low Stock Items</span>
            <div className="kpi-icon-container"><Package size={18} /></div>
          </div>
          <div className="kpi-value" style={{ color: data.kpis.lowStockCount > 0 ? 'var(--rose)' : 'var(--text-primary)' }}>
            {data.kpis.lowStockCount}
          </div>
          <div className="kpi-subtext">Items running below ordering trigger (&lt; 10 qty)</div>
        </div>
      </section>

      {/* Critical Stock Expiry or Volume Alerts */}
      {data.inventory.some(i => i.expiryStatus === 'expired-soon-7' || i.quantity < 5) && (
        <section className="dashboard-alerts">
          {data.inventory.filter(i => i.expiryStatus === 'expired-soon-7').map(item => (
            <div key={item.name} className="alert-banner alert-red">
              <div className="alert-content">
                <AlertTriangle size={16} color="var(--rose)" />
                <span>
                  <strong>CRITICAL EXPIRY ALERT:</strong> <strong>{item.name}</strong> expires in <strong>{item.daysToExpiry} days</strong> ({item.expiryDate}). Discounting/clearance suggested.
                </span>
              </div>
            </div>
          ))}
          {data.inventory.filter(i => i.quantity < 3).map(item => (
            <div key={item.name} className="alert-banner alert-amber">
              <div className="alert-content">
                <Package size={16} color="var(--amber)" />
                <span>
                  <strong>CRITICAL STOCK SHORTAGE:</strong> <strong>{item.name}</strong> has dropped to <strong>{item.quantity} {item.units}</strong>. Please restock.
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Charts Visualization Section */}
      <section className="charts-grid">
        {/* Trend Area Chart (Sales over time) */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <h2>Revenue Trend</h2>
              <p>Daily store sales revenue based on normalized transactions</p>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={12} /> Live tracking window
            </div>
          </div>
          <div className="chart-wrapper">
            {data.revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenueTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.revenue} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={colors.revenue} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickLine={false}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0d1527', 
                      borderColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-family)',
                      fontSize: '0.8rem'
                    }}
                    formatter={(val) => [`₹${val.toFixed(2)}`, 'Revenue']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke={colors.revenue} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No transaction ledger values found to map trend.</div>
            )}
          </div>
        </div>

        {/* Best Sellers Bar Chart */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div className="chart-title">
              <h2>Best-Selling Products</h2>
              <p>Top performant items sorted by retail sales</p>
            </div>
            <div className="chart-controls">
              <button 
                className={`chart-btn ${bestSellersToggle === 'quantity' ? 'active' : ''}`}
                onClick={() => setBestSellersToggle('quantity')}
              >
                Qty Sold
              </button>
              <button 
                className={`chart-btn ${bestSellersToggle === 'revenue' ? 'active' : ''}`}
                onClick={() => setBestSellersToggle('revenue')}
              >
                Revenue
              </button>
            </div>
          </div>
          <div className="chart-wrapper">
            {data.bestSellers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.bestSellers.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickLine={false} 
                    tickFormatter={(val) => bestSellersToggle === 'revenue' ? `₹${val}` : val}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="var(--text-muted)" 
                    fontSize={9} 
                    tickLine={false} 
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0d1527', 
                      borderColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-family)',
                      fontSize: '0.8rem'
                    }}
                    formatter={(val) => [bestSellersToggle === 'revenue' ? `₹${val.toFixed(2)}` : val, bestSellersToggle === 'revenue' ? 'Revenue' : 'Units Sold']}
                  />
                  <Bar 
                    dataKey={bestSellersToggle === 'revenue' ? 'revenue' : 'quantity'} 
                    radius={[0, 4, 4, 0]}
                  >
                    {data.bestSellers.slice(0, 5).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={bestSellersToggle === 'revenue' ? colors.revenue : colors.quantity} 
                        fillOpacity={0.8 - (index * 0.1)} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No sales transactions available to aggregate.</div>
            )}
          </div>
        </div>
      </section>

      {/* Footer info */}
      <footer style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <p>Smart Store Analytics Dashboard &bull; Live Google Sheets Integration</p>
      </footer>
    </div>
  );
}
