import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui';
import { Navbar } from './components/layout/Navbar';
import { BottomNavDock } from './components/layout/BottomNavDock';
import { LoginModal } from './components/auth/LoginModal';
import { HelpdeskChatWidget } from './components/chat/HelpdeskChatWidget';
import { EntityTreeView } from './components/entities/EntityTreeView';
import { UsersListView } from './components/users/UsersListView';
import { TicketsListView } from './components/tickets/TicketsListView';
import { CreateTicketModal } from './components/tickets/CreateTicketModal';
import { TicketDetailModal } from './components/tickets/TicketDetailModal';
import { MetricsGrid } from './components/dashboard/MetricsGrid';
import { ApiDiagnostics } from './components/dashboard/ApiDiagnostics';
import { RoadmapCard } from './components/dashboard/RoadmapCard';
import { MailConfigView } from './components/notifications/MailConfigView';
import { AssetsListView } from './components/assets/AssetsListView';
import { ChatDashboardView } from './components/chat/ChatDashboardView';
import { RuleManagementView } from './components/rules/RuleManagementView';
import { SLAsManagementView } from './components/slas/SLAsManagementView';
import { SurveysManagementView } from './components/surveys/SurveysManagementView';
import { PublicSurveyView } from './components/surveys/PublicSurveyView';
import { pingBackendDiagnostics, type PingResult } from './services/api';
import {
  Plus,
  Check,
  Cpu,
  Workflow,
  Building2,
  Server,
  Globe,
  Monitor,
  MessageSquare,
  Clock,
} from 'lucide-react';

function DashboardMain() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [lastResult, setLastResult] = useState<PingResult | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true); // Open by default like OpenITIL
  const [isChatPinned, setIsChatPinned] = useState(true);
  const { activeEntity } = useAuth();

  // Ticket Modal states (v0.0.3)
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketRefreshTrigger, setTicketRefreshTrigger] = useState(0);

  useEffect(() => {
    pingBackendDiagnostics().then((res) => {
      setLastResult(res);
    });
  }, []);

  // Global Keyboard Shortcut: Ctrl + Alt + . toggles Chat Dock
  useEffect(() => {
    function handleGlobalShortcuts(e: KeyboardEvent) {
      if (e.ctrlKey && e.altKey && (e.key === '.' || e.key === 'p')) {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  return (
    <div className="openitil-app-shell">
      {/* Top Navbar */}
      <Navbar
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        isChatOpen={isChatOpen}
        onNavigateEntities={() => setActiveNav('entities')}
        onNavigateMail={() => setActiveNav('mail_config')}
        onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
      />

      {/* Main Body Layout: Content Area + Right Chat Rail */}
      <div className={`openitil-body-layout ${isChatOpen && isChatPinned ? 'chat-pinned' : ''}`}>
        {/* Main Content Workspace */}
        <main className="openitil-content-workspace">
          {activeNav === 'entities' ? (
            <EntityTreeView />
          ) : activeNav === 'users' ? (
            <UsersListView />
          ) : activeNav === 'tickets' ? (
            <TicketsListView
              key={ticketRefreshTrigger}
              onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
              onSelectTicket={(ticketId) => setSelectedTicketId(ticketId)}
            />
          ) : activeNav === 'slas' ? (
            <SLAsManagementView />
          ) : activeNav === 'surveys' ? (
            <SurveysManagementView />
          ) : activeNav === 'chat_dashboard' || activeNav === 'chat-analytics' || activeNav === 'chat' ? (
            <ChatDashboardView />
          ) : activeNav === 'mail_config' ? (
            <MailConfigView />
          ) : activeNav === 'computers' || activeNav === 'assets' || activeNav === 'inventory' ? (
            <AssetsListView />
          ) : activeNav === 'rules' || activeNav === 'settings' ? (
            <RuleManagementView />
          ) : (
            <div className="openitil-dashboard-view">
              {/* Welcome Header */}
              <div className="openitil-welcome-banner">
                <div>
                  <h1 className="welcome-title">Bienvenido, Administrador</h1>
                  <p className="welcome-subtitle">
                    Panel de control ITSM e infraestructura de servicios ITIL | Ámbito Activo:{' '}
                    <strong>{activeEntity.name}</strong>
                  </p>
                </div>
                <div className="welcome-badges-row">
                  <div className="welcome-badge-pill">
                    <span className="welcome-pulse-dot" />
                    <span>ITIL Core v0.0.8 Activo</span>
                  </div>
                  <div className="welcome-badge-pill">
                    <Clock size={14} color="#f59e0b" />
                    <span>Motor SLA & Reglas Activo</span>
                  </div>
                  <button
                    onClick={() => setIsCreateTicketOpen(true)}
                    className="btn-welcome-primary"
                  >
                    <Plus size={16} />
                    <span>Nuevo Ticket</span>
                  </button>
                </div>
              </div>

              {/* KPI Metrics Cards */}
              <MetricsGrid />

              {/* Two-Column Grid: Diagnostics + Architecture & Multi-Tenancy */}
              <div className="dashboard-columns">
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <ApiDiagnostics
                    lastResult={lastResult}
                    onRefresh={(res) => setLastResult(res)}
                  />

                  {/* Architecture Comparison */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                      <div
                        style={{
                          padding: '0.4rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(6, 182, 212, 0.12)',
                          color: '#22d3ee',
                        }}
                      >
                        <Cpu size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Comparativa de Arquitectura</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Diferenciales frente a arquitecturas ITSM tradicionales
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {[
                        {
                          aspect: 'Concurrencia e Ingestión',
                          legacy: 'PHP Síncrono / pesado proceso por petición',
                          itil: 'Tokio Asíncrono en Rust (miles de req/seg en RAM mínima)',
                        },
                        {
                          aspect: 'Seguridad y Hashing',
                          legacy: 'bcrypt clásico / hashes estándar',
                          itil: 'Argon2id memory-hard con JWT firmado a 24 horas',
                        },
                        {
                          aspect: 'Multi-Inquilino (Tenancy)',
                          legacy: 'Cookies de sesión y queries recursivas pesadas',
                          itil: 'Árbol jerárquico recursivo nativo en Rust con sub-millisecond resolution',
                        },
                        {
                          aspect: 'Documentación de API',
                          legacy: 'REST legacy (apirest.php)',
                          itil: 'OpenAPI 3.1 tipado y auto-generado vía Utoipa / Swagger',
                        },
                      ].map((row, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1.2fr',
                            gap: '1rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#93c5fd', display: 'block', marginBottom: '0.15rem' }}>
                              {row.aspect}
                            </strong>
                            <span style={{ color: 'var(--text-muted)' }}>Legacy: {row.legacy}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Check size={14} color="#34d399" style={{ flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{row.itil}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <RoadmapCard />

                  {/* Multi-tenant Entity Hierarchy Overview */}
                  <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div
                          style={{
                            padding: '0.4rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#fbbf24',
                          }}
                        >
                          <Workflow size={18} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Jerarquía Multi-Inquilino</h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Ámbito activo: {activeEntity.name}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveNav('entities')}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      >
                        Explorar Árbol
                      </button>
                    </div>

                    <div
                      style={{
                        backgroundColor: 'var(--code-bg)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.8rem',
                        lineHeight: 1.8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#60a5fa' }}>
                        <Building2 size={15} />
                        <strong>Root Entity (Organización Global)</strong>
                      </div>
                      <div style={{ paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                        <Globe size={14} />
                        <span>North America Region</span>
                      </div>
                      <div style={{ paddingLeft: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <Monitor size={14} />
                        <span>Departamento de Infraestructura TI</span>
                      </div>
                      <div style={{ paddingLeft: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <Server size={14} />
                        <span>Centro de Datos Principal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Docked Support Chat Rail */}
        <HelpdeskChatWidget
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          isPinned={isChatPinned}
          onTogglePin={() => setIsChatPinned(!isChatPinned)}
          onNavigateTicket={(ticketId) => setSelectedTicketId(ticketId)}
        />
      </div>

      {/* Floating Bottom Navigation Dock (OpenITIL Inspired) */}
      <BottomNavDock
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        onOpenCreateTicket={() => setIsCreateTicketOpen(true)}
      />

      {/* Bottom-left floating launcher when chat is closed */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="bottom-left-chat-launcher"
          title="Abrir Chat de Soporte"
        >
          <MessageSquare size={20} color="#ffffff" />
          <span className="chat-launcher-badge">2</span>
        </button>
      )}

      {/* Ticket Creation Modal */}
      <CreateTicketModal
        isOpen={isCreateTicketOpen}
        onClose={() => setIsCreateTicketOpen(false)}
        onTicketCreated={(ticket) => {
          setSelectedTicketId(ticket.id);
          setTicketRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Ticket Detail & Lifecycle Modal */}
      <TicketDetailModal
        ticketId={selectedTicketId}
        isOpen={Boolean(selectedTicketId)}
        onClose={() => setSelectedTicketId(null)}
        onTicketUpdated={() => setTicketRefreshTrigger((prev) => prev + 1)}
      />

      {/* Global Minimalist Login Modal */}
      <LoginModal />
    </div>
  );
}

export function App() {
  const isPublicSurvey = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('survey_token')) return true;
    return window.location.pathname.startsWith('/survey/');
  })();

  if (isPublicSurvey) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <PublicSurveyView />
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <DashboardMain />
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
