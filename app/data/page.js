"use client";

import React, { useState } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Layers, 
  ShoppingCart, 
  Save, 
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  IndianRupee
} from 'lucide-react';

import { useData } from '../context';
import Header from '../Header';

export default function DataManager() {
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
    handleDiscardAllChanges
  } = useData();

  // Tab and filtering states
  const [activeTab, setActiveTab] = useState('inventory');
  
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySort, setInventorySort] = useState({ key: 'name', desc: false });
  const [inventoryFilter, setInventoryFilter] = useState('all');
  
  const [salesSearch, setSalesSearch] = useState('');
  const [salesSort, setSalesSort] = useState({ key: 'date', desc: true });
  const [salesItemFilter, setSalesItemFilter] = useState('all');
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');

  // Inline editing state
  const [editingCell, setEditingCell] = useState(null); // { tab, row, colName }
  const [editValue, setEditValue] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(null); // null or { targetCell }

  // Check if there are unsaved edits in other rows or tabs
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

  const handleCellClick = (tab, row, colName, currentValue) => {
    const isUnsavedElsewhere = checkHasPendingChangesInDifferentRow(tab, row);
    
    if (isUnsavedElsewhere) {
      setShowConfirmModal({ targetCell: { tab, row, colName, currentValue } });
      return;
    }

    setEditingCell({ tab, row, colName });
    const pendingKey = `${row}-${colName}`;
    const pendingVal = pendingChanges[tab]?.[pendingKey]?.value;
    setEditValue(pendingVal !== undefined ? pendingVal : currentValue);
  };

  // Convert column UI name to JSON key
  const mapColNameToKey = (colName) => {
    switch (colName.toLowerCase()) {
      case 'item name': return 'name';
      case 'quantity': return 'quantity';
      case 'units': return 'units';
      case 'cost price': return 'costPrice';
      case 'selling price': return 'sellingPrice';
      case 'expiry date': return 'expiryDate';
      case 'total price': return 'totalPrice';
      case 'date': return 'date';
      default: return colName;
    }
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const { tab, row, colName } = editingCell;
    
    let originalValue = '';
    if (tab === 'Inventory') {
      const item = data.inventory.find(i => i.row === row);
      originalValue = item ? item[mapColNameToKey(colName)] : '';
    } else {
      const item = data.sales.find(i => i.row === row);
      originalValue = item ? item[mapColNameToKey(colName)] : '';
    }

    if (String(editValue).trim() !== String(originalValue).trim()) {
      setPendingChanges(prev => {
        const tabEdits = prev[tab] || {};
        return {
          ...prev,
          [tab]: {
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
        const tabEdits = { ...(prev[tab] || {}) };
        delete tabEdits[`${row}-${colName}`];
        const newPrev = { ...prev, [tab]: tabEdits };
        if (Object.keys(newPrev[tab]).length === 0) {
          delete newPrev[tab];
        }
        return newPrev;
      });
    }

    setEditingCell(null);
  };

  const handleConfirmModalAction = (action) => {
    if (!showConfirmModal) return;
    const { tab, row, colName, currentValue } = showConfirmModal.targetCell;

    if (action === 'save') {
      handleSaveToSheets().then(() => {
        setShowConfirmModal(null);
        setEditingCell({ tab, row, colName });
        setEditValue(currentValue);
      });
    } else if (action === 'discard') {
      handleDiscardAllChanges();
      setShowConfirmModal(null);
      setEditingCell({ tab, row, colName });
      setEditValue(currentValue);
    } else {
      setShowConfirmModal(null);
    }
  };

  const handleSort = (tab, key) => {
    if (tab === 'inventory') {
      setInventorySort(prev => ({
        key,
        desc: prev.key === key ? !prev.desc : false
      }));
    } else {
      setSalesSort(prev => ({
        key,
        desc: prev.key === key ? !prev.desc : false
      }));
    }
  };

  // Filter & Sort inventory
  const getFilteredInventory = () => {
    let list = [...data.inventory];

    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.units.toLowerCase().includes(q)
      );
    }

    if (inventoryFilter !== 'all') {
      if (inventoryFilter === 'low-stock') {
        list = list.filter(item => item.quantity < 10);
      } else if (inventoryFilter === 'expired-soon-7') {
        list = list.filter(item => item.expiryStatus === 'expired-soon-7');
      } else if (inventoryFilter === 'expired-soon-30') {
        list = list.filter(item => item.expiryStatus === 'expired-soon-30');
      } else if (inventoryFilter === 'non-perishable') {
        list = list.filter(item => item.expiryStatus === 'non-perishable');
      }
    }

    list.sort((a, b) => {
      let aVal = a[inventorySort.key];
      let bVal = b[inventorySort.key];
      
      if (typeof aVal === 'string') {
        return inventorySort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        return inventorySort.desc ? bVal - aVal : aVal - bVal;
      }
    });

    return list;
  };

  // Filter & Sort sales
  const getFilteredSales = () => {
    let list = [...data.sales];

    if (salesSearch.trim()) {
      const q = salesSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }

    if (salesItemFilter !== 'all') {
      list = list.filter(s => s.name.toLowerCase() === salesItemFilter.toLowerCase());
    }

    if (salesStartDate) {
      list = list.filter(s => s.date >= salesStartDate);
    }
    if (salesEndDate) {
      list = list.filter(s => s.date <= salesEndDate);
    }

    list.sort((a, b) => {
      let aVal = a[salesSort.key];
      let bVal = b[salesSort.key];
      
      if (typeof aVal === 'string') {
        return salesSort.desc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      } else {
        return salesSort.desc ? bVal - aVal : aVal - bVal;
      }
    });

    return list;
  };

  const getUniqueItemNames = () => {
    const names = data.inventory.map(item => item.name);
    return [...new Set(names)].sort();
  };

  const getRenderValue = (tab, row, colName, fallbackValue) => {
    const pendingVal = pendingChanges[tab]?.[`${row}-${colName}`]?.value;
    return pendingVal !== undefined ? pendingVal : fallbackValue;
  };

  const isCellUnsaved = (tab, row, colName) => {
    return pendingChanges[tab]?.[`${row}-${colName}`] !== undefined;
  };

  const getEditCount = () => {
    let count = 0;
    Object.values(pendingChanges).forEach(tabEdits => {
      count += Object.keys(tabEdits).length;
    });
    return count;
  };

  if (loading && data.inventory.length === 0) {
    return (
      <div className="dashboard-container" style={{ justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading Store Database...</p>
        </div>
      </div>
    );
  }

  const filteredInventoryList = getFilteredInventory();
  const filteredSalesList = getFilteredSales();

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

      {/* Sync Header */}
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

      {/* Database Tables Section */}
      <section className="tables-section">
        <div className="table-tabs-header">
          <div className="tabs-list">
            <button 
              className={`tab-trigger ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <Layers size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Inventory Stock
            </button>
            <button 
              className={`tab-trigger ${activeTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              <ShoppingCart size={14} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
              Sales Ledger
            </button>
          </div>

          {/* Search/Filters */}
          {activeTab === 'inventory' ? (
            <div className="table-controls">
              <div className="search-input-wrapper">
                <Search size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search inventory..." 
                  className="search-input"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                />
              </div>
              <select 
                className="filter-select"
                value={inventoryFilter}
                onChange={(e) => setInventoryFilter(e.target.value)}
              >
                <option value="all">All Inventory Health</option>
                <option value="low-stock">⚠️ Low Stock Limit (&lt;10)</option>
                <option value="expired-soon-7">🔴 Expiring Soon (&lt;7 days)</option>
                <option value="expired-soon-30">🟡 Expiring Soon (&lt;30 days)</option>
                <option value="non-perishable">🟢 Non-Perishables</option>
              </select>
            </div>
          ) : (
            <div className="table-controls">
              <div className="search-input-wrapper">
                <Search size={14} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search sales..." 
                  className="search-input"
                  value={salesSearch}
                  onChange={(e) => setSalesSearch(e.target.value)}
                />
              </div>
              
              <select 
                className="filter-select"
                value={salesItemFilter}
                onChange={(e) => setSalesItemFilter(e.target.value)}
              >
                <option value="all">All Products</option>
                {getUniqueItemNames().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <div className="date-picker-group">
                <Calendar size={14} />
                <input 
                  type="date" 
                  className="date-input" 
                  value={salesStartDate} 
                  onChange={(e) => setSalesStartDate(e.target.value)} 
                  title="Start date filter"
                />
                <span>to</span>
                <input 
                  type="date" 
                  className="date-input" 
                  value={salesEndDate} 
                  onChange={(e) => setSalesEndDate(e.target.value)} 
                  title="End date filter"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Inventory Table */}
        {activeTab === 'inventory' && (
          <div className="table-scroll-container">
            {filteredInventoryList.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('inventory', 'name')}>Item Name <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th onClick={() => handleSort('inventory', 'quantity')}>Quantity <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th>Units</th>
                    <th onClick={() => handleSort('inventory', 'costPrice')}>Cost Price <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th onClick={() => handleSort('inventory', 'sellingPrice')}>Selling Price <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th>Profit Margin</th>
                    <th onClick={() => handleSort('inventory', 'expiryDate')}>Expiry Date <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th>Expiry Alert</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventoryList.map(item => (
                    <tr key={item.row}>
                      {/* Name: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Item name') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Item name', item.name)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Item name' ? (
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
                          getRenderValue('Inventory', item.row, 'Item name', item.name)
                        )}
                      </td>
                      
                      {/* Quantity: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Quantity') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Quantity', item.quantity)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Quantity' ? (
                          <input 
                            type="number" 
                            className="cell-edit-input"
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                            autoFocus
                          />
                        ) : (
                          Number(getRenderValue('Inventory', item.row, 'Quantity', item.quantity)).toLocaleString()
                        )}
                      </td>
                      
                      {/* Units: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Units') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Units', item.units)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Units' ? (
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
                          getRenderValue('Inventory', item.row, 'Units', item.units)
                        )}
                      </td>
                      
                      {/* Cost Price: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Cost price') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Cost price', item.costPrice)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Cost price' ? (
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
                          `₹${Number(getRenderValue('Inventory', item.row, 'Cost price', item.costPrice)).toFixed(2)}`
                        )}
                      </td>
                      
                      {/* Selling Price: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Selling price') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Selling price', item.sellingPrice)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Selling price' ? (
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
                          `₹${Number(getRenderValue('Inventory', item.row, 'Selling price', item.sellingPrice)).toFixed(2)}`
                        )}
                      </td>

                      {/* Profit Margin */}
                      <td>
                        {(() => {
                          const liveCost = Number(getRenderValue('Inventory', item.row, 'Cost price', item.costPrice));
                          const liveSell = Number(getRenderValue('Inventory', item.row, 'Selling price', item.sellingPrice));
                          const liveMargin = liveCost > 0 ? (liveSell - liveCost) / liveCost : 0;
                          return `${(liveMargin * 100).toFixed(1)}%`;
                        })()}
                      </td>
                      
                      {/* Expiry Date: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Inventory', item.row, 'Expiry date') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Inventory', item.row, 'Expiry date', item.expiryDate)}
                      >
                        {editingCell?.tab === 'Inventory' && editingCell?.row === item.row && editingCell?.colName === 'Expiry date' ? (
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
                          getRenderValue('Inventory', item.row, 'Expiry date', item.expiryDate) || '—'
                        )}
                      </td>

                      {/* Alerts */}
                      <td>
                        {item.quantity < 10 && (
                          <span className="badge badge-low-stock" style={{ marginRight: '0.4rem' }}>Low Stock</span>
                        )}
                        {(() => {
                          const liveExpiry = getRenderValue('Inventory', item.row, 'Expiry date', item.expiryDate);
                          if (!liveExpiry) return <span className="badge badge-non-perishable">Non-perishable</span>;
                          const expiryDateObj = new Date(liveExpiry);
                          const todayObj = new Date();
                          todayObj.setHours(0,0,0,0);
                          
                          if (isNaN(expiryDateObj.getTime())) return <span className="badge badge-non-perishable">Invalid Date</span>;
                          
                          const diff = expiryDateObj.getTime() - todayObj.getTime();
                          const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                          
                          if (days <= 7) return <span className="badge badge-expiry-7">Expires soon ({days}d)</span>;
                          if (days <= 30) return <span className="badge badge-expiry-30">Warning ({days}d)</span>;
                          return <span className="badge badge-safe">Safe</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No inventory stock records found matching filters.</div>
            )}
          </div>
        )}

        {/* Tab 2: Sales Table */}
        {activeTab === 'sales' && (
          <div className="table-scroll-container">
            {filteredSalesList.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('sales', 'name')}>Item Name <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th onClick={() => handleSort('sales', 'quantity')}>Quantity Sold <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th>Units</th>
                    <th onClick={() => handleSort('sales', 'totalPrice')}>Total Sales Price <ArrowUpDown size={12} className="sort-indicator" /></th>
                    <th onClick={() => handleSort('sales', 'date')}>Transaction Date <ArrowUpDown size={12} className="sort-indicator" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalesList.map(s => (
                    <tr key={s.row}>
                      {/* Name: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Sales', s.row, 'Item name') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Sales', s.row, 'Item name', s.name)}
                      >
                        {editingCell?.tab === 'Sales' && editingCell?.row === s.row && editingCell?.colName === 'Item name' ? (
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
                          getRenderValue('Sales', s.row, 'Item name', s.name)
                        )}
                      </td>
                      
                      {/* Quantity: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Sales', s.row, 'Quantity') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Sales', s.row, 'Quantity', s.quantity)}
                      >
                        {editingCell?.tab === 'Sales' && editingCell?.row === s.row && editingCell?.colName === 'Quantity' ? (
                          <input 
                            type="number" 
                            className="cell-edit-input"
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleCellSave()}
                            autoFocus
                          />
                        ) : (
                          Number(getRenderValue('Sales', s.row, 'Quantity', s.quantity)).toLocaleString()
                        )}
                      </td>
                      
                      {/* Units: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Sales', s.row, 'Units') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Sales', s.row, 'Units', s.units)}
                      >
                        {editingCell?.tab === 'Sales' && editingCell?.row === s.row && editingCell?.colName === 'Units' ? (
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
                          getRenderValue('Sales', s.row, 'Units', s.units)
                        )}
                      </td>
                      
                      {/* Total Price: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Sales', s.row, 'Total price') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Sales', s.row, 'Total price', s.totalPrice)}
                      >
                        {editingCell?.tab === 'Sales' && editingCell?.row === s.row && editingCell?.colName === 'Total price' ? (
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
                          `₹${Number(getRenderValue('Sales', s.row, 'Total price', s.totalPrice)).toFixed(2)}`
                        )}
                      </td>
                      
                      {/* Date: Editable */}
                      <td 
                        className={`editable-cell ${isCellUnsaved('Sales', s.row, 'Date') ? 'unsaved' : ''}`}
                        onClick={() => handleCellClick('Sales', s.row, 'Date', s.date)}
                      >
                        {editingCell?.tab === 'Sales' && editingCell?.row === s.row && editingCell?.colName === 'Date' ? (
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
                          getRenderValue('Sales', s.row, 'Date', s.date) || '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No transaction ledger records matched filters.</div>
            )}
          </div>
        )}
      </section>

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

      {/* Confirmation Modal */}
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

      <footer style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <p>Smart Store Database Management &bull; Live Google Sheets Integration</p>
      </footer>
    </div>
  );
}
