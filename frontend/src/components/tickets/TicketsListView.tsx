import React, { useState, useEffect, useMemo } from 'react';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  AlertTriangle,
  Layers,
  Clock,
  Building2,
  Tag,
  Calendar,
  Eye,
  Sparkles,
  Users,
} from 'lucide-react';
import type { TicketSummary, TicketMetrics, TicketStatus } from '../../types';
import { fetchTickets, fetchTicketMetrics } from '../../services/api';
import { getPriorityMeta } from './PriorityMatrixPicker';
import { TicketTableSkeleton, Tooltip } from '../ui';

interface TicketsListViewProps {
  onOpenCreateTicket: () => void;
  onSelectTicket: (ticketId: string) => void;
}

const STATUS_DESCRIPTIONS: Record<TicketStatus, string> = {
  new: 'Nuevo: Registrado en Service Desk y pendiente de diagnóstico',
  assigned: 'Asignado: En manos de un técnico especialista asignado',
  planned: 'Planificado: Intervención agendada con ventana de mantenimiento',
  pending: 'En Espera: Bloqueado a la espera de datos del solicitante o proveedor',
  solved: 'Resuelto: Solución técnica aplicada, pendiente de validación',
  closed: 'Cerrado: Ticket finalizado y archivado administrativamente',
};

const STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: '', label: 'Todos los estados', color: '#94a3b8' },
  { value: 'new', label: 'Nuevo', color: '#818cf8' },
  { value: 'assigned', label: 'Asignado', color: '#3b82f6' },
  { value: 'planned', label: 'Planificado', color: '#06b6d4' },
  { value: 'pending', label: 'En Espera', color: '#f59e0b' },
  { value: 'solved', label: 'Resuelto', color: '#10b981' },
  { value: 'closed', label: 'Cerrado', color: '#64748b' },
];

export const TicketsListView: React.FC<TicketsListViewProps> = ({
  onOpenCreateTicket,
  onSelectTicket,
}) => {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [metrics, setMetrics] = useState<TicketMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'incident' | 'request'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [slaStatusFilter, setSlaStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [ticketsData, metricsData] = await Promise.all([
        fetchTickets({
          ticket_type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter || undefined,
          priority: priorityFilter ? parseInt(priorityFilter, 10) : undefined,
          sla_status: slaStatusFilter !== 'all' ? slaStatusFilter : undefined,
          search: searchQuery || undefined,
        }),
        fetchTicketMetrics(),
      ]);

      setTickets(ticketsData);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar la mesa de ayuda');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, statusFilter, priorityFilter, slaStatusFilter]);

  // Client-side quick filter for text search if query is typed
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase().trim();
    return tickets.filter(
      (t) =>
        t.ticket_number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.requester_name && t.requester_name.toLowerCase().includes(q)) ||
        (t.assigned_technician_name && t.assigned_technician_name.toLowerCase().includes(q)) ||
        (t.assigned_group_name && t.assigned_group_name.toLowerCase().includes(q))
    );
  }, [tickets, searchQuery]);

  const getSlaMeta = (t: TicketSummary) => {
    if (t.status === 'solved' || t.status === 'closed') {
      return {
        label: 'Cumplido',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.25)',
        percent: 100,
        countdown: t.solved_at ? `Resuelto: ${formatDate(t.solved_at)}` : 'Cerrado',
        isBreached: false,
        isAtRisk: false,
      };
    }

    if (!t.time_to_resolve) {
      return {
        label: 'Sin SLA',
        color: 'var(--text-muted)',
        bg: 'rgba(255, 255, 255, 0.05)',
        border: 'var(--border-color)',
        percent: 0,
        countdown: '—',
        isBreached: false,
        isAtRisk: false,
      };
    }

    const now = Date.now();
    const deadline = new Date(t.time_to_resolve).getTime();
    const created = new Date(t.created_at).getTime();
    const totalAllowed = Math.max(deadline - created, 1);
    const elapsed = Math.max(now - created, 0);
    const percent = Math.min(Math.round((elapsed / totalAllowed) * 100), 100);

    const diffMs = deadline - now;
    const isBreached = diffMs <= 0 || t.sla_ttr_status === 'breached';
    const isAtRisk = !isBreached && (t.sla_ttr_status === 'at_risk' || diffMs < 60 * 60 * 1000);

    let countdown = '';
    const absDiff = Math.abs(diffMs);
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (isBreached) {
      countdown = `Vencido (+${hours}h ${minutes}m)`;
      return {
        label: 'Vencido',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.14)',
        border: 'rgba(239, 68, 68, 0.3)',
        percent: 100,
        countdown,
        isBreached: true,
        isAtRisk: false,
      };
    }

    if (isAtRisk) {
      countdown = `${hours > 0 ? `${hours}h ` : ''}${minutes}m restantes`;
      return {
        label: 'En Riesgo',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.14)',
        border: 'rgba(245, 158, 11, 0.3)',
        percent,
        countdown,
        isBreached: false,
        isAtRisk: true,
      };
    }

    countdown = `${hours > 0 ? `${hours}h ` : ''}${minutes}m restantes`;
    return {
      label: 'En Tiempo',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      percent,
      countdown,
      isBreached: false,
      isAtRisk: false,
    };
  };

  const getStatusPill = (status: TicketStatus) => {
    let pill: React.ReactElement;
    switch (status) {
      case 'new':
        pill = <span className="status-pill status-new">Nuevo</span>;
        break;
      case 'assigned':
        pill = <span className="status-pill status-assigned">Asignado</span>;
        break;
      case 'planned':
        pill = <span className="status-pill status-planned">Planificado</span>;
        break;
      case 'pending':
        pill = <span className="status-pill status-pending">En Espera</span>;
        break;
      case 'solved':
        pill = <span className="status-pill status-solved">Resuelto</span>;
        break;
      case 'closed':
        pill = <span className="status-pill status-closed">Cerrado</span>;
        break;
      default:
        pill = <span className="status-pill">{status}</span>;
    }

    return (
      <Tooltip content={STATUS_DESCRIPTIONS[status] || status} position="top">
        {pill}
      </Tooltip>
    );
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="tickets-view-container">
      {/* View Header */}
      <div className="tickets-view-header">
        <div className="tickets-header-info">
          <div className="tickets-header-pretitle">
            <span className="badge-itil-tag">ITIL v4 Service Desk</span>
            <span className="badge-release-tag">v0.0.7</span>
          </div>
          <h1 className="tickets-header-title">Mesa de Ayuda y Gestión de Incidentes</h1>
          <p className="tickets-header-description">
            Administración del ciclo de vida de incidentes y solicitudes, matriz 5×5 de prioridad,
            motor de SLA con calendarios laborales y escalamiento automático.
          </p>
        </div>

        <div className="tickets-header-actions">
          <button
            type="button"
            className="btn-tickets-refresh"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            title="Refrescar lista"
          >
            <RefreshCw size={16} className={refreshing ? 'spin-icon' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            type="button"
            className="btn-tickets-templates"
            onClick={onOpenCreateTicket}
            title="Explorar plantillas y estandarizar requerimientos"
          >
            <Sparkles size={16} color="#c084fc" />
            <span>Plantillas</span>
          </button>

          <button
            type="button"
            className="btn-tickets-create"
            onClick={onOpenCreateTicket}
          >
            <Plus size={18} />
            <span>Crear Ticket</span>
          </button>
        </div>
      </div>

      {/* Metrics Mini-Grid */}
      {metrics && (
        <div className="tickets-summary-strip">
          <div className="summary-strip-card card-open">
            <div className="strip-card-icon">
              <LifeBuoy size={20} />
            </div>
            <div className="strip-card-info">
              <span className="strip-label">Tickets Abiertos</span>
              <span className="strip-value">{metrics.total_open}</span>
            </div>
          </div>

          <div className="summary-strip-card card-incidents">
            <div className="strip-card-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="strip-card-info">
              <span className="strip-label">Incidentes Activos</span>
              <span className="strip-value">{metrics.incidents_count}</span>
            </div>
          </div>

          <div className="summary-strip-card card-requests">
            <div className="strip-card-icon">
              <Layers size={20} />
            </div>
            <div className="strip-card-info">
              <span className="strip-label">Peticiones de Servicio</span>
              <span className="strip-value">{metrics.requests_count}</span>
            </div>
          </div>

          <div className="summary-strip-card card-risk">
            <div className="strip-card-icon" style={{ color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
            <div className="strip-card-info">
              <span className="strip-label">SLA en Riesgo</span>
              <span className="strip-value" style={{ color: '#f59e0b' }}>{metrics.sla_at_risk_count}</span>
            </div>
          </div>

          <div className="summary-strip-card card-breached" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="strip-card-icon" style={{ color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
            <div className="strip-card-info">
              <span className="strip-label">SLA Vencido</span>
              <span className="strip-value" style={{ color: '#ef4444' }}>{metrics.sla_breached_count ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="tickets-filter-bar">
        {/* Type Tabs */}
        <div className="type-filter-tabs">
          <button
            type="button"
            className={`type-filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Todos ({tickets.length})
          </button>
          <button
            type="button"
            className={`type-filter-tab ${typeFilter === 'incident' ? 'active' : ''}`}
            onClick={() => setTypeFilter('incident')}
          >
            <AlertTriangle size={14} style={{ marginRight: '6px' }} />
            Incidentes
          </button>
          <button
            type="button"
            className={`type-filter-tab ${typeFilter === 'request' ? 'active' : ''}`}
            onClick={() => setTypeFilter('request')}
          >
            <Layers size={14} style={{ marginRight: '6px' }} />
            Peticiones
          </button>
        </div>

        {/* Search and Secondary Filters */}
        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por ID, título, usuario o categoría..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ticket-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>

          <select
            className="ticket-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="ticket-filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">Prioridad (Todas)</option>
            <option value="5">P1 - Crítica / Muy Alta</option>
            <option value="4">P2 - Alta</option>
            <option value="3">P3 - Media</option>
            <option value="2">P4 - Baja</option>
            <option value="1">P5 - Muy Baja</option>
          </select>

          <select
            className="ticket-filter-select"
            value={slaStatusFilter}
            onChange={(e) => setSlaStatusFilter(e.target.value)}
          >
            <option value="">SLA (Todos)</option>
            <option value="at_risk">⚠️ En Riesgo</option>
            <option value="breached">🚨 Vencido</option>
            <option value="on_track">✅ En Tiempo</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="ticket-alert-banner alert-danger">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn-retry" onClick={() => loadData()}>
            Reintentar
          </button>
        </div>
      )}

      {/* Tickets Table */}
      <div className="tickets-table-container">
        {loading ? (
          <TicketTableSkeleton rows={6} />
        ) : filteredTickets.length === 0 ? (
          <div className="tickets-empty-state">
            <LifeBuoy size={48} className="empty-icon" />
            <h3>No se encontraron tickets</h3>
            <p>No hay registros que coincidan con los filtros seleccionados actualmente.</p>
            <div className="empty-actions">
              {(typeFilter !== 'all' || statusFilter || priorityFilter || searchQuery) && (
                <button
                  type="button"
                  className="btn-clear-filters"
                  onClick={() => {
                    setTypeFilter('all');
                    setStatusFilter('');
                    setPriorityFilter('');
                    setSearchQuery('');
                  }}
                >
                  Limpiar Filtros
                </button>
              )}
              <button
                type="button"
                className="btn-tickets-create"
                onClick={onOpenCreateTicket}
              >
                <Plus size={16} /> Crear Nuevo Ticket
              </button>
            </div>
          </div>
        ) : (
          <table className="tickets-table">
            <thead>
              <tr>
                <th style={{ width: '125px' }}>Ticket #</th>
                <th style={{ width: '110px' }}>Tipo</th>
                <th>Título y Categoría</th>
                <th style={{ width: '130px' }}>Prioridad</th>
                <th style={{ width: '110px' }}>Estado</th>
                <th style={{ width: '170px' }}>Técnico Asignado</th>
                <th style={{ width: '175px' }}>Cumplimiento SLA</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => {
                const pMeta = getPriorityMeta(t.priority);
                const sla = getSlaMeta(t);
                return (
                  <tr
                    key={t.id}
                    className="ticket-row"
                    onClick={() => onSelectTicket(t.id)}
                  >
                    <td>
                      <span className="table-ticket-code">{t.ticket_number}</span>
                    </td>
                    <td>
                      <span
                        className={`table-type-pill ${
                          t.ticket_type === 'incident' ? 'pill-incident' : 'pill-request'
                        }`}
                      >
                        {t.ticket_type === 'incident' ? (
                          <>
                            <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                            Incidente
                          </>
                        ) : (
                          <>
                            <Layers size={12} style={{ marginRight: '4px' }} />
                            Solicitud
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="ticket-title-cell">
                        <span className="table-ticket-name">{t.name}</span>
                        <div className="table-ticket-meta">
                          {t.category && (
                            <span className="meta-category-badge">
                              <Tag size={11} style={{ marginRight: '3px' }} />
                              {t.category}
                            </span>
                          )}
                          <span className="meta-entity-badge">
                            <Building2 size={11} style={{ marginRight: '3px' }} />
                            {t.entity_name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Tooltip
                        content={
                          <div style={{ textAlign: 'left' }}>
                            <strong>
                              P{t.priority} {pMeta.label}
                            </strong>
                            <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '2px' }}>
                              SLA: {pMeta.sla} | Matriz Urgencia × Impacto
                            </div>
                          </div>
                        }
                        position="top"
                      >
                        <span
                          className="table-priority-badge"
                          style={{
                            backgroundColor: pMeta.bg,
                            color: pMeta.color,
                            borderColor: pMeta.border,
                          }}
                        >
                          P{t.priority} {pMeta.label.split(' ')[0]}
                        </span>
                      </Tooltip>
                    </td>
                    <td>{getStatusPill(t.status)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {t.assigned_group_name && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.1rem 0.4rem',
                              background: 'rgba(56, 189, 248, 0.12)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.25)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              width: 'fit-content',
                            }}
                          >
                            <Users size={10} />
                            <span>{t.assigned_group_name}</span>
                          </span>
                        )}
                        {t.assigned_technician_name ? (
                          <div className="table-tech-badge">
                            <div className="tech-avatar-mini">
                              {t.assigned_technician_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="tech-name-text">{t.assigned_technician_name}</span>
                          </div>
                        ) : !t.assigned_group_name ? (
                          <span className="table-unassigned-text">Sin Asignar</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="table-sla-cell" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.35rem' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.66rem',
                              padding: '0.1rem 0.4rem',
                              backgroundColor: sla.bg,
                              color: sla.color,
                              border: `1px solid ${sla.border}`,
                              fontWeight: 600,
                            }}
                          >
                            {sla.label}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: sla.color, fontWeight: 500 }}>
                            {sla.countdown}
                          </span>
                        </div>
                        {t.time_to_resolve && t.status !== 'solved' && t.status !== 'closed' && (
                          <div
                            style={{
                              width: '100%',
                              height: '4px',
                              borderRadius: '2px',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${sla.percent}%`,
                                height: '100%',
                                backgroundColor: sla.color,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar size={10} style={{ opacity: 0.7 }} />
                          <span>{formatDate(t.time_to_resolve)}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-view-ticket-detail"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTicket(t.id);
                        }}
                        title="Ver detalles del ticket"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
