import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
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
  Mail,
  Sliders,
  Clock,
  HeartHandshake,
  MessageSquare,
  Layers,
  Network,
  Briefcase,
  BookOpen,
  Sun,
  Moon,
  LogOut,
  LogIn,
  Check,
  Building2,
  GitPullRequest,
  Activity,
  Sparkles,
} from 'lucide-react';

interface BottomNavDockProps {
  activeNav: string;
  onSelectNav: (id: string) => void;
  onOpenCreateTicket?: () => void;
}

type DropupMenuKey = 'dashboard' | 'servicedesk' | 'create' | 'inventory' | 'admin' | 'profile' | null;

interface DropupItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  action?: () => void;
}

export const BottomNavDock: React.FC<BottomNavDockProps> = ({
  activeNav,
  onSelectNav,
  onOpenCreateTicket,
}) => {
  const { user, activeEntity, logout, setLoginModalOpen } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openMenu, setOpenMenu] = useState<DropupMenuKey>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // Close dropup when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleToggleMenu = (key: DropupMenuKey) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  const handleItemSelect = (id: string, customAction?: () => void) => {
    setOpenMenu(null);
    if (customAction) {
      customAction();
    } else {
      onSelectNav(id);
    }
  };

  // Category Active Checkers
  const isDashboardActive = activeNav === 'dashboard';
  const isServiceDeskActive = ['tickets', 'slas', 'surveys', 'chat_dashboard', 'chat-analytics', 'chat', 'problems'].includes(activeNav);
  const isInventoryActive = ['computers', 'assets', 'inventory', 'network', 'contracts', 'tools'].includes(activeNav);
  const isAdminActive = ['entities', 'users', 'rules', 'settings', 'mail_config'].includes(activeNav);

  // Definition of Dropup Menus
  const dashboardItems: DropupItem[] = [
    {
      id: 'dashboard',
      label: 'Panel General',
      description: 'Métricas clave, volumen de incidentes y estado ITSM',
      icon: LayoutGrid,
    },
    {
      id: 'dashboard_diag',
      label: 'Diagnóstico del Sistema',
      description: 'Estado de API en Rust, latencia y verificación de base de datos',
      icon: Activity,
      action: () => {
        onSelectNav('dashboard');
        setTimeout(() => {
          const el = document.getElementById('api-diagnostics-card');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
    },
    {
      id: 'dashboard_roadmap',
      label: 'Hoja de Ruta v0.0.8',
      description: 'Progreso de desarrollo y nuevas funciones completadas',
      icon: Sparkles,
      badge: 'v0.0.8',
      action: () => {
        onSelectNav('dashboard');
        setTimeout(() => {
          const el = document.getElementById('roadmap-card');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
    },
  ];

  const serviceDeskItems: DropupItem[] = [
    {
      id: 'tickets',
      label: 'Mesa de Tickets',
      description: 'Gestión de incidentes, solicitudes y catálogo de servicios',
      icon: GitPullRequest,
      badge: '12',
    },
    {
      id: 'slas',
      label: 'Gestión de SLAs',
      description: 'Acuerdos de nivel, tiempos TTR/TTO y matriz de escalamiento',
      icon: Clock,
      badge: 'SLAs',
    },
    {
      id: 'surveys',
      label: 'Encuestas & CSAT',
      description: 'Satisfacción del usuario, encuestas dinámicas y métricas NPS',
      icon: HeartHandshake,
      badge: 'v0.0.8',
    },
    {
      id: 'chat_dashboard',
      label: 'Helpdesk Chat & Analytics',
      description: 'Monitoreo de conversaciones en tiempo real y asistencia técnica',
      icon: MessageSquare,
      badge: 'Live',
    },
    {
      id: 'problems',
      label: 'Problemas & Cambios',
      description: 'Control de cambios estructurales y gestión proactiva de errores',
      icon: Layers,
      badge: '3',
    },
  ];

  const createActions: DropupItem[] = [
    {
      id: 'create_ticket',
      label: 'Nuevo Incidente / Ticket',
      description: 'Abrir formulario con selección de plantilla ITIL y prioridad',
      icon: GitPullRequest,
      action: () => {
        if (onOpenCreateTicket) onOpenCreateTicket();
      },
    },
    {
      id: 'create_survey',
      label: 'Crear Encuesta de Satisfacción',
      description: 'Diseñar nueva encuesta CSAT / NPS con preguntas condicionales',
      icon: HeartHandshake,
      action: () => {
        onSelectNav('surveys');
      },
    },
    {
      id: 'create_asset',
      label: 'Registrar Activo TI en CMDB',
      description: 'Añadir servidor, computador o equipo de red al inventario',
      icon: Server,
      action: () => {
        onSelectNav('computers');
      },
    },
    {
      id: 'create_rule',
      label: 'Nueva Regla de Negocio',
      description: 'Automatizar enrutamiento, asignación de técnicos o SLAs',
      icon: Sliders,
      action: () => {
        onSelectNav('rules');
      },
    },
  ];

  const inventoryItems: DropupItem[] = [
    {
      id: 'computers',
      label: 'Activos & Computadores',
      description: 'Inventario de hardware, servidores y agentes automatizados',
      icon: Server,
      badge: '180',
    },
    {
      id: 'network',
      label: 'Redes & Conectividad',
      description: 'Switches, routers, firewalls, racks y cableado de red',
      icon: Network,
      badge: 'ITAM',
    },
    {
      id: 'contracts',
      label: 'Contratos & Proveedores',
      description: 'Acuerdos comerciales, licencias de software y garantías',
      icon: Briefcase,
    },
    {
      id: 'tools',
      label: 'Base de Conocimiento (KB)',
      description: 'Artículos de solución técnica, procedimientos y guías',
      icon: BookOpen,
    },
  ];

  const adminItems: DropupItem[] = [
    {
      id: 'entities',
      label: 'Jerarquía de Entidades',
      description: 'Árbol multi-inquilino de sedes, filiales y departamentos',
      icon: FolderTree,
    },
    {
      id: 'users',
      label: 'Directorio de Usuarios & RBAC',
      description: 'Cuentas de usuario, perfiles de permiso ITIL y grupos',
      icon: Users,
    },
    {
      id: 'rules',
      label: 'Motor de Reglas & Acciones',
      description: 'Diccionarios de software, asignación y automatización',
      icon: Sliders,
      badge: 'Motor',
    },
    {
      id: 'mail_config',
      label: 'Correo & Notificaciones',
      description: 'Servidor SMTP, eventos por correo y colectores IMAP/POP3',
      icon: Mail,
    },
  ];

  return (
    <div className="bottom-dock-wrapper" ref={dockRef}>
      {/* Toggle Handle 'Menú' */}
      <button
        onClick={() => {
          setIsCollapsed(!isCollapsed);
          setOpenMenu(null);
        }}
        className="bottom-dock-toggle"
        aria-label={isCollapsed ? 'Mostrar Menú de Navegación' : 'Ocultar Menú de Navegación'}
      >
        {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        <span>Menú</span>
      </button>

      {/* Floating Pill Dock Bar */}
      {!isCollapsed && (
        <nav className="bottom-dock-bar" aria-label="Navegación Integrada ITILSuite">
          {/* 1. Panel / Inicio */}
          <div className="dock-item-wrapper align-left">
            <button
              onClick={() => handleToggleMenu('dashboard')}
              className={`dock-item ${isDashboardActive ? 'active' : ''} ${openMenu === 'dashboard' ? 'menu-open' : ''}`}
              title="Panel de Control y Diagnóstico"
            >
              <LayoutGrid size={16} />
              <span>Panel</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'dashboard' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <LayoutGrid size={14} />
                    <span>Panel de Control</span>
                  </div>
                </div>
                <div className="dock-dropup-items">
                  {dashboardItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`dock-dropup-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemSelect(item.id, item.action)}
                      >
                        <div className="dock-dropup-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="dock-dropup-item-content">
                          <div className="dock-dropup-item-title-row">
                            <span className="dock-dropup-item-title">{item.label}</span>
                            {item.badge && <span className="dock-dropup-badge">{item.badge}</span>}
                          </div>
                          <span className="dock-dropup-item-desc">{item.description}</span>
                        </div>
                        {isActive && <Check size={14} className="dock-dropup-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Service Desk (Mesa de Tickets, SLAs, CSAT, Chat) */}
          <div className="dock-item-wrapper">
            <button
              onClick={() => handleToggleMenu('servicedesk')}
              className={`dock-item ${isServiceDeskActive ? 'active' : ''} ${openMenu === 'servicedesk' ? 'menu-open' : ''}`}
              title="Mesa de Servicio ITIL: Tickets, SLAs y Satisfacción"
            >
              <LifeBuoy size={16} />
              <span>Service Desk</span>
              <span className="dock-badge">12</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'servicedesk' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <LifeBuoy size={14} />
                    <span>ITIL Service Desk</span>
                  </div>
                  <span className="dock-dropup-badge">v0.0.8</span>
                </div>
                <div className="dock-dropup-items">
                  {serviceDeskItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`dock-dropup-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemSelect(item.id, item.action)}
                      >
                        <div className="dock-dropup-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="dock-dropup-item-content">
                          <div className="dock-dropup-item-title-row">
                            <span className="dock-dropup-item-title">{item.label}</span>
                            {item.badge && <span className="dock-dropup-badge">{item.badge}</span>}
                          </div>
                          <span className="dock-dropup-item-desc">{item.description}</span>
                        </div>
                        {isActive && <Check size={14} className="dock-dropup-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Botón de Creación Rápida (+ Crear) */}
          <div className="dock-item-wrapper">
            <button
              onClick={() => handleToggleMenu('create')}
              className={`dock-item-create ${openMenu === 'create' ? 'menu-open' : ''}`}
              title="Crear nuevo ticket, encuesta, activo o regla"
            >
              <Plus size={16} />
              <span>Crear</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'create' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <Plus size={14} />
                    <span>Acciones de Creación Rápida</span>
                  </div>
                </div>
                <div className="dock-dropup-items">
                  {createActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        className="dock-dropup-item"
                        onClick={() => handleItemSelect(item.id, item.action)}
                      >
                        <div className="dock-dropup-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="dock-dropup-item-content">
                          <span className="dock-dropup-item-title">{item.label}</span>
                          <span className="dock-dropup-item-desc">{item.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Inventario & CMDB */}
          <div className="dock-item-wrapper">
            <button
              onClick={() => handleToggleMenu('inventory')}
              className={`dock-item ${isInventoryActive ? 'active' : ''} ${openMenu === 'inventory' ? 'menu-open' : ''}`}
              title="Gestión de Activos, Hardware, Redes y CMDB"
            >
              <Server size={16} />
              <span>Inventario</span>
              <span className="dock-badge">180</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'inventory' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <Server size={14} />
                    <span>Activos & CMDB</span>
                  </div>
                  <span className="dock-dropup-badge">ITAM</span>
                </div>
                <div className="dock-dropup-items">
                  {inventoryItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`dock-dropup-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemSelect(item.id, item.action)}
                      >
                        <div className="dock-dropup-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="dock-dropup-item-content">
                          <div className="dock-dropup-item-title-row">
                            <span className="dock-dropup-item-title">{item.label}</span>
                            {item.badge && <span className="dock-dropup-badge">{item.badge}</span>}
                          </div>
                          <span className="dock-dropup-item-desc">{item.description}</span>
                        </div>
                        {isActive && <Check size={14} className="dock-dropup-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. Administración (Entidades, Usuarios, Reglas, Correo) */}
          <div className="dock-item-wrapper">
            <button
              onClick={() => handleToggleMenu('admin')}
              className={`dock-item ${isAdminActive ? 'active' : ''} ${openMenu === 'admin' ? 'menu-open' : ''}`}
              title="Configuración de Sistema, Entidades, Usuarios y Reglas"
            >
              <Sliders size={16} />
              <span>Administración</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'admin' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <Sliders size={14} />
                    <span>Administración & Gobierno</span>
                  </div>
                </div>
                <div className="dock-dropup-items">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`dock-dropup-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemSelect(item.id, item.action)}
                      >
                        <div className="dock-dropup-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="dock-dropup-item-content">
                          <div className="dock-dropup-item-title-row">
                            <span className="dock-dropup-item-title">{item.label}</span>
                            {item.badge && <span className="dock-dropup-badge">{item.badge}</span>}
                          </div>
                          <span className="dock-dropup-item-desc">{item.description}</span>
                        </div>
                        {isActive && <Check size={14} className="dock-dropup-check" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6. Perfil / Cuenta (Alineado a la derecha) */}
          <div className="dock-item-wrapper align-right">
            <button
              onClick={() => handleToggleMenu('profile')}
              className={`dock-item ${openMenu === 'profile' ? 'menu-open' : ''}`}
              title={user ? `Sesión: ${user.display_name}` : 'Iniciar sesión'}
            >
              <User size={16} />
              <span>{user ? user.username : 'Perfil'}</span>
              <ChevronUp size={12} className="dock-item-chevron" />
            </button>

            {openMenu === 'profile' && (
              <div className="dock-dropup" role="menu">
                <div className="dock-dropup-header">
                  <div className="dock-dropup-header-left">
                    <User size={14} />
                    <span>Cuenta & Sesión</span>
                  </div>
                </div>

                {/* User Info Header Card */}
                <div className="dock-user-profile-card">
                  <div className="dock-user-avatar">
                    {(user?.display_name || user?.username || 'AD').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="dock-user-info">
                    <span className="dock-user-name">
                      {user?.display_name || user?.username || 'Administrador'}
                    </span>
                    <span className="dock-user-role">
                      {user?.profile_name || 'Super-Admin • ITIL Core'}
                    </span>
                  </div>
                </div>

                {/* Active Entity Scope */}
                <div className="dock-user-entity-pill">
                  <Building2 size={13} />
                  <span>Ámbito: <strong>{activeEntity.name}</strong></span>
                </div>

                {/* Theme Switcher Button */}
                <button
                  className="dock-theme-toggle-btn"
                  onClick={toggleTheme}
                  title="Cambiar tema de la interfaz"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {theme === 'dark' ? <Moon size={15} color="#38bdf8" /> : <Sun size={15} color="#f59e0b" />}
                    <span>Tema visual</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {theme === 'dark' ? 'Oscuro' : 'Claro'}
                  </span>
                </button>

                {/* Login / Logout Button */}
                {user ? (
                  <button
                    className="dock-logout-btn"
                    onClick={() => {
                      setOpenMenu(null);
                      logout();
                    }}
                  >
                    <LogOut size={14} />
                    <span>Cerrar Sesión</span>
                  </button>
                ) : (
                  <button
                    className="dock-login-btn"
                    onClick={() => {
                      setOpenMenu(null);
                      setLoginModalOpen(true);
                    }}
                  >
                    <LogIn size={14} />
                    <span>Iniciar Sesión</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
      )}
    </div>
  );
};
