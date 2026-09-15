import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MetricsGrid } from './components/dashboard/MetricsGrid';
import { ApiDiagnostics } from './components/dashboard/ApiDiagnostics';
import { RoadmapCard } from './components/dashboard/RoadmapCard';
import { pingBackendDiagnostics, type PingResult } from './services/api';
import {
  PlusCircle,
  HardDrive,
  FileCode2,
  Check,
  Zap,
  Shield,
  Cpu,
  Workflow
} from 'lucide-react';

export function App() {
  const [activeNav, setActiveNav] = useState('tickets');
  const [selectedEntity, setSelectedEntity] = useState('Root Entity (Global)');
  const [lastResult, setLastResult] = useState<PingResult | null>(null);

  // Automatic ping on initial mount
  useEffect(() => {
    pingBackendDiagnostics().then((res) => {
      setLastResult(res);
    });
  }, []);

  const isOnline = lastResult?.success ?? false;

  return (
    <div className="app-container">
      {/* GLPI-inspired modular sidebar */}
      <Sidebar activeNav={activeNav} onSelectNav={setActiveNav} />

      <div className="main-wrapper">
        {/* Top Header Navbar */}
        <Navbar
          isOnline={isOnline}
          selectedEntity={selectedEntity}
          onSelectEntity={setSelectedEntity}
        />

        {/* Main Content Area */}
        <main className="dashboard-content">
          {/* Hero Banner */}
          <section className="hero-card">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-blue">
                <Zap size={11} style={{ marginRight: 3 }} /> Initial v0.0.1 Release
              </span>
              <span className="badge badge-emerald">
                <Shield size={11} style={{ marginRight: 3 }} /> Inspired by GLPI 11
              </span>
            </div>

            <h1 className="hero-title">
              ITILSuite: Next-Gen ITSM, ITAM & CMDB
            </h1>
            <p className="hero-subtitle">
              High-performance IT Service Management platform with a <strong>Rust (Axum + Tokio)</strong> backend and a modular <strong>TypeScript + React</strong> frontend. Engineered for high-throughput inventory ingestion, rigorous SLAs, and native hierarchical multi-tenancy.
            </p>

            <div className="hero-actions">
              <button
                className="btn btn-primary"
                onClick={() => alert('ITIL Ticket creation workflow scheduled for v0.0.3')}
              >
                <PlusCircle size={16} /> Create Ticket (ITIL)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => alert('Asset & CMDB inventory registration scheduled for v0.0.4')}
              >
                <HardDrive size={16} /> Register Asset
              </button>
              <a
                href="http://localhost:8081/swagger-ui"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                <FileCode2 size={16} /> View OpenAPI Swagger
              </a>
            </div>
          </section>

          {/* Real-time KPI Metrics Grid */}
          <MetricsGrid />

          {/* Dashboard Two-Column Layout */}
          <div className="dashboard-columns">
            {/* Left Column: API Diagnostics & Architecture Matrix */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <ApiDiagnostics
                lastResult={lastResult}
                onRefresh={(res) => setLastResult(res)}
              />

              {/* Technical Comparison: GLPI 11 vs ITILSuite */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(6, 182, 212, 0.15)',
                      color: '#22d3ee',
                    }}
                  >
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Architecture Comparison</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Key differentials compared to historical GLPI architecture
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    {
                      aspect: 'Concurrency & Agent Ingestion',
                      glpi: 'Synchronous PHP / heavy process per agent',
                      itil: 'Asynchronous Tokio in Rust (thousands of req/sec in minimal RAM)',
                    },
                    {
                      aspect: 'Type Safety & SLA Calculations',
                      glpi: 'Dynamic typing / runtime validations',
                      itil: 'Compile-time type guarantees with exhaustive Enums',
                    },
                    {
                      aspect: 'User Interface & Reactivity',
                      glpi: 'Twig / Server-rendered with page reloads',
                      itil: 'Reactive SPA (React 19 + TypeScript + TanStack)',
                    },
                    {
                      aspect: 'API Documentation',
                      glpi: 'REST / legacy apirest.php',
                      itil: 'OpenAPI 3.1 strictly typed and auto-generated via Utoipa',
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
                        <span style={{ color: 'var(--text-muted)' }}>GLPI: {row.glpi}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Check size={14} color="#34d399" style={{ flexShrink: 0 }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{row.itil}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Roadmap & Entity Tree Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <RoadmapCard />

              {/* Multi-tenant Entity Hierarchy Preview */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                  <div
                    style={{
                      padding: '0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                    }}
                  >
                    <Workflow size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Hierarchical Entity Tree</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Native multi-tenancy model (prepared for v0.0.2)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#0d1117',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    lineHeight: 1.8,
                  }}
                >
                  <div style={{ color: '#60a5fa' }}>📁 Root Entity (Global Organization)</div>
                  <div style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
                    ├── 🏢 Headquarters (Corporate)
                  </div>
                  <div style={{ paddingLeft: '3rem', color: '#cbd5e1' }}>
                    ├── 💻 IT & Infrastructure Department
                  </div>
                  <div style={{ paddingLeft: '3rem', color: '#cbd5e1' }}>
                    └── 🗄️ Primary Datacenter
                  </div>
                  <div style={{ paddingLeft: '1.5rem', color: '#94a3b8' }}>
                    └── 🌍 North Regional Branch
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
