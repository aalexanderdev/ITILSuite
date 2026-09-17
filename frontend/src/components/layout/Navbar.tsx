import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchEntities } from '../../services/api';
import type { EntityTreeNode } from '../../types';
import {
  Search,
  Building2,
  ChevronDown,
  LogIn,
  LogOut,
  FolderTree,
  Check,
  Plus,
  MessageSquare,
  Layers,
  Sun,
  Moon,
  Mail,
} from 'lucide-react';

interface NavbarProps {
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  onNavigateEntities?: () => void;
  onNavigateMail?: () => void;
  onOpenCreateTicket?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleChat,
  isChatOpen,
  onNavigateEntities,
  onNavigateMail,
  onOpenCreateTicket,
}) => {
  const { user, activeEntity, setActiveEntity, logout, setLoginModalOpen } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [entities, setEntities] = useState<EntityTreeNode[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEntities()
      .then((data) => setEntities(data))
      .catch(() => {});
  }, [entityDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setEntityDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const flattenNodes = (nodes: EntityTreeNode[], list: EntityTreeNode[] = []): EntityTreeNode[] => {
    for (const node of nodes) {
      list.push(node);
      if (node.children && node.children.length > 0) {
        flattenNodes(node.children, list);
      }
    }
    return list;
  };

  const flatEntities = flattenNodes(entities);

  const getInitial = (name: string) => {
    return name.trim().charAt(0).toUpperCase() || 'A';
  };

  return (
    <header className="openitil-navbar">
      {/* Brand & Entity Selector */}
      <div className="navbar-left">
        <div className="navbar-brand">
          <div className="brand-logo-badge">
            <Layers size={17} />
          </div>
          <span className="brand-title">ITILSuite</span>
          <span className="brand-pill">ITSM</span>
        </div>

        {/* Multi-Tenant Entity Selector Dropdown */}
        <div className="dropdown-container" ref={dropdownRef}>
          <button
            onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
            className="navbar-entity-pill"
            title="Active tenant entity in GLPI hierarchy"
          >
            <Building2 size={14} color="#60a5fa" />
            <span className="entity-pill-name">{activeEntity.name}</span>
            <ChevronDown size={13} color="#9ca3af" />
          </button>

          {entityDropdownOpen && (
            <div className="dropdown-menu entity-menu-popover">
              <div className="entity-menu-header">
                <span>SELECT TENANT SCOPE</span>
                {onNavigateEntities && (
                  <button
                    onClick={() => {
                      setEntityDropdownOpen(false);
                      onNavigateEntities();
                    }}
                    className="btn-icon"
                    title="Open Entity Hierarchy Tree"
                    style={{ color: '#60a5fa' }}
                  >
                    <FolderTree size={14} />
                  </button>
                )}
              </div>

              <div className="entity-menu-body">
                {flatEntities.length === 0 ? (
                  <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Loading entities...
                  </div>
                ) : (
                  flatEntities.map((ent) => {
                    const isSelected = activeEntity.id === ent.id;
                    return (
                      <button
                        key={ent.id}
                        onClick={() => {
                          setActiveEntity({ id: ent.id, name: ent.name });
                          setEntityDropdownOpen(false);
                        }}
                        className={`dropdown-item ${isSelected ? 'active' : ''}`}
                        style={{
                          paddingLeft: `${0.75 + ent.level * 0.9}rem`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                          <Building2 size={13} color={isSelected ? '#60a5fa' : '#9ca3af'} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ent.name}
                          </span>
                        </div>
                        {isSelected && <Check size={14} color="#34d399" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Search Pill */}
      <div className="navbar-center">
        <div className="search-pill-container">
          <Search size={15} color="#9ca3af" />
          <input
            type="text"
            className="search-pill-input"
            placeholder="Buscar tickets, activos, números de serie, usuarios..."
          />
          <span className="kbd">Ctrl+K</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="navbar-right">
        {/* Light / Dark Mode Toggle Button (OpenITIL Inspired) */}
        <button
          onClick={toggleTheme}
          className="btn-icon-pill"
          title={theme === 'dark' ? 'Cambiar a modo Claro (Light)' : 'Cambiar a modo Oscuro (Dark)'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Mail & Notifications Settings */}
        {onNavigateMail && (
          <button
            onClick={onNavigateMail}
            className="btn-icon-pill"
            title="Configuración de Notificaciones y Correo (SMTP / Colectores)"
          >
            <Mail size={16} />
          </button>
        )}

        {/* Quick New Ticket Button */}
        <button
          onClick={() => {
            if (onOpenCreateTicket) onOpenCreateTicket();
            else alert('ITIL Ticket creation workflow scheduled for v0.0.3');
          }}
          className="btn-pill-primary"
          title="Create New Support Ticket"
        >
          <Plus size={15} />
          <span>Nuevo Ticket</span>
        </button>

        {/* Chat Dock Toggle Button */}
        <button
          onClick={onToggleChat}
          className={`btn-icon-pill ${isChatOpen ? 'active' : ''}`}
          title={isChatOpen ? 'Close Support Chat' : 'Open Support Chat'}
        >
          <MessageSquare size={17} />
          <span className="pill-dot-badge" />
        </button>

        {/* User Profile Pill */}
        {user ? (
          <div className="user-profile-pill">
            <div className="user-avatar-circle">
              {getInitial(user.display_name || user.username)}
            </div>
            <div className="user-info-text">
              <span className="user-display-name">{user.display_name || user.username}</span>
              <span className="user-role-badge">{user.profile_name}</span>
            </div>
            <button
              onClick={logout}
              className="user-logout-btn"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setLoginModalOpen(true)}
            className="btn-pill-secondary"
          >
            <LogIn size={15} />
            <span>Ingresar</span>
          </button>
        )}
      </div>
    </header>
  );
};
