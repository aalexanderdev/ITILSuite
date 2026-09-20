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
  Layers,
  Info,
  Users,
  Zap,
  HeartHandshake,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { TicketDetail, TicketStatus, UserSummary, GroupSummary, SurveyToken } from '../../types';
import {
  fetchTicketById,
  updateTicket,
  addTicketFollowup,
  fetchUsers,
  fetchGroups,
  fetchTicketSurveyToken,
  generateTicketSurveyToken,
} from '../../services/api';
import { getPriorityMeta } from './PriorityMatrixPicker';
import { TicketDetailSkeleton, Tooltip } from '../ui';
import { useToast } from '../../context/ToastContext';

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
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingDispatch, setUpdatingDispatch] = useState(false);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Follow-up form state
  const [followupContent, setFollowupContent] = useState('');
  const [followupType, setFollowupType] = useState<'followup' | 'task' | 'solution'>('followup');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Survey state
  const [surveyToken, setSurveyToken] = useState<SurveyToken | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicket();
      loadTechnicians();
      loadSurveyToken(ticketId);
    } else {
      setTicket(null);
      setSurveyToken(null);
      setFollowupContent('');
      setFeedbackMsg(null);
    }
  }, [isOpen, ticketId]);

  const loadSurveyToken = async (id: string) => {
    try {
      const tok = await fetchTicketSurveyToken(id);
      setSurveyToken(tok);
    } catch {
      // ignore
    }
  };

  const handleGenerateTicketToken = async () => {
    if (!ticketId) return;
    setGeneratingToken(true);
    try {
      const tok = await generateTicketSurveyToken(ticketId);
      setSurveyToken(tok);
      toast.success('Enlace generado', 'Enlace de satisfacción creado exitosamente.');
    } catch (err: any) {
      toast.error('Error al generar enlace', err.message);
    } finally {
      setGeneratingToken(false);
    }
  };

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await fetchTicketById(ticketId);
      setTicket(data);
      if (data.assigned_technician_id) {
        setSelectedTechId(data.assigned_technician_id);
      } else {
        setSelectedTechId('');
      }
      if (data.assigned_group_id) {
        setSelectedGroupId(data.assigned_group_id);
      } else {
        setSelectedGroupId('');
      }
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

      const grps = await fetchGroups();
      setGroups(grps.filter((g) => g.is_task));
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
      toast.success(
        `Estado: ${newStatus.toUpperCase()}`,
        `Ticket ${ticket.ticket_number} actualizado a la etapa ${newStatus}.`
      );
      setFeedbackMsg({
        type: 'success',
        text: `Estado actualizado a: ${newStatus.toUpperCase()}`,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'No se pudo actualizar el estado';
      toast.error('Error al actualizar estado', errMsg);
      setFeedbackMsg({
        type: 'error',
        text: errMsg,
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
      const tech = technicians.find((u) => u.id === newTechId);
      if (newTechId) {
        toast.success(
          'Técnico Asignado',
          `${ticket.ticket_number} despachado a ${tech?.display_name || 'especialista'}.`
        );
      } else {
        toast.info('Despacho Removido', `Ticket ${ticket.ticket_number} quedó sin asignar.`);
      }
      setFeedbackMsg({
        type: 'success',
        text: newTechId ? 'Técnico despachado exitosamente' : 'Despacho removido',
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error al reasignar técnico';
      toast.error('Error de despacho', errMsg);
      setFeedbackMsg({
        type: 'error',
        text: errMsg,
      });
    } finally {
      setUpdatingDispatch(false);
    }
  };

  const handleGroupDispatchChange = async (newGroupId: string) => {
    if (!ticket) return;
    setSelectedGroupId(newGroupId);
    setUpdatingDispatch(true);
    setFeedbackMsg(null);
    try {
      await updateTicket(ticket.id, {
        assigned_group_id: newGroupId ? newGroupId : null,
        ...(ticket.status === 'new' && newGroupId ? { status: 'assigned' } : {}),
      });
      await loadTicket();
      onTicketUpdated();
      const grp = groups.find((g) => g.id === newGroupId);
      if (newGroupId) {
        toast.success(
          'Grupo Asignado',
          `${ticket.ticket_number} asignado al grupo "${grp?.name || 'transversal'}".`
        );
      } else {
        toast.info('Asignación Removida', `Ticket ${ticket.ticket_number} sin grupo asignado.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar grupo';
      toast.error('Error', msg);
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

      if (followupType === 'solution') {
        toast.success(
          'Solución Registrada',
          `Solución implementada en ${ticket.ticket_number}. Ticket resuelto.`
        );
      } else {
        toast.success(
          'Seguimiento Añadido',
          `Nueva anotación guardada en ${ticket.ticket_number}.`
        );
      }

      setFeedbackMsg({
        type: 'success',
        text:
          followupType === 'solution'
            ? 'Solución registrada y ticket marcado como Resuelto'
            : 'Seguimiento añadido correctamente',
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

  const getTicketSlaDetails = () => {
    if (!ticket) return null;
    const now = Date.now();

    // TTR calculation
    let ttrLabel = 'En Tiempo';
    let ttrColor = '#10b981';
    let ttrBg = 'rgba(16, 185, 129, 0.12)';
    let ttrBorder = 'rgba(16, 185, 129, 0.25)';
    let ttrPercent = 0;
    let ttrCountdown = '—';

    if (ticket.status === 'solved' || ticket.status === 'closed') {
      ttrLabel = 'Cumplido';
      ttrPercent = 100;
      ttrCountdown = ticket.solved_at ? `Resuelto: ${formatDate(ticket.solved_at)}` : 'Resuelto';
    } else if (ticket.time_to_resolve) {
      const deadline = new Date(ticket.time_to_resolve).getTime();
      const created = new Date(ticket.created_at).getTime();
      const totalAllowed = Math.max(deadline - created, 1);
      const elapsed = Math.max(now - created, 0);
      ttrPercent = Math.min(Math.round((elapsed / totalAllowed) * 100), 100);
      const diffMs = deadline - now;
      const absDiff = Math.abs(diffMs);
      const hours = Math.floor(absDiff / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

      if (diffMs <= 0 || ticket.sla_ttr_status === 'breached') {
        ttrLabel = 'Vencido';
        ttrColor = '#ef4444';
        ttrBg = 'rgba(239, 68, 68, 0.15)';
        ttrBorder = 'rgba(239, 68, 68, 0.3)';
        ttrCountdown = `Vencido (+${hours}h ${minutes}m)`;
        ttrPercent = 100;
      } else if (ticket.sla_ttr_status === 'at_risk' || diffMs < 60 * 60 * 1000) {
        ttrLabel = 'En Riesgo';
        ttrColor = '#f59e0b';
        ttrBg = 'rgba(245, 158, 11, 0.15)';
        ttrBorder = 'rgba(245, 158, 11, 0.3)';
        ttrCountdown = `${hours > 0 ? `${hours}h ` : ''}${minutes}m restantes`;
      } else {
        ttrCountdown = `${hours > 0 ? `${hours}h ` : ''}${minutes}m restantes`;
      }
    }

    // TTO calculation
    let ttoLabel = 'Pendiente';
    let ttoColor = '#94a3b8';
    let ttoBg = 'rgba(148, 163, 184, 0.12)';
    let ttoBorder = 'rgba(148, 163, 184, 0.25)';
    if (ticket.acknowledged_at) {
      const isLate = ticket.sla_tto_status === 'breached';
      ttoLabel = isLate ? 'Atendido (Fuera de SLA)' : 'Atendido a Tiempo';
      ttoColor = isLate ? '#ef4444' : '#10b981';
      ttoBg = isLate ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
      ttoBorder = isLate ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
    } else if (ticket.time_to_own) {
      const ttoDeadline = new Date(ticket.time_to_own).getTime();
      if (now > ttoDeadline || ticket.sla_tto_status === 'breached') {
        ttoLabel = 'TTO Vencido';
        ttoColor = '#ef4444';
        ttoBg = 'rgba(239, 68, 68, 0.15)';
        ttoBorder = 'rgba(239, 68, 68, 0.3)';
      } else {
        ttoLabel = 'Dentro de Plazo';
        ttoColor = '#38bdf8';
        ttoBg = 'rgba(56, 189, 248, 0.15)';
        ttoBorder = 'rgba(56, 189, 248, 0.25)';
      }
    }

    // Escalations detection in followups
    const escalations = (ticket.followups || []).filter(
      (f) =>
        f.item_type === 'task' &&
        (f.content.includes('[Escalamiento SLA Automático]') || f.content.includes('Escalamiento'))
    );

    return {
      ttrLabel,
      ttrColor,
      ttrBg,
      ttrBorder,
      ttrPercent,
      ttrCountdown,
      ttoLabel,
      ttoColor,
      ttoBg,
      ttoBorder,
      escalations,
    };
  };

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
          <TicketDetailSkeleton />
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
                      <Tooltip key={step.key} content={step.description} position="bottom">
                        <button
                          type="button"
                          className={`lifecycle-step-btn ${isCurrent ? 'step-current' : ''} ${
                            isPassed ? 'step-passed' : ''
                          }`}
                          onClick={() => handleStatusChange(step.key)}
                          disabled={updatingStatus}
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
                      </Tooltip>
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
              {/* Technician & Group Dispatch Card */}
              <div className="sidebar-card dispatch-card">
                <div className="sidebar-card-header">
                  <UserCheck size={18} className="sidebar-icon" />
                  <h4>Despacho & Asignación</h4>
                </div>

                {/* Group Assignment Selector */}
                <div className="dispatch-selector-wrapper" style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="group-dispatch-select" className="sidebar-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={12} color="#38bdf8" />
                    <span>Grupo Transversal</span>
                  </label>
                  <select
                    id="group-dispatch-select"
                    className="ticket-select-input"
                    value={selectedGroupId}
                    onChange={(e) => handleGroupDispatchChange(e.target.value)}
                    disabled={updatingDispatch}
                  >
                    <option value="">-- Sin Grupo Asignado --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Technician Selector */}
                <div className="dispatch-selector-wrapper">
                  <label htmlFor="tech-dispatch-select" className="sidebar-label">
                    Técnico Especialista
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

                {/* Badges Display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.75rem' }}>
                  {ticket.assigned_group_name && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}
                    >
                      <Users size={15} color="#38bdf8" />
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grupo a Cargo</div>
                        <strong style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{ticket.assigned_group_name}</strong>
                      </div>
                    </div>
                  )}

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
                  ) : !ticket.assigned_group_name ? (
                    <div className="dispatch-unassigned-notice">
                      <Info size={14} /> Ticket en cola no asignada
                    </div>
                  ) : null}
                </div>
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
              {(() => {
                const sla = getTicketSlaDetails();
                return (
                  <div className="sidebar-card">
                    <div className="sidebar-card-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} className="sidebar-icon" />
                        <h4>Tiempos y SLA</h4>
                      </div>
                      {ticket.sla_name && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.15rem 0.5rem',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#818cf8',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                          }}
                        >
                          {ticket.sla_name}
                        </span>
                      )}
                    </div>

                    <div className="metadata-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* TTR (Resolución) Tracker */}
                      {ticket.time_to_resolve && (
                        <div
                          style={{
                            padding: '0.6rem 0.75rem',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              Límite de Solución (TTR)
                            </span>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.45rem',
                                backgroundColor: sla?.ttrBg,
                                color: sla?.ttrColor,
                                border: `1px solid ${sla?.ttrBorder}`,
                                fontWeight: 600,
                              }}
                            >
                              {sla?.ttrLabel}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {formatDate(ticket.time_to_resolve)}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: sla?.ttrColor, fontWeight: 500 }}>
                              {sla?.ttrCountdown}
                            </span>
                          </div>

                          {ticket.status !== 'solved' && ticket.status !== 'closed' && (
                            <div
                              style={{
                                width: '100%',
                                height: '6px',
                                borderRadius: '3px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                overflow: 'hidden',
                                marginTop: '0.2rem',
                              }}
                            >
                              <div
                                style={{
                                  width: `${sla?.ttrPercent}%`,
                                  height: '100%',
                                  backgroundColor: sla?.ttrColor,
                                  transition: 'width 0.4s ease',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* TTO (Toma / Atención) Tracker */}
                      {ticket.time_to_own && (
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              Primera Atención (TTO)
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginTop: '0.1rem' }}>
                              {ticket.acknowledged_at
                                ? `Atendido: ${formatDate(ticket.acknowledged_at)}`
                                : `Meta: ${formatDate(ticket.time_to_own)}`}
                            </div>
                          </div>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.66rem',
                              padding: '0.1rem 0.45rem',
                              backgroundColor: sla?.ttoBg,
                              color: sla?.ttoColor,
                              border: `1px solid ${sla?.ttoBorder}`,
                            }}
                          >
                            {sla?.ttoLabel}
                          </span>
                        </div>
                      )}

                      {/* Active Escalations Alert */}
                      {sla?.escalations && sla.escalations.length > 0 && (
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            borderRadius: 'var(--border-radius-sm)',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>
                            <Zap size={13} />
                            <span>Escalamiento Automático Activado ({sla.escalations.length})</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {sla.escalations[sla.escalations.length - 1].content.slice(0, 80)}...
                          </div>
                        </div>
                      )}

                      {/* Standard Timestamps */}
                      <div className="metadata-item" style={{ marginTop: '0.25rem' }}>
                        <span className="metadata-label">Fecha de Apertura</span>
                        <span className="metadata-value">{formatDate(ticket.created_at)}</span>
                      </div>

                      <div className="metadata-item">
                        <span className="metadata-label">Última Modificación</span>
                        <span className="metadata-value">{formatDate(ticket.updated_at)}</span>
                      </div>

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
                );
              })()}

              {/* Customer Satisfaction & Survey Card */}
              <div className="sidebar-card">
                <div className="sidebar-card-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <HeartHandshake size={18} className="sidebar-icon" style={{ color: 'var(--accent-coral)' }} />
                    <h4>Satisfacción del Cliente</h4>
                  </div>
                  {surveyToken && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        background:
                          surveyToken.status === 'completed'
                            ? 'rgba(52, 211, 153, 0.15)'
                            : surveyToken.status === 'expired'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(251, 191, 36, 0.15)',
                        color:
                          surveyToken.status === 'completed'
                            ? '#34d399'
                            : surveyToken.status === 'expired'
                            ? '#f87171'
                            : '#fbbf24',
                      }}
                    >
                      {surveyToken.status === 'completed'
                        ? 'Completada'
                        : surveyToken.status === 'expired'
                        ? 'Expirada'
                        : 'En Espera'}
                    </span>
                  )}
                </div>

                <div className="metadata-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {surveyToken ? (
                    <>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Encuesta: <strong style={{ color: 'var(--text-primary)' }}>{surveyToken.survey_name}</strong>
                      </div>

                      {surveyToken.status === 'completed' ? (
                        <div
                          style={{
                            padding: '0.6rem',
                            borderRadius: '6px',
                            background: 'rgba(52, 211, 153, 0.1)',
                            border: '1px solid rgba(52, 211, 153, 0.25)',
                            fontSize: '0.8rem',
                            color: '#34d399',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>Encuesta respondida el {formatDate(surveyToken.answered_at || surveyToken.created_at)}</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Expira: {formatDate(surveyToken.expires_at)}
                          </div>

                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const fullUrl = `${window.location.origin}/survey/${surveyToken.token}`;
                                navigator.clipboard.writeText(fullUrl);
                                toast.success('Enlace copiado', 'URL de satisfacción copiada');
                              }}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                            >
                              <Copy size={13} />
                              <span>Copiar Enlace</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const fullUrl = `${window.location.origin}/survey/${surveyToken.token}`;
                                const text = encodeURIComponent(
                                  `Hola! Nos gustaría conocer tu opinión sobre el ticket #${ticket.ticket_number}. Por favor completa la encuesta: ${fullUrl}`
                                );
                                window.open(`https://wa.me/?text=${text}`, '_blank');
                              }}
                              title="Compartir por WhatsApp"
                              style={{ color: '#34d399' }}
                            >
                              <Share2 size={13} />
                            </button>

                            <a
                              href={`/survey/${surveyToken.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              title="Abrir Encuesta"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                        No se ha emitido enlace de satisfacción para este ticket aún.
                      </p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={generatingToken}
                        onClick={handleGenerateTicketToken}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                      >
                        <HeartHandshake size={13} />
                        <span>{generatingToken ? 'Generando...' : 'Generar Enlace de Encuesta'}</span>
                      </button>
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
