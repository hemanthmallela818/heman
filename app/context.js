"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [data, setData] = useState({
    inventory: [],
    sales: [],
    kpis: {
      totalStockValue: 0,
      totalPotentialRevenue: 0,
      totalItemsTracked: 0,
      lowStockCount: 0,
      averageProfitMargin: 0,
      todaysRevenue: 0,
      todaysProfit: 0
    },
    revenueTrend: [],
    bestSellers: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMock, setIsMock] = useState(true);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  
  const [lastSynced, setLastSynced] = useState(null);
  const [syncSecondsAgo, setSyncSecondsAgo] = useState(0);
  
  const [pendingChanges, setPendingChanges] = useState({});
  const [toasts, setToasts] = useState([]);

  const syncTimerRef = useRef(null);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchData = async (isSilent = false) => {
    if (isSilent) {
      setIsSyncing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setIsMock(result.isMock);
        setSpreadsheetId(result.spreadsheetId);
        setLastSynced(new Date());
        setSyncSecondsAgo(0);
        setError(null);
      } else {
        setError(result.error || "Failed to fetch data from API");
        addToast(result.error || "Failed to sync spreadsheet data", "error");
      }
    } catch (err) {
      setError(err.message || "Network error fetching data");
      addToast("Network connection error during sync", "error");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  };

  // Initial fetch and poll setup
  useEffect(() => {
    fetchData(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(pendingChanges).length === 0) {
        fetchData(true);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [pendingChanges]);

  // Sync Timer
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    syncTimerRef.current = setInterval(() => {
      if (lastSynced) {
        const seconds = Math.floor((new Date() - lastSynced) / 1000);
        setSyncSecondsAgo(seconds);
      }
    }, 1000);
    return () => clearInterval(syncTimerRef.current);
  }, [lastSynced]);

  const handleSaveToSheets = async () => {
    const updates = [];
    Object.entries(pendingChanges).forEach(([tabName, tabEdits]) => {
      Object.values(tabEdits).forEach(edit => {
        updates.push({
          tab: tabName === 'Inventory' ? 'Inventory' : 'Sales / Transactions',
          row: edit.row,
          colName: edit.colName,
          value: edit.value
        });
      });
    });

    if (updates.length === 0) return;

    try {
      setIsSyncing(true);
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      
      const result = await response.json();
      if (result.success) {
        addToast(`Successfully saved ${result.count} change(s) to Google Sheets`, "success");
        setPendingChanges({});
        await fetchData(true);
      } else {
        addToast(result.error || "Failed to save edits", "error");
      }
    } catch (err) {
      addToast("Network failure saving changes", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiscardAllChanges = () => {
    setPendingChanges({});
    addToast("All unsaved changes discarded", "success");
  };

  return (
    <DataContext.Provider value={{
      data,
      loading,
      error,
      isSyncing,
      isMock,
      spreadsheetId,
      lastSynced,
      syncSecondsAgo,
      pendingChanges,
      setPendingChanges,
      toasts,
      addToast,
      removeToast,
      fetchData,
      handleSaveToSheets,
      handleDiscardAllChanges
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
