import React, { useState } from 'react';
import { Activity, RefreshCw, ExternalLink, ShieldAlert, CheckCircle, Terminal } from 'lucide-react';
import { pingBackendDiagnostics, type PingResult } from '../../services/api';

interface ApiDiagnosticsProps {
  lastResult: PingResult | null;
  onRefresh: (result: PingResult) => void;
}

export const ApiDiagnostics: React.FC<ApiDiagnosticsProps> = ({
  lastResult,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePing = async () => {
    setLoading(true);
    try {
      const result = await pingBackendDiagnostics();
      onRefresh(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Rust API Diagnostics (Axum)</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Endpoints: /api/v1/health and /api/v1/version
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a
            href="http://localhost:8081/swagger-ui"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
          >
            <ExternalLink size={14} /> Swagger UI
          </a>

          <button
            onClick={handlePing}
            disabled={loading}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
            {loading ? 'Checking...' : 'Check API'}
          </button>
        </div>
      </div>

      {lastResult && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: lastResult.success
                ? 'rgba(16, 185, 129, 0.1)'
                : 'rgba(244, 63, 94, 0.1)',
              border: `1px solid ${
                lastResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'
              }`,
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {lastResult.success ? (
                <CheckCircle size={18} color="#34d399" />
              ) : (
                <ShieldAlert size={18} color="#f87171" />
              )}
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {lastResult.success
                  ? 'Rust server is online and responding normally'
                  : `Connection failure: ${lastResult.error}`}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Latency: <strong style={{ color: '#93c5fd' }}>{lastResult.latencyMs} ms</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Terminal size={14} color="#9ca3af" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Live JSON payload response:
            </span>
          </div>

          <pre className="json-display">
            {lastResult.rawJson || lastResult.error}
          </pre>
        </div>
      )}
    </div>
  );
};
