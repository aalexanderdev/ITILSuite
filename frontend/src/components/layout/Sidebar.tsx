import React from 'react';
import {
  LifeBuoy,
  Server,
  Briefcase,
  BookOpen,
  FolderTree,
  Users,
  Settings,
  Layers,
  ChevronRight,
  Network,
  GitPullRequest,
} from 'lucide-react';

interface SidebarProps {
  activeNav: string;
  onSelectNav: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeNav, onSelectNav }) => {
  const navSections = [
    {
      title: 'ITIL Service Desk',
      items: [
        { id: 'dashboard', label: 'Service Desk Overview', icon: LifeBuoy, badge: 'Live' },
        { id: 'tickets', label: 'Tickets & Incidents', icon: GitPullRequest, badge: '12' },
        { id: 'problems', label: 'Problems & Changes', icon: Layers, badge: '3' },
      ],
    },
    {
      title: 'Assets & CMDB',
      items: [
        { id: 'computers', label: 'Computers & Servers', icon: Server, badge: '148' },
        { id: 'network', label: 'Network & Racks', icon: Network, badge: '32' },
      ],
    },
    {
      title: 'Management & Contracts',
      items: [
        { id: 'contracts', label: 'Contracts & Vendors', icon: Briefcase },
        { id: 'tools', label: 'Knowledge Base (KB)', icon: BookOpen },
      ],
    },
    {
      title: 'Administration & Multi-Tenancy',
      items: [
        { id: 'entities', label: 'Entity Hierarchy Tree', icon: FolderTree, badge: 'v0.0.2' },
        { id: 'users', label: 'Users & RBAC Profiles', icon: Users, badge: 'v0.0.2' },
        { id: 'settings', label: 'Settings & Rules', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <Layers size={18} />
        </div>
        <div className="brand-info">
          <span className="brand-name">ITILSuite</span>
          <span className="brand-version">
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981' }}></span>
            GLPI 11 Core • v0.0.2
          </span>
        </div>
      </div>

      <div className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="nav-section-title">{section.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectNav(item.id)}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{
                      border: 'none',
                      background: isActive ? undefined : 'transparent',
                      width: '100%',
                      textAlign: 'left',
                    }}
                  >
                    <div className="nav-item-left">
                      <Icon size={17} color={isActive ? '#60a5fa' : '#9ca3af'} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge ? (
                      <span className={`badge ${isActive ? 'badge-blue' : ''}`}>{item.badge}</span>
                    ) : (
                      <ChevronRight size={13} color="#6b7280" opacity={0.6} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-subtle)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
          <span>Backend Engine:</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>Rust 1.98 / Axum</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Frontend:</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>React 19 / Vite</span>
        </div>
      </div>
    </aside>
  );
};
