import React from 'react';
import { Search, Building2, Bell, UserCheck, ChevronDown } from 'lucide-react';

interface NavbarProps {
  isOnline: boolean;
  selectedEntity: string;
  onSelectEntity: (name: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isOnline,
  selectedEntity,
}) => {
  return (
    <header className="navbar">
      {/* Global Search Bar (Tickets, Assets, Users) */}
      <div className="search-box">
        <Search size={16} color="#9ca3af" />
        <input
          type="text"
          className="search-input"
          placeholder="Search tickets, assets, IP addresses, users..."
        />
        <span className="kbd">Ctrl+K</span>
      </div>

      <div className="navbar-actions">
        {/* Active Entity Selector (GLPI-specific hallmark feature) */}
        <div className="entity-selector" title="Active entity in multi-tenant hierarchy">
          <Building2 size={16} color="#60a5fa" />
          <div className="entity-label">
            <span className="entity-title">Active Entity</span>
            <span className="entity-name">{selectedEntity}</span>
          </div>
          <ChevronDown size={14} color="#9ca3af" />
        </div>

        {/* Live Rust Backend Connection Indicator */}
        <div className={`connection-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className={`pulse-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span>{isOnline ? 'Rust API Online' : 'Rust API Offline'}</span>
        </div>

        {/* Notifications */}
        <button
          className="btn btn-secondary"
          style={{ padding: '0.5rem', borderRadius: '50%', width: 36, height: 36, justifyContent: 'center' }}
          title="Ticket & SLA Notifications"
        >
          <Bell size={16} />
        </button>

        {/* User Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#1e3a8a',
              color: '#93c5fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '2px solid rgba(59, 130, 246, 0.4)',
            }}
          >
            AD
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>alex_admin</span>
            <span style={{ fontSize: '0.7rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 3 }}>
              <UserCheck size={11} /> Super-Admin
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
