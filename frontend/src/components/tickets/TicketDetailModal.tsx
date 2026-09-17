import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  UserCheck,
  Building2,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Send,
  Lock,
  MessageSquare,
  ShieldCheck,
  Calendar,
  Layers,
  Info,
} from 'lucide-react';
import type { TicketDetail, TicketStatus, UserSummary } from '../../types';
import {
  fetchTicketById,
  updateTicket,
  addTicketFollowup,
  fetchUsers,
} from '../../services/api';
import { getPriorityMeta } from './PriorityMatrixPicker';

interface TicketDetailModalProps {
  ticketId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTicketUpdated: () => void;
}

const STATUS_PIPELINE: { key: TicketStatus; label: string; description: string }[] = [
  { key: 'new', label: 'Nuevo', description: 'Registrado en Service Desk' },
  { key: 'assigned', label: 'Asignado', description: 'En manos del especialista' },
  { key: 'planned', label: 'Planificado', description: 'Intervención en agenda' },
  { key: 'pending', label: 'En Espera', description: 'Bloqueado por tercero o usuario' },
  { key: 'solved', label: 'Resuelto', description: 'Solución implementada' },
  { key: 'closed', label: 'Cerrado', description: 'Cierre definitivo y archivado' },
];

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticketId,
  isOpen,
  onClose,
  onTicketUpdated,
}) => {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingDispatch, setUpdatingDispatch] = useState(false);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>('');

  // Follow-up form state
  const [followupContent, setFollowupContent] = useState('');
  const [followupType, setFollowupType] = useState<'followup' | 'task' | 'solution'>('followup');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicket();
      loadTechnicians();
    } else {
      setTicket(null);
      setFollowupContent('');
      setFeedbackMsg(null);
    }
  }, [isOpen, ticketId]);

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await fetchTicketById(ticketId);
      setTicket(data);
      setSelectedTechId(data.assigned_technician_id || '');
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al cargar detalles del ticket',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTechnicians = async () => {
    try {
      const users = await fetchUsers();
      const techs = users.filter(
        (u) => u.profile_name === 'Technician' || u.profile_name === 'Super-Admin'
      );
      setTechnicians(techs);
    } catch {
      // Graceful fallback
    }
  };

  if (!isOpen || !ticketId) return null;

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket || ticket.status === newStatus) return;
    setUpdatingStatus(true);
    setFeedbackMsg(null);
    try {
      await updateTicket(ticket.id, { status: newStatus });
      await loadTicket();
      onTicketUpdated();
      setFeedbackMsg({
        type: 'success',
        text: `Estado actualizado a: ${newStatus.toUpperCase()}`,
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'No se pudo actualizar el estado',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDispatchChange = async (newTechId: string) => {
    if (!ticket) return;
    setSelectedTechId(newTechId);
    setUpdatingDispatch(true);
    setFeedbackMsg(null);
    try {
      await updateTicket(ticket.id, {
        assigned_technician_id: newTechId ? newTechId : null,
        // Auto-advance to assigned if currently new and assigning a technician
        ...(ticket.status === 'new' && newTechId ? { status: 'assigned' } : {}),
      });
      await loadTicket();
      onTicketUpdated();
      setFeedbackMsg({
        type: 'success',
        text: newTechId ? 'Técnico despachado exitosamente' : 'Despacho removido',
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al reasignar técnico',
      });
    } finally {
      setUpdatingDispatch(false);
    }
  };

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !followupContent.trim()) return;

    setSubmittingFollowup(true);
    setFeedbackMsg(null);

    try {
      await addTicketFollowup(ticket.id, {
        content: followupContent.trim(),
        item_type: followupType,
        is_private: isPrivate,
      });

      // If posting an official solution, automatically mark ticket as solved if not already
      if (followupType === 'solution' && ticket.status !== 'solved' && ticket.status !== 'closed') {
        await updateTicket(ticket.id, { status: 'solved' });
      }

      setFollowupContent('');
      setFollowupType('followup');
      setIsPrivate(false);
      await loadTicket();
      onTicketUpdated();
      setFeedbackMsg({
        type: 'success',
        text: followupType === 'solution' ? 'Solución registrada y ticket marcado como Resuelto' : 'Seguimiento añadido correctamente',
      });
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error al agregar seguimiento',
      });
    } finally {
      setSubmittingFollowup(false);
    }
  };

  const priorityMeta = ticket ? getPriorityMeta(ticket.priority) : null;
  const currentStatusIndex = ticket
    ? STATUS_PIPELINE.findIndex((s) => s.key === ticket.status)
    : -1;

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="ticket-modal-overlay" onClick={onClose}>
      <div
        className="ticket-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="ticket-modal-header">
          <div className="ticket-modal-title-area">
            <div className="ticket-modal-pretitle">
              <span className="ticket-number-badge">{ticket?.ticket_number || 'CARGANDO...'}</span>
              <span
                className={`ticket-type-pill ${
                  ticket?.ticket_type === 'incident' ? 'pill-incident' : 'pill-request'
                }`}
              >
                {ticket?.ticket_type === 'incident' ? (
                  <>
                    <AlertTriangle size={13} style={{ marginRight: '4px' }} /> Incidente
                  </>
                ) : (
                  <>
                    <Layers size={13} style={{ marginRight: '4px' }} /> Solicitud de Servicio
                  </>
                )}
              </span>
              {priorityMeta && (
                <span
                  className="priority-pill"
                  style={{
                    backgroundColor: priorityMeta.bg,
                    borderColor: priorityMeta.border,
                    color: priorityMeta.color,
                  }}
                >
                  Prioridad {ticket?.priority}: {priorityMeta.label.split(' ')[0]} ({priorityMeta.sla})
                </span>
              )}
            </div>
            <h2 className="ticket-detail-title">{ticket?.name || 'Cargando ticket...'}</h2>
          </div>

          <button
            type="button"
            className="ticket-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`ticket-alert-banner ${
              feedbackMsg.type === 'success' ? 'alert-success' : 'alert-danger'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {loading && !ticket ? (
          <div className="ticket-modal-loading">
            <div className="loading-spinner" />
            <p>Cargando información completa del ticket...</p>
          </div>
        ) : ticket ? (
          <div className="ticket-modal-content-grid">
            {/* Left Column: Lifecycle, Description, Timeline */}
            <div className="ticket-modal-main-col">
              {/* ITIL Lifecycle Pipeline Stepper */}
              <div className="lifecycle-stepper-card">
                <div className="stepper-header">
                  <span className="stepper-title">Ciclo de Vida ITIL</span>
                  <span className="stepper-hint">
                    Haz clic en una etapa para actualizar el estado del ticket
                  </span>
                </div>
                <div className="lifecycle-steps-track">
                  {STATUS_PIPELINE.map((step, idx) => {
                    const isCurrent = step.key === ticket.status;
                    const isPassed = currentStatusIndex > idx;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        className={`lifecycle-step-btn ${isCurrent ? 'step-current' : ''} ${
                          isPassed ? 'step-passed' : ''
                        }`}
                        onClick={() => handleStatusChange(step.key)}
                        disabled={updatingStatus}
                        title={step.description}
                      >
                        <div className="step-indicator">
                          {isPassed ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <span className="step-num">{idx + 1}</span>
                          )}
                        </div>
                        <span className="step-label">{step.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description Card */}
              <div className="ticket-content-card">
                <h4 className="ticket-section-heading">Descripción del Problema / Requerimiento</h4>
                <div className="ticket-description-text">{ticket.content}</div>
              </div>

              {/* Timeline & Follow-ups */}
              <div className="ticket-timeline-card">
                <div className="timeline-header">
                  <h4 className="ticket-section-heading">Historial de Seguimientos y Soluciones</h4>
                  <span className="timeline-count-badge">
                    {ticket.followups?.length || 0} intervenciones
                  </span>
                </div>

                <div className="timeline-items-list">
                  {ticket.followups && ticket.followups.length > 0 ? (
                    ticket.followups.map((fu) => (
                      <div
                        key={fu.id}
                        className={`timeline-entry ${
                          fu.item_type === 'solution'
                            ? 'entry-solution'
                            : fu.is_private
                            ? 'entry-private'
                            : 'entry-public'
                        }`}
                      >
                        <div className="timeline-entry-header">
                          <div className="timeline-entry-author">
                            <div className="author-avatar">
                              {fu.author_name ? fu.author_name.charAt(0).toUpperCase() : 'T'}
                            </div>
                            <div>
                              <span className="author-name">
                                {fu.author_name || 'Técnico Especialista'}
                              </span>
                              <span className="entry-timestamp">
                                <Clock size={12} style={{ display: 'inline', marginRight: '3px' }} />
                                {formatDate(fu.created_at)}
                              </span>
                            </div>
                          </div>

                          <div className="timeline-entry-badges">
                            {fu.is_private && (
                              <span className="badge-private-note">
                                <Lock size={12} style={{ marginRight: '3px' }} /> Nota Interna
                              </span>
                            )}
                            {fu.item_type === 'solution' && (
                              <span className="badge-solution-item">
                                <ShieldCheck size={13} style={{ marginRight: '3px' }} /> Solución Aprobada
                              </span>
                            )}
                            {fu.item_type === 'task' && (
                              <span className="badge-task-item">Tarea Técnica</span>
                            )}
                          </div>
                        </div>

                        <div className="timeline-entry-body">{fu.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="timeline-empty">
                      <MessageSquare size={32} className="timeline-empty-icon" />
                      <p>Aún no hay seguimientos registrados para este ticket.</p>
                      <span>Sé el primero en agregar una nota técnica o registrar la solución.</span>
                    </div>
                  )}
                </div>

                {/* Add Followup Form */}
                <form className="add-followup-form" onSubmit={handleAddFollowup}>
                  <div className="followup-form-top">
                    <span className="form-subheading">Nueva Intervención</span>
                    <div className="followup-type-selector">
                      <button
                        type="button"
                        className={`type-tab-btn ${followupType === 'followup' ? 'active' : ''}`}
                        onClick={() => setFollowupType('followup')}
                      >
                        Seguimiento
                      </button>
                      <button
                        type="button"
                        className={`type-tab-btn ${followupType === 'task' ? 'active' : ''}`}
                        onClick={() => setFollowupType('task')}
                      >
                        Tarea
                      </button>
                      <button
                        type="button"
                        className={`type-tab-btn ${followupType === 'solution' ? 'active solution-tab' : ''}`}
                        onClick={() => setFollowupType('solution')}
                      >
                        <CheckCircle2 size={13} style={{ marginRight: '4px' }} /> Solución Oficial
                      </button>
                    </div>
                  </div>

                  <textarea
                    className="ticket-textarea"
                    rows={3}
                    placeholder={
                      followupType === 'solution'
                        ? 'Describe detalladamente la causa raíz y las acciones tomadas para resolver el incidente...'
                        : 'Escribe comentarios de avance, notas de diagnóstico o consultas al usuario...'
                    }
                    value={followupContent}
                    onChange={(e) => setFollowupContent(e.target.value)}
                  />

                  <div className="followup-form-footer">
                    <label className="checkbox-private-toggle">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                      />
                      <span>
                        <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        Marcar como nota privada (visible sólo para técnicos)
                      </span>
                    </label>

                    <button
                      type="submit"
                      className={`btn-submit-followup ${
                        followupType === 'solution' ? 'btn-submit-solution' : ''
                      }`}
                      disabled={submittingFollowup || !followupContent.trim()}
                    >
                      {submittingFollowup ? (
                        'Guardando...'
                      ) : followupType === 'solution' ? (
                        <>
                          <ShieldCheck size={16} /> Aplicar Solución
                        </>
                      ) : (
                        <>
                          <Send size={15} /> Publicar Seguimiento
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Metadata, Technician Dispatch & SLA */}
            <div className="ticket-modal-sidebar">
              {/* Technician Dispatch Card */}
              <div className="sidebar-card dispatch-card">
                <div className="sidebar-card-header">
                  <UserCheck size={18} className="sidebar-icon" />
                  <h4>Despacho de Técnico</h4>
                </div>
                <div className="dispatch-selector-wrapper">
                  <label htmlFor="tech-dispatch-select" className="sidebar-label">
                    Técnico Asignado
                  </label>
                  <select
                    id="tech-dispatch-select"
                    className="ticket-select-input"
                    value={selectedTechId}
                    onChange={(e) => handleDispatchChange(e.target.value)}
                    disabled={updatingDispatch}
                  >
                    <option value="">-- Sin Asignar (Pool General) --</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name} ({t.username})
                      </option>
                    ))}
                  </select>
                </div>
                {ticket.assigned_technician_name ? (
                  <div className="dispatch-status-badge">
                    <div className="assigned-avatar">
                      {ticket.assigned_technician_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="assigned-info">
                      <span className="assigned-label">Especialista a cargo</span>
                      <span className="assigned-name">{ticket.assigned_technician_name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="dispatch-unassigned-notice">
                    <Info size={14} /> Ticket en cola no asignada
                  </div>
                )}
              </div>

              {/* ITIL Ticket Properties Card */}
              <div className="sidebar-card">
                <div className="sidebar-card-header">
                  <Tag size={18} className="sidebar-icon" />
                  <h4>Propiedades ITIL</h4>
                </div>
                <div className="metadata-list">
                  <div className="metadata-item">
                    <span className="metadata-label">Entidad / Organización</span>
                    <span className="metadata-value">
                      <Building2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      {ticket.entity_name}
                    </span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">Categoría</span>
                    <span className="metadata-value">
                      <Tag size={13} style={{ display: 'inline', marginRight: '4px' }} />
                      {ticket.category || 'General'}
                    </span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">Solicitante</span>
                    <span className="metadata-value">
                      {ticket.requester_name || 'Usuario del Sistema'}
                    </span>
                  </div>

                  <div className="metadata-row-split">
                    <div className="metadata-subitem">
                      <span className="metadata-label">Urgencia</span>
                      <span className="metadata-badge">Nivel {ticket.urgency} / 5</span>
                    </div>
                    <div className="metadata-subitem">
                      <span className="metadata-label">Impacto</span>
                      <span className="metadata-badge">Nivel {ticket.impact} / 5</span>
                    </div>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">Matriz Prioridad</span>
                    <span
                      className="priority-calculated-pill"
                      style={{
                        backgroundColor: priorityMeta?.bg,
                        color: priorityMeta?.color,
                        borderColor: priorityMeta?.border,
                      }}
                    >
                      P{ticket.priority} - {priorityMeta?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* SLA & Timestamps Card */}
              <div className="sidebar-card">
                <div className="sidebar-card-header">
                  <Clock size={18} className="sidebar-icon" />
                  <h4>Tiempos y SLA</h4>
                </div>
                <div className="metadata-list">
                  <div className="metadata-item">
                    <span className="metadata-label">Fecha de Apertura</span>
                    <span className="metadata-value">{formatDate(ticket.created_at)}</span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">Última Modificación</span>
                    <span className="metadata-value">{formatDate(ticket.updated_at)}</span>
                  </div>

                  {ticket.time_to_resolve && (
                    <div className="metadata-item">
                      <span className="metadata-label">Límite SLA Resolución</span>
                      <span className="metadata-value sla-target-highlight">
                        <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        {formatDate(ticket.time_to_resolve)}
                      </span>
                    </div>
                  )}

                  {ticket.solved_at && (
                    <div className="metadata-item">
                      <span className="metadata-label">Resuelto el</span>
                      <span className="metadata-value text-success">
                        <CheckCircle2 size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        {formatDate(ticket.solved_at)}
                      </span>
                    </div>
                  )}

                  {ticket.closed_at && (
                    <div className="metadata-item">
                      <span className="metadata-label">Cerrado el</span>
                      <span className="metadata-value">{formatDate(ticket.closed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
