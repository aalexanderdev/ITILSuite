import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Activity,
  Clock,
  Download,
  Calendar,
  BarChart3,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import type { ChatDashboardMetrics } from '../../types';
import { fetchChatDashboardMetrics, getChatMessagesExportCsvUrl } from '../../services/api';

export const ChatDashboardView: React.FC = () => {
  const [metrics, setMetrics] = useState<ChatDashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchChatDashboardMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar métricas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const usersInIntervals = Array.from(
    new Set(metrics?.recent_intervals.map((i) => i.username) || [])
  );

  const displayedIntervals = metrics?.recent_intervals.filter((i) =>
    filterUser === 'all' ? true : i.username === filterUser
  ) || [];

  return (
    <div className="chat-dashboard-container">
      {/* Header */}
      <div className="view-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1 className="view-title">Dashboard Analítico de HelpdeskChat</h1>
            <span className="badge badge-coral">Métricas & Presencia</span>
          </div>
          <p className="view-subtitle">
            Telemetría de mensajes, tiempo de sesión abierta e intervalos de conexión en tiempo real
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={loadData}
            className="btn-secondary"
            title="Recargar datos"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>

          <a
            href={getChatMessagesExportCsvUrl()}
            className="btn-primary"
            title="Descargar todos los mensajes en formato CSV"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="alert-error-bar" style={{ marginBottom: '1.25rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="chat-kpi-grid">
        <div className="chat-kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(235, 77, 61, 0.12)', color: '#eb4d3d' }}>
            <MessageSquare size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">TOTAL DE MENSAJES</span>
            <span className="kpi-value">{metrics ? metrics.total_messages : '...'}</span>
            <span className="kpi-sub">Registrados en la plataforma</span>
          </div>
        </div>

        <div className="chat-kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa' }}>
            <Activity size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">PROMEDIO DIARIO</span>
            <span className="kpi-value">
              {metrics ? metrics.daily_avg_messages.toFixed(1) : '...'}
            </span>
            <span className="kpi-sub">Mensajes / día</span>
          </div>
        </div>

        <div className="chat-kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Users size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">EN LÍNEA AHORA</span>
            <span className="kpi-value" style={{ color: '#10b981' }}>
              {metrics ? metrics.online_users_count : '...'}
            </span>
            <span className="kpi-sub">Sesiones activas en tiempo real</span>
          </div>
        </div>

        <div className="chat-kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            <BarChart3 size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">VOLUMEN GRUPAL</span>
            <span className="kpi-value">{metrics ? `${metrics.group_messages_pct}%` : '...'}</span>
            <span className="kpi-sub">Mensajes en canales de equipo</span>
          </div>
        </div>

        <div className="chat-kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">TIEMPO SESIÓN PROMEDIO</span>
            <span className="kpi-value">
              {metrics ? formatDuration(metrics.daily_online_seconds_avg) : '...'}
            </span>
            <span className="kpi-sub">Sesión abierta en ITILSuite</span>
          </div>
        </div>
      </div>

      {/* Connected Hours Timeline / Gantt Chart */}
      <div className="chat-dashboard-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="#eb4d3d" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              Línea de Tiempo de Tiempo Conectado (Horas de Sesión Abierta)
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filtrar usuario:</span>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="select-field"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', minWidth: 120 }}
            >
              <option value="all">Todos los usuarios</option>
              {usersInIntervals.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Visualización cronológica de los intervalos de sesión registrada mediante el heartbeat
          periódico de presencia en horario laboral.
        </p>

        {/* 24-Hour Timeline Grid */}
        <div className="gantt-chart-wrapper">
          <div className="gantt-hours-header">
            {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '23:59'].map(
              (hour) => (
                <span key={hour} className="gantt-hour-tick">
                  {hour}
                </span>
              )
            )}
          </div>

          <div className="gantt-rows-container">
            {displayedIntervals.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay intervalos registrados para los filtros seleccionados.
              </div>
            ) : (
              displayedIntervals.slice(0, 10).map((interval) => {
                const startDate = new Date(interval.start_time);
                const endDate = new Date(interval.end_time);
                const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                const leftPct = Math.max(0, Math.min(100, (startHour / 24) * 100));
                const widthPct = Math.max(4, Math.min(100 - leftPct, ((endHour - startHour) / 24) * 100));

                return (
                  <div key={interval.id} className="gantt-user-row">
                    <div className="gantt-user-label">
                      <span className="name">{interval.display_name}</span>
                      <span className="date">{interval.session_date}</span>
                    </div>

                    <div className="gantt-bar-track">
                      <div
                        className="gantt-active-bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        title={`${interval.display_name}: ${startDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} - ${endDate.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} (${formatDuration(interval.duration_seconds)})`}
                      >
                        <span className="bar-label">{formatDuration(interval.duration_seconds)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Session Breakdown Table */}
      <div className="chat-dashboard-card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="#60a5fa" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Registro Detallado de Sesiones</h3>
          </div>
          <span className="badge badge-blue">Últimos 7 días</span>
        </div>

        <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Duración</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {displayedIntervals.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem' }}>
                    Sin sesiones registradas.
                  </td>
                </tr>
              ) : (
                displayedIntervals.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="user-avatar-small">
                          {row.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, display: 'block' }}>{row.display_name}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            @{row.username}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{row.session_date}</td>
                    <td>{new Date(row.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{new Date(row.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <span className="badge badge-purple">{formatDuration(row.duration_seconds)}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.78rem' }}>
                        <CheckCircle2 size={13} /> Consolidado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
