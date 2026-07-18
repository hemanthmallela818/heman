"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Database, 
  CreditCard,
  Coins,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { useData } from './context';

export default function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMock, isSyncing, lastSynced, syncSecondsAgo, fetchData } = useData();

  // Determine current active page state cleanly
  const tab = searchParams ? searchParams.get('tab') || 'inventory' : 'inventory';
  
  const isDashboardActive = pathname === '/';
  const isInventoryActive = pathname === '/data' && tab === 'inventory';
  const isTransactionsActive = pathname === '/data' && tab === 'sales';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand logo & title matching the Catalog 'C' circle logo */}
      <div className="sidebar-logo">
        <div style={{
          width: '1.75rem',
          height: '1.75rem',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 700
        }}>C</div>
        <span>Catalog</span>
      </div>

      {/* Sidebar navigation list (filtered to requested pages only) */}
      <ul className="sidebar-menu">
        <li className={`sidebar-item ${isDashboardActive ? 'active' : ''}`}>
          <Link href="/">
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>
        </li>
        <li className={`sidebar-item ${isInventoryActive ? 'active' : ''}`}>
          <Link href="/data?tab=inventory">
            <Database size={18} />
            <span>Inventory</span>
          </Link>
        </li>
        <li className={`sidebar-item ${isTransactionsActive ? 'active' : ''}`}>
          <Link href="/data?tab=sales">
            <CreditCard size={18} />
            <span>Transactions</span>
          </Link>
        </li>
        <li className={`sidebar-item ${pathname === '/credits' ? 'active' : ''}`}>
          <Link href="/credits">
            <Coins size={18} />
            <span>Credits</span>
          </Link>
        </li>
      </ul>

      {/* Sidebar Footer containing Sync Status and actual Logout */}
      <div className="sidebar-footer">
        {isMock && (
          <span 
            className="badge" 
            style={{ 
              backgroundColor: 'rgba(234, 179, 8, 0.1)', 
              color: 'var(--amber)', 
              border: '1px solid rgba(234, 179, 8, 0.2)',
              textAlign: 'center',
              width: '100%',
              padding: '0.4rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            Offline Cache Mode
          </span>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0.25rem' }}>
          <div className="sync-status" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className={`sync-dot ${isSyncing ? 'syncing' : ''}`} style={{
              width: '6px',
              height: '6px',
              backgroundColor: isSyncing ? 'var(--amber)' : 'var(--emerald)',
              borderRadius: '50%'
            }}></span>
            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--sidebar-text)' }}>
              {isSyncing ? 'Syncing...' : lastSynced ? `Synced ${syncSecondsAgo}s` : 'Not Synced'}
            </span>
          </div>
          <button 
            className="header-icon-btn" 
            onClick={() => fetchData(false)} 
            disabled={isSyncing}
            style={{ width: '1.85rem', height: '1.85rem', background: 'rgba(255,255,255,0.08)', border: 'none', color: '#ffffff' }}
            title="Refresh from Google Sheets"
          >
            <RefreshCw size={12} className={isSyncing ? 'spin-icon' : ''} />
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="sidebar-item tab-trigger-sidebar"
          style={{ 
            width: '100%',
            padding: '0.65rem 1rem', 
            fontSize: '0.95rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.85rem',
            border: 'none',
            borderRadius: '12px',
            color: '#f87171',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
