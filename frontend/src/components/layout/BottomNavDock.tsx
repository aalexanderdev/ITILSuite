import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutGrid,
  LifeBuoy,
  Plus,
  Server,
  FolderTree,
  Users,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BottomNavDockProps {
  activeNav: string;
  onSelectNav: (id: string) => void;
  onOpenCreateTicket?: () => void;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeNav,
  onSelectNav,
  onOpenCreateTicket,
}) => {
  const { user, setLoginModalOpen } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="bottom-dock-wrapper">
      {/* Toggle Handle 'Menú' */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="bottom-dock-toggle"
        title={isCollapsed ? 'Show Navigation Menu' : 'Hide Navigation Menu'}
      >
        {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <span>Menú</span>
      </button>

      {/* Floating Pill Dock Bar */}
      {!isCollapsed && (
        <nav className="bottom-dock-bar">
          {/* Dashboard / Panel */}
          <button
            onClick={() => onSelectNav('dashboard')}
            className={`dock-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            title="Service Desk Dashboard"
          >
            <LayoutGrid size={16} />
            <span>Panel</span>
          </button>

          {/* Tickets */}
          <button
            onClick={() => onSelectNav('tickets')}
            className={`dock-item ${activeNav === 'tickets' ? 'active' : ''}`}
            title="Incidents & Service Requests"
          >
            <LifeBuoy size={16} />
            <span>Tickets</span>
            <span className="dock-badge">12</span>
          </button>

          {/* Primary Quick Create Button */}
          <button
            onClick={() => {
              if (onOpenCreateTicket) onOpenCreateTicket();
              else alert('Create Ticket dialog scheduled for v0.0.3');
            }}
            className="dock-item-create"
            title="Create New Ticket / Incident"
          >
            <Plus size={16} />
            <span>Crear</span>
          </button>

          {/* Inventory / CMDB */}
          <button
            onClick={() => onSelectNav('computers')}
            className={`dock-item ${activeNav === 'computers' || activeNav === 'inventory' ? 'active' : ''}`}
            title="Assets & CMDB Inventory"
          >
            <Server size={16} />
            <span>Inventario</span>
            <span className="dock-badge">180</span>
          </button>

          {/* Organizational Entity Tree (v0.0.2) */}
          <button
            onClick={() => onSelectNav('entities')}
            className={`dock-item ${activeNav === 'entities' ? 'active' : ''}`}
            title="Hierarchical Entity Tree"
          >
            <FolderTree size={16} />
            <span>Entidades</span>
          </button>

          {/* Users & RBAC Profiles (v0.0.2) */}
          <button
            onClick={() => onSelectNav('users')}
            className={`dock-item ${activeNav === 'users' ? 'active' : ''}`}
            title="User Directory & RBAC Profiles"
          >
            <Users size={16} />
            <span>Usuarios</span>
          </button>

          {/* Profile / Account */}
          <button
            onClick={() => {
              if (!user) setLoginModalOpen(true);
              else alert(`User profile: ${user.display_name} (${user.profile_name})`);
            }}
            className="dock-item"
            title={user ? `${user.display_name} (${user.profile_name})` : 'Sign In'}
          >
            <User size={16} />
            <span>{user ? user.username : 'Perfil'}</span>
          </button>
        </nav>
      )}
    </div>
  );
};
