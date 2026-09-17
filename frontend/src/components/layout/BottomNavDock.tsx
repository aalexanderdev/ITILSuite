import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Tooltip } from '../ui';
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
      <Tooltip content={isCollapsed ? 'Mostrar Dock' : 'Ocultar Dock'} position="top">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bottom-dock-toggle"
          aria-label={isCollapsed ? 'Mostrar Menú de Navegación' : 'Ocultar Menú de Navegación'}
        >
          {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span>Menú</span>
        </button>
      </Tooltip>

      {/* Floating Pill Dock Bar */}
      {!isCollapsed && (
        <nav className="bottom-dock-bar" aria-label="Navegación Rápida">
          {/* Dashboard / Panel */}
          <Tooltip content="Métricas globales y diagnóstico del sistema" position="top">
            <button
              onClick={() => onSelectNav('dashboard')}
              className={`dock-item ${activeNav === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutGrid size={16} />
              <span>Panel</span>
            </button>
          </Tooltip>

          {/* Tickets */}
          <Tooltip content="Mesa de ayuda: gestión de incidentes y requerimientos" position="top">
            <button
              onClick={() => onSelectNav('tickets')}
              className={`dock-item ${activeNav === 'tickets' ? 'active' : ''}`}
            >
              <LifeBuoy size={16} />
              <span>Tickets</span>
              <span className="dock-badge">12</span>
            </button>
          </Tooltip>

          {/* Primary Quick Create Button */}
          <Tooltip content="Crear nuevo incidente o requerimiento con plantillas" position="top">
            <button
              onClick={() => {
                if (onOpenCreateTicket) onOpenCreateTicket();
              }}
              className="dock-item-create"
            >
              <Plus size={16} />
              <span>Crear</span>
            </button>
          </Tooltip>

          {/* Inventory / CMDB */}
          <Tooltip content="Base de datos de gestión de configuración (CMDB)" position="top">
            <button
              onClick={() => onSelectNav('computers')}
              className={`dock-item ${activeNav === 'computers' || activeNav === 'inventory' ? 'active' : ''}`}
            >
              <Server size={16} />
              <span>Inventario</span>
              <span className="dock-badge">180</span>
            </button>
          </Tooltip>

          {/* Organizational Entity Tree (v0.0.2) */}
          <Tooltip content="Jerarquía multi-inquilino de organizaciones y sedes" position="top">
            <button
              onClick={() => onSelectNav('entities')}
              className={`dock-item ${activeNav === 'entities' ? 'active' : ''}`}
            >
              <FolderTree size={16} />
              <span>Entidades</span>
            </button>
          </Tooltip>

          {/* Users & RBAC Profiles (v0.0.2) */}
          <Tooltip content="Directorio de usuarios y perfiles de acceso ITIL" position="top">
            <button
              onClick={() => onSelectNav('users')}
              className={`dock-item ${activeNav === 'users' ? 'active' : ''}`}
            >
              <Users size={16} />
              <span>Usuarios</span>
            </button>
          </Tooltip>

          {/* Profile / Account */}
          <Tooltip
            content={user ? `Sesión activa: ${user.display_name} (${user.profile_name})` : 'Iniciar sesión en la suite'}
            position="top"
          >
            <button
              onClick={() => {
                if (!user) setLoginModalOpen(true);
                else alert(`User profile: ${user.display_name} (${user.profile_name})`);
              }}
              className="dock-item"
            >
              <User size={16} />
              <span>{user ? user.username : 'Perfil'}</span>
            </button>
          </Tooltip>
        </nav>
      )}
    </div>
  );
};
