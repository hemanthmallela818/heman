"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, LogOut } from 'lucide-react';
import { useData } from './context';

export default function Header() {
  const pathname = usePathname();
  const { isMock, isSyncing, lastSynced, syncSecondsAgo, fetchData } = useData();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (err) {
      console.error("Failed to log out:", err);
    }
  };

  return (
    <header className="top-bar">
      <div className="brand-section">
        <div className="logo-icon">📦</div>
        <div className="logo-text">
          <h1>Smart Store</h1>
          <p>Live Inventory & Sales Analytics</p>
        </div>
        
        {/* Navigation links styled like page tabs */}
        <nav style={{ marginLeft: '3rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link 
            href="/" 
            className={`tab-trigger ${pathname === '/' ? 'active' : ''}`}
          >
            Analytics Overview
          </Link>
          <Link 
            href="/data" 
            className={`tab-trigger ${pathname === '/data' ? 'active' : ''}`}
          >
            Manage Data
          </Link>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ 
              marginLeft: '1rem', 
              padding: '0.35rem 0.75rem', 
              fontSize: '0.8rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.25rem',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              color: 'var(--rose)',
              background: 'transparent',
              minHeight: 'auto'
            }}
            title="Sign out of Admin Session"
          >
            <LogOut size={13} />
            Logout
          </button>
        </nav>
      </div>

      <div className="sync-section">
        {isMock && (
          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.2)' }}>
            Mock Mode (Running Offline)
          </span>
        )}
        <div className="sync-status">
          <span className={`sync-dot ${isSyncing ? 'syncing' : ''}`}></span>
          <span>
            {isSyncing ? 'Syncing...' : lastSynced ? `Synced ${syncSecondsAgo}s ago` : 'Not Synced'}
          </span>
        </div>
        <button 
          className="btn-icon" 
          onClick={() => fetchData(false)} 
          disabled={isSyncing}
          title="Refresh from Google Sheets"
        >
          <RefreshCw size={16} className={isSyncing ? 'spin-icon' : ''} />
        </button>
      </div>
    </header>
  );
}
