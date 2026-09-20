import React from 'react';
import { GitBranch, CheckCircle2, Clock3, ArrowRight } from 'lucide-react';

export const RoadmapCard: React.FC = () => {
  const steps = [
    {
      version: 'v0.0.1',
      title: 'Foundation & Core Architecture',
      desc: 'Axum REST server, OpenAPI docs, Docker Compose (Postgres/Mailpit), and React Dashboard Shell.',
      status: 'completed',
    },
    {
      version: 'v0.0.2',
      title: 'Multi-Tenancy & Authentication',
      desc: 'Hierarchical Entity tree, Users, RBAC profiles, and JWT authentication.',
      status: 'completed',
    },
    {
      version: 'v0.0.3',
      title: 'ITIL Service Desk (Tickets)',
      desc: 'Incident/Request lifecycles, Urgency x Impact priority matrix, and technician dispatch.',
      status: 'completed',
    },
    {
      version: 'v0.0.4',
      title: 'Asset Management (ITAM / CMDB) & HelpdeskChat',
      desc: 'Hardware telemetry, GLPI-Agent ingestion, field locks, and real-time WebSockets chat.',
      status: 'completed',
    },
    {
      version: 'v0.0.5',
      title: 'Business Rules & Dictionaries',
      desc: 'High-throughput Rust rule engine across 4 domains and 10 normalization dictionaries.',
      status: 'completed',
    },
    {
      version: 'v0.0.6',
      title: 'User Ingestion & Transversal Groups',
      desc: 'Bulk user directory ingestion, transversal groups architecture, and cross-platform integrations.',
      status: 'completed',
    },
    {
      version: 'v0.0.7',
      title: 'Advanced SLAs & Escalation Matrices',
      desc: 'Real-time SLA breach monitors, TTO/TTR targets, and automated escalation pipelines.',
      status: 'planned',
    },
  ];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div
          style={{
            padding: '0.4rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(168, 85, 247, 0.15)',
            color: '#c084fc',
          }}
        >
          <GitBranch size={18} />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Release Roadmap</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Semantic step-by-step evolution (SemVer)
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {steps.map((step, idx) => {
          const isDone = step.status === 'completed';
          const isInProgress = step.status === 'in-progress';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                gap: '0.85rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isDone
                  ? 'rgba(16, 185, 129, 0.05)'
                  : isInProgress
                  ? 'rgba(59, 130, 246, 0.05)'
                  : 'transparent',
                border: `1px solid ${
                  isDone
                    ? 'rgba(16, 185, 129, 0.2)'
                    : isInProgress
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'var(--border-subtle)'
                }`,
              }}
            >
              <div style={{ marginTop: '0.15rem' }}>
                {isDone ? (
                  <CheckCircle2 size={16} color="#34d399" />
                ) : isInProgress ? (
                  <Clock3 size={16} color="#60a5fa" />
                ) : (
                  <ArrowRight size={16} color="#6b7280" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span
                    className={`badge ${
                      isDone ? 'badge-emerald' : isInProgress ? 'badge-blue' : ''
                    }`}
                    style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                  >
                    {step.version}
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {step.title}
                  </strong>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
