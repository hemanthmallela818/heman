"use client";

import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  ArrowUpDown, 
  Coins, 
  Users, 
  TrendingUp, 
  Save, 
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Bell,
  Calendar,
  Layers,
  List
} from 'lucide-react';

import { useData } from '../context';
import Header from '../Header';

function CreditsManager() {
  const {
    data,
    loading,
    error,
    isSyncing,
    pendingChanges,
    setPendingChanges,
    toasts,
    removeToast,
    handleSaveToSheets,
    handleDiscardAllChanges,
    handleAddRow
  } = useData();

  const searchParams = useSearchParams();
  const router = useRouter();

  // Dual-view tab management
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' or 'logs'

  // Search & sorting states
  const [balancesSearch, setBalancesSearch] = useState('');
  const [balancesSort, setBalancesSort] = useState({ key: 'name', desc: false });

  const [logsSearch, setLogsSearch] = useState('');
  const [logsSort, setLogsSort] = useState({ key: 'date', desc: true });
  const [logsStartDate, setLogsStartDate] = useState('');
  const [logsEndDate, setLogsEndDate] = useState('');

  // Inline editing states
  const [editingCell, setEditingCell] = useState(null); // { view: 'balances'|'logs', row, colName, rowsToCascade: [] }
  const [editValue, setEditValue] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(null); // null or { targetCell }

  // Add Credit modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact: '', address: '', amount: '', date: '', customerSelect: '' });
  const [showConfirmAdd, setShowConfirmAdd] = useState(null); // null or rowData

  // Unsaved changes validation
  const checkHasPendingChangesInDifferentRow = (tab, row) => {
    let differentRowExists = false;
    Object.entries(pendingChanges).forEach(([tabName, tabEdits]) => {
      Object.values(tabEdits).forEach(edit => {
        if (tabName !== tab || edit.row !== row) {
          differentRowExists = true;
        }
      });
    });
    return differentRowExists;
  };

  const handleCellClick = (view, row, colName, currentValue, rowsToCascade = null) => {
    // If saving in logs, use the sheet row number. If balances, use the first row index to check block edits.
    const checkRow = view === 'balances' && rowsToCascade ? rowsToCascade[0] : row;
    const isUnsavedElsewhere = checkHasPendingChangesInDifferentRow('Credits', checkRow);
    
    if (isUnsavedElsewhere) {
      setShowConfirmModal({ targetCell: { view, row, colName, currentValue, rowsToCascade } });
      return;
    }

    setEditingCell({ view, row, colName, rowsToCascade });
    
    // For pending change key lookup
    const pendingKey = `${checkRow}-${colName}`;
    const pendingVal = pendingChanges['Credits']?.[pendingKey]?.value;
    setEditValue(pendingVal !== undefined ? pendingVal : currentValue);
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { view, row, colName, rowsToCascade } = editingCell;
    
    if (view === 'logs') {
      const logItem = data.creditsLogs?.find(l => l.row === row);
      let originalValue = '';
      if (logItem) {
        if (colName === 'User name ') originalValue = logItem.name;
        else if (colName === 'Contact no') originalValue = logItem.contact;
        else if (colName === 'Adrdress') originalValue = logItem.address;
        else if (colName === 'Credit amount') originalValue = logItem.creditAmount;
        else if (colName === 'Date') originalValue = logItem.date;
      }

      if (String(editValue).trim() !== String(originalValue).trim()) {
        setPendingChanges(prev => {
          const tabEdits = prev['Credits'] || {};
          return {
            ...prev,
            ['Credits']: {
              ...tabEdits,
              [`${row}-${colName}`]: {
                row,
                colName,
                value: editValue,
                originalValue
              }
            }
          };
        });
      } else {
        setPendingChanges(prev => {
          const tabEdits = { ...(prev['Credits'] || {}) };
          delete tabEdits[`${row}-${colName}`];
          const newPrev = { ...prev, ['Credits']: tabEdits };
          if (Object.keys(newPrev['Credits']).length === 0) {
            delete newPrev['Credits'];
          }
          return newPrev;
        });
      }
    } else if (view === 'balances' && rowsToCascade) {
      // Cascading updates: write changes to ALL sheet row indices representing this customer
      const aggregatedItem = data.credits?.find(c => c.id === row);
      const originalValue = aggregatedItem ? aggregatedItem.name : '';

      if (String(editValue).trim() !== String(originalValue).trim()) {
        setPendingChanges(prev => {
          let tabEdits = { ...(prev['Credits'] || {}) };
          rowsToCascade.forEach(r => {
            tabEdits[`${r}-${colName}`] = {
              row: r,
              colName,
              value: editValue,
              originalValue
            };
          });
          return {
            ...prev,
            ['Credits']: tabEdits
          };
        });
      } else {
        setPendingChanges(prev => {
          let tabEdits = { ...(prev['Credits'] || {}) };
          rowsToCascade.forEach(r => {
            delete tabEdits[`${r}-${colName}`];
          });
          const newPrev = { ...prev, ['Credits']: tabEdits };
          if (Object.keys(newPrev['Credits']).length === 0) {
            delete newPrev['Credits'];
          }
          return newPrev;
        });
      }
    }

    setEditingCell(null);
  };

  const handleConfirmModalAction = (action) => {
    if (!showConfirmModal) return;
    const { view, row, colName, currentValue, rowsToCascade } = showConfirmModal.targetCell;

    if (action === 'save') {
      handleSaveToSheets().then(() => {
        setShowConfirmModal(null);
        setEditingCell({ view, row, colName, rowsToCascade });
        setEditValue(currentValue);
      });
    } else if (action === 'discard') {
      handleDiscardAllChanges();
      setShowConfirmModal(null);
      setEditingCell({ view, row, colName, rowsToCascade });
      setEditValue(currentValue);
    } else {
      setShowConfirmModal(null);
    }
  };

  const handleSortBalances = (key) => {
    setBalancesSort(prev => ({
      key,
      desc: prev.key === key ? !prev.desc : false
    }));
  };

  const handleSortLogs = (key) => {
    setLogsSort(prev => ({
      key,
      desc: prev.key === key ? !prev.desc : false
    }));
  };

  const handleOpenAddModal = () => {
    setFormData({
      customerSelect: '',
      name: '',
      contact: '',
      address: '',
      amount: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAddModal(true);
  };

  const handleCustomerSelectChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      setFormData(prev => ({
        ...prev,
        customerSelect: 'custom',
        name: '',
        contact: '',
        address: ''
      }));
    } else if (val) {
      const customer = data.credits.find(c => c.name.toLowerCase() === val.toLowerCase());
      if (customer) {
        setFormData(prev => ({
          ...prev,
          customerSelect: val,
          name: customer.name,
          contact: customer.contact,
          address: customer.address
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        customerSelect: '',
        name: '',
        contact: '',
        address: ''
      }));
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const finalName = formData.customerSelect === 'custom' ? formData.name.trim() : formData.name;
    
    if (!finalName || !finalName.trim()) return alert("Customer Name is required");
    if (formData.amount === '' || isNaN(formData.amount)) return alert("Credit Amount is required");
    if (!formData.date) return alert("Transaction Date is required");

    const rowData = {
      "User name ": finalName.trim(),
      "Contact no": formData.contact ? formData.contact.trim() : '',
      "Adrdress": formData.address ? formData.address.trim() : '',
      "Credit amount": formData.amount.trim(),
      "Date": formData.date
    };

    setShowConfirmAdd(rowData);
  };

  const handleConfirmAddAction = async () => {
    if (!showConfirmAdd) return;
    const result = await handleAddRow('Credits', showConfirmAdd);
    if (result.success) {
      setShowConfirmAdd(null);
      setShowAddModal(false);
    }
  };

  // Get filtered balances list
  const getFilteredBalances = () => {
    if (!data.credits) return [];
    let list = [...data.credits];

    if (balancesSearch.trim()) {
      const q = balancesSearch.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let aVal = a[balancesSort.key];
      let bVal = b[balancesSort.key];
      
      if (typeof aVal === 'string') {
        return balancesSort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        return balancesSort.desc ? bVal - aVal : aVal - bVal;
      }
    });

    return list;
  };

  // Get filtered raw logs list
  const getFilteredLogs = () => {
    if (!data.creditsLogs) return [];
    let list = [...data.creditsLogs];

    if (logsSearch.trim()) {
      const q = logsSearch.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(q));
    }

    if (logsStartDate) {
      list = list.filter(item => item.date >= logsStartDate);
    }
    if (logsEndDate) {
      list = list.filter(item => item.date <= logsEndDate);
    }

    list.sort((a, b) => {
      let aVal = a[logsSort.key];
      let bVal = b[logsSort.key];
      
      if (typeof aVal === 'string') {
        return logsSort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        return logsSort.desc ? bVal - aVal : aVal - bVal;
      }
    });

    return list;
  };

  const getRenderValue = (row, colName, fallbackValue) => {
    const pendingVal = pendingChanges['Credits']?.[`${row}-${colName}`]?.value;
    return pendingVal !== undefined ? pendingVal : fallbackValue;
  };

  const isCellUnsaved = (row, colName) => {
    return pendingChanges['Credits']?.[`${row}-${colName}`] !== undefined;
  };

  // For balances view checks
  const isBalanceCellUnsaved = (rowsToCascade, colName) => {
    if (!rowsToCascade || rowsToCascade.length === 0) return false;
    // If any cascaded row index has pending changes, mark cell as unsaved
    return rowsToCascade.some(r => pendingChanges['Credits']?.[`${r}-${colName}`] !== undefined);
  };

  const getEditCount = () => {
    let count = 0;
    Object.values(pendingChanges).forEach(tabEdits => {
      count += Object.keys(tabEdits).length;
    });
    return count;
  };

  if (loading && (!data.credits || data.credits.length === 0)) {
    return (
      <div className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Customer Credits...</p>
        </div>
      </div>
    );
  }

  const uniqueCustomerNames = data.credits ? data.credits.map(c => c.name) : [];
  const filteredBalancesList = getFilteredBalances();
  const filteredLogsList = getFilteredLogs();

  // Metrics
  const outstandingAmount = data.kpis?.totalCreditsAmount || 0;
  const activeAccountsCount = data.kpis?.totalCreditsCustomers || 0;
  const avgCreditPerAccount = activeAccountsCount > 0 ? outstandingAmount / activeAccountsCount : 0;

  // Build table JSX dynamically to avoid complex nesting in return
  let tableContent = null;
  if (activeTab === 'balances') {
    if (filteredBalancesList.length > 0) {
      tableContent = (
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSortBalances('name')} style={{ cursor: 'pointer' }}>Customer Name <ArrowUpDown size={12} className="sort-indicator" /></th>
              <th>Contact No</th>
              <th>Address</th>
              <th onClick={() => handleSortBalances('creditAmount')} style={{ cursor: 'pointer' }}>Total Balance <ArrowUpDown size={12} className="sort-indicator" /></th>
            </tr>
          </thead>
          <tbody>
            {filteredBalancesList.map(item => (
              <tr key={item.id}>
                <td 
                  className={`editable-cell ${isBalanceCellUnsaved(item.rows, 'User name ') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('balances', item.id, 'User name ', item.name, item.rows)}
                >
                  {editingCell?.view === 'balances' && editingCell?.row === item.id && editingCell?.colName === 'User name ' ? (
                    <input 
                      type="text" 
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    item.rows && item.rows.length > 0 
                      ? getRenderValue(item.rows[0], 'User name ', item.name)
                      : item.name
                  )}
                </td>
                <td>{item.contact || '—'}</td>
                <td>{item.address || '—'}</td>
                <td>
                  {(() => {
                    let sum = 0;
                    if (item.rows) {
                      item.rows.forEach(r => {
                        const logItem = data.creditsLogs?.find(l => l.row === r);
                        const defaultVal = logItem ? logItem.creditAmount : 0;
                        sum += Number(getRenderValue(r, 'Credit amount', defaultVal));
                      });
                    }
                    return `₹${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      tableContent = <div className="empty-state">No customer balances found.</div>;
    }
  } else {
    if (filteredLogsList.length > 0) {
      tableContent = (
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSortLogs('date')} style={{ cursor: 'pointer' }}>Date <ArrowUpDown size={12} className="sort-indicator" /></th>
              <th onClick={() => handleSortLogs('name')} style={{ cursor: 'pointer' }}>Customer Name <ArrowUpDown size={12} className="sort-indicator" /></th>
              <th>Contact no</th>
              <th>Address</th>
              <th onClick={() => handleSortLogs('creditAmount')} style={{ cursor: 'pointer' }}>Credit Amount <ArrowUpDown size={12} className="sort-indicator" /></th>
            </tr>
          </thead>
          <tbody>
            {filteredLogsList.map(item => (
              <tr key={item.row}>
                <td 
                  className={`editable-cell ${isCellUnsaved(item.row, 'Date') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('logs', item.row, 'Date', item.date)}
                >
                  {editingCell?.view === 'logs' && editingCell?.row === item.row && editingCell?.colName === 'Date' ? (
                    <input 
                      type="date" 
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    getRenderValue(item.row, 'Date', item.date) || '—'
                  )}
                </td>
                <td 
                  className={`editable-cell ${isCellUnsaved(item.row, 'User name ') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('logs', item.row, 'User name ', item.name)}
                >
                  {editingCell?.view === 'logs' && editingCell?.row === item.row && editingCell?.colName === 'User name ' ? (
                    <input 
                      type="text" 
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    getRenderValue(item.row, 'User name ', item.name)
                  )}
                </td>
                <td 
                  className={`editable-cell ${isCellUnsaved(item.row, 'Contact no') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('logs', item.row, 'Contact no', item.contact)}
                >
                  {editingCell?.view === 'logs' && editingCell?.row === item.row && editingCell?.colName === 'Contact no' ? (
                    <input 
                      type="text" 
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    getRenderValue(item.row, 'Contact no', item.contact) || '—'
                  )}
                </td>
                <td 
                  className={`editable-cell ${isCellUnsaved(item.row, 'Adrdress') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('logs', item.row, 'Adrdress', item.address)}
                >
                  {editingCell?.view === 'logs' && editingCell?.row === item.row && editingCell?.colName === 'Adrdress' ? (
                    <input 
                      type="text" 
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    getRenderValue(item.row, 'Adrdress', item.address) || '—'
                  )}
                </td>
                <td 
                  className={`editable-cell ${isCellUnsaved(item.row, 'Credit amount') ? 'unsaved' : ''}`}
                  onClick={() => handleCellClick('logs', item.row, 'Credit amount', item.creditAmount)}
                >
                  {editingCell?.view === 'logs' && editingCell?.row === item.row && editingCell?.colName === 'Credit amount' ? (
                    <input 
                      type="number" 
                      step="0.01"
                      className="cell-edit-input"
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleCellSave}
                      onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                      autoFocus
                    />
                  ) : (
                    `₹${Number(getRenderValue(item.row, 'Credit amount', item.creditAmount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      tableContent = <div className="empty-state">No transaction logs matched filters.</div>;
    }
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

      {/* Sidebar Navigation */}
      <Header />

      {/* Main Panel */}
      <main className="main-content">
        {/* Top Header */}
        <header className="content-header">
          <div className="content-header-left">
            <span className="welcome-text">Accounts & Ledgers 👋</span>
            <h1 className="page-title">Credits Manager</h1>
          </div>
          <div className="content-header-right">
            <div className="header-icons">
              <button className="header-icon-btn" aria-label="Notifications">
                <Bell size={16} />
              </button>
            </div>
            <div className="profile-avatar">
              <div className="avatar-img">A</div>
              <span className="avatar-name">Admin Retailer</span>
            </div>
          </div>
        </header>

        {error && (
          <div className="alert-banner">
            <div className="alert-content">
              <AlertTriangle size={16} />
              <span><strong>Spreadsheet Connection Offline:</strong> {error}. Reverting to local store database cache.</span>
            </div>
          </div>
        )}

        {/* Dashboard Top KPI Summaries */}
        <section className="kpis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper blue" style={{ backgroundColor: 'var(--blue-glow)' }}>
              <Coins size={20} color="var(--blue)" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Outstanding Credits</span>
              <h3 className="kpi-value">₹{outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper emerald" style={{ backgroundColor: 'var(--emerald-glow)' }}>
              <Users size={20} color="var(--emerald)" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Active Credit Accounts</span>
              <h3 className="kpi-value">{activeAccountsCount}</h3>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper orange" style={{ backgroundColor: 'var(--orange-glow)' }}>
              <TrendingUp size={20} color="var(--orange)" />
            </div>
            <div className="kpi-content">
              <span className="kpi-label">Average Balance/Customer</span>
              <h3 className="kpi-value">₹{avgCreditPerAccount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </section>

        {/* Dual-View Dashboard Sections */}
        <section className="tables-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          
          <div className="table-tabs-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="tabs-list">
              <button 
                className={`tab-trigger ${activeTab === 'balances' ? 'active' : ''}`}
                onClick={() => setActiveTab('balances')}
              >
                <Layers size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                Customer Balances
              </button>
              <button 
                className={`tab-trigger ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <List size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
                Transaction Logs
              </button>
            </div>

            {/* Tab Actions */}
            {activeTab === 'balances' ? (
              <div className="table-controls">
                <div className="search-input-wrapper">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search customers..." 
                    className="search-input"
                    value={balancesSearch}
                    onChange={(e) => setBalancesSearch(e.target.value)}
                  />
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={handleOpenAddModal}
                >
                  <Plus size={14} /> Record Entry
                </button>
              </div>
            ) : (
              <div className="table-controls">
                <div className="search-input-wrapper">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search transactions..." 
                    className="search-input"
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                  />
                </div>

                <div className="date-picker-group">
                  <Calendar size={14} />
                  <input 
                    type="date" 
                    className="date-input" 
                    value={logsStartDate} 
                    onChange={(e) => setLogsStartDate(e.target.value)} 
                    title="Start date filter"
                  />
                  <span>to</span>
                  <input 
                    type="date" 
                    className="date-input" 
                    value={logsEndDate} 
                    onChange={(e) => setLogsEndDate(e.target.value)} 
                    title="End date filter"
                  />
                </div>

                <button 
                  className="btn btn-primary"
                  onClick={handleOpenAddModal}
                >
                  <Plus size={14} /> Record Entry
                </button>
              </div>
            )}
          </div>

          {/* Render Active Tab */}
          <div className="table-scroll-container" style={{ flex: 1, overflowY: 'auto' }}>
            {tableContent}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: 'auto', paddingTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <p>Smart Store Credits Ledger &bull; Live Google Sheets Sync</p>
        </footer>
      </main>

      {/* Floating Save Action Bar */}
      {getEditCount() > 0 && (
        <div className="floating-action-bar">
          <div className="floating-text">
            <span className="amber-dot"></span>
            <span>You have <strong>{getEditCount()}</strong> unsaved change(s) pending. Save to spreadsheet?</span>
          </div>
          <div className="floating-buttons">
            <button className="btn btn-secondary" onClick={handleDiscardAllChanges} disabled={isSyncing}>
              <Trash2 size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} /> Discard
            </button>
            <button className="btn btn-primary" onClick={handleSaveToSheets} disabled={isSyncing}>
              <Save size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} /> 
              {isSyncing ? 'Saving...' : 'Save & Recalculate'}
            </button>
          </div>
        </div>
      )}

      {/* Unsaved Edits modal */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3><AlertTriangle color="var(--amber)" size={20} /> Unsaved Edits Pending</h3>
            </div>
            <div className="modal-body">
              <p>You have unsaved changes in your current row. Editing a different item requires saving or discarding those changes first.</p>
              <p style={{ marginTop: '0.5rem', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Choose "Save" to commit edits directly to Google Sheets, or "Discard" to revert them.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => handleConfirmModalAction('cancel')}>Cancel</button>
              <button className="btn btn-secondary" onClick={() => handleConfirmModalAction('discard')} style={{ color: 'var(--rose)', borderColor: 'rgba(239,68,68,0.2)' }}>Discard Previous</button>
              <button className="btn btn-primary" onClick={() => handleConfirmModalAction('save')}>Save & Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Credit Entry Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>
                <Plus size={20} color="var(--emerald)" />
                Record Credit Transaction
              </h3>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label htmlFor="credit-customer">Select Customer</label>
                  <select 
                    id="credit-customer"
                    className="form-input" 
                    style={{ appearance: 'auto' }}
                    value={formData.customerSelect}
                    onChange={handleCustomerSelectChange}
                    required
                  >
                    <option value="">-- Choose Existing Customer --</option>
                    {uniqueCustomerNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="custom">-- Record New Customer --</option>
                  </select>
                </div>
                
                {formData.customerSelect === 'custom' && (
                  <div className="form-group">
                    <label htmlFor="credit-custom-name">Customer/User Name</label>
                    <input 
                      id="credit-custom-name"
                      type="text" 
                      className="form-input" 
                      required 
                      placeholder="Enter customer name"
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                )}

                <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="credit-contact">Contact No (Optional)</label>
                    <input 
                      id="credit-contact"
                      type="text" 
                      className="form-input" 
                      placeholder="Phone number"
                      value={formData.contact} 
                      onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="credit-address">Address (Optional)</label>
                    <input 
                      id="credit-address"
                      type="text" 
                      className="form-input" 
                      placeholder="City/Region"
                      value={formData.address} 
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '0.5rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="credit-amount">Credit Amount (₹)</label>
                    <input 
                      id="credit-amount"
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      required 
                      placeholder="Use negative values for payments"
                      value={formData.amount} 
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="credit-date">Transaction Date</label>
                    <input 
                      id="credit-date"
                      type="date" 
                      className="form-input" 
                      required 
                      value={formData.date} 
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Addition Dialog */}
      {showConfirmAdd && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>
                <AlertTriangle color="var(--amber)" size={20} />
                Confirm Record Addition
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem' }}>Are you sure you want to add this credit entry to the logs database?</p>
              
              <div className="preview-grid">
                <div className="preview-label">Customer Name:</div>
                <div className="preview-value">{showConfirmAdd["User name "]}</div>
                {showConfirmAdd["Contact no"] && (
                  <>
                    <div className="preview-label">Contact No:</div>
                    <div className="preview-value">{showConfirmAdd["Contact no"]}</div>
                  </>
                )}
                {showConfirmAdd["Adrdress"] && (
                  <>
                    <div className="preview-label">Address:</div>
                    <div className="preview-value">{showConfirmAdd["Adrdress"]}</div>
                  </>
                )}
                <div className="preview-label">Credit amount:</div>
                <div className="preview-value">₹{parseFloat(showConfirmAdd["Credit amount"]).toFixed(2)}</div>
                <div className="preview-label">Date:</div>
                <div className="preview-value">{showConfirmAdd["Date"]}</div>
              </div>
              
              <p style={{ marginTop: '1rem', fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                This record will be saved directly to the database.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmAdd(null)}>Go Back</button>
              <button className="btn btn-primary" onClick={handleConfirmAddAction} disabled={isSyncing}>
                {isSyncing ? 'Syncing...' : 'Confirm & Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <div className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center', height: '80vh', border: 'none', background: 'transparent' }}>
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Credits Manager...</p>
        </div>
      </div>
    }>
      <CreditsManager />
    </Suspense>
  );
}
