import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createTicket,
  fetchUsers,
  fetchEntities,
  fetchTicketTemplates,
  fetchGroups,
} from '../../services/api';
import type {
  TicketSummary,
  UserSummary,
  EntityTreeNode,
  TicketType,
  TicketTemplate,
  GroupSummary,
} from '../../types';
import { PriorityMatrixPicker } from './PriorityMatrixPicker';
import { TemplateSelectorCard } from './TemplateSelectorCard';
import { useToast } from '../../context/ToastContext';
import {
  X,
  Plus,
  LifeBuoy,
  AlertTriangle,
  Building2,
  UserCheck,
  Tag,
  FileText,
  Info,
  Users,
} from 'lucide-react';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (ticket: TicketSummary) => void;
  initialTemplateId?: string | null;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
  initialTemplateId,
}) => {
  const { toast } = useToast();
  const { activeEntity } = useAuth();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [ticketType, setTicketType] = useState<TicketType>('incident');
  const [urgency, setUrgency] = useState(3);
  const [impact, setImpact] = useState(3);
  const [category, setCategory] = useState('Hardware / Equipos');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string>('');
  const [assignedGroupId, setAssignedGroupId] = useState<string>('');
  const [entityId, setEntityId] = useState<string>(activeEntity.id);

  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TicketTemplate | null>(null);

  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [transversalGroups, setTransversalGroups] = useState<GroupSummary[]>([]);
  const [entities, setEntities] = useState<EntityTreeNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntityId(activeEntity.id);
      setError(null);

      // Load Users for Dispatch
      fetchUsers()
        .then((users) => {
          const techs = users.filter(
            (u) => u.profile_name === 'Technician' || u.profile_name === 'Super-Admin'
          );
          setTechnicians(techs);
        })
        .catch(() => {});

      // Load Transversal Groups for Dispatch
      fetchGroups()
        .then((grps) => {
          setTransversalGroups(grps.filter((g) => g.is_task));
        })
        .catch(() => {});

      // Load Entities
      fetchEntities()
        .then((tree) => {
          const flatten = (nodes: EntityTreeNode[], list: EntityTreeNode[] = []): EntityTreeNode[] => {
            for (const n of nodes) {
              list.push(n);
              if (n.children && n.children.length > 0) flatten(n.children, list);
            }
            return list;
          };
          setEntities(flatten(tree));
        })
        .catch(() => {});

      // Load Ticket Templates (GLPI Inspired)
      fetchTicketTemplates({ entity_id: activeEntity.id })
        .then((tpls) => {
          setTemplates(tpls);
          if (initialTemplateId) {
            const match = tpls.find((t) => t.id === initialTemplateId);
            if (match) applyTemplate(match);
          }
        })
        .catch(() => {});
    } else {
      setSelectedTemplate(null);
    }
  }, [isOpen, activeEntity, initialTemplateId]);

  const applyTemplate = (tpl: TicketTemplate | null) => {
    setSelectedTemplate(tpl);
    setError(null);

    if (!tpl) {
      // Revert to default clean state
      return;
    }

    // 1. Predefined Title & Content
    if (tpl.predefined_title) {
      setName(tpl.predefined_title);
    }
    if (tpl.predefined_content) {
      setContent(tpl.predefined_content);
    }

    // 2. Predefined Type & Category
    setTicketType(tpl.ticket_type);
    if (tpl.category) {
      setCategory(tpl.category);
    }

    // 3. Predefined Urgency & Impact
    if (tpl.predefined_urgency) {
      setUrgency(tpl.predefined_urgency);
    }
    if (tpl.predefined_impact) {
      setImpact(tpl.predefined_impact);
    }

    // 4. Default Technician Dispatch
    if (tpl.default_technician_id) {
      setAssignedTechnicianId(tpl.default_technician_id);
    }
  };

  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);

    // GLPI Feature: Link template to category automatically
    const matchingTpl = templates.find(
      (t) => t.category && t.category.toLowerCase() === newCat.toLowerCase()
    );
    if (matchingTpl && (!selectedTemplate || selectedTemplate.category !== newCat)) {
      applyTemplate(matchingTpl);
    }
  };

  if (!isOpen) return null;

  // Check hidden fields
  const isPriorityHidden =
    selectedTemplate?.hidden_fields.includes('urgency') ||
    selectedTemplate?.hidden_fields.includes('impact');
  const isTechnicianHidden = selectedTemplate?.hidden_fields.includes('assigned_technician_id');

  // Check mandatory fields
  const isUrgencyMandatory = selectedTemplate?.mandatory_fields.includes('urgency');
  const isCategoryMandatory = selectedTemplate?.mandatory_fields.includes('category');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor indica un título para el ticket');
      return;
    }

    if (!content.trim()) {
      setError('Por favor detalla la descripción del incidente o solicitud');
      return;
    }

    // GLPI Rule: If description is mandatory and unchanged from template default, force user modification
    if (
      selectedTemplate &&
      selectedTemplate.mandatory_fields.includes('content') &&
      selectedTemplate.predefined_content &&
      content.trim() === selectedTemplate.predefined_content.trim()
    ) {
      setError(
        'La plantilla requiere que completes la información específica del caso (no dejes los valores por defecto sin editar)'
      );
      return;
    }

    if (isCategoryMandatory && !category) {
      setError('La categoría del servicio es obligatoria para esta plantilla');
      return;
    }

    if (isUrgencyMandatory && urgency <= 0) {
      setError('El nivel de urgencia es obligatorio para esta plantilla');
      return;
    }

    setSubmitting(true);

    try {
      const created = await createTicket({
        name: name.trim(),
        content: content.trim(),
        ticket_type: ticketType,
        urgency,
        impact,
        entity_id: entityId || activeEntity.id,
        assigned_technician_id: assignedTechnicianId || undefined,
        assigned_group_id: assignedGroupId || undefined,
        category,
      });

      onTicketCreated(created);
      toast.success(
        `Ticket ${created.ticket_number} creado`,
        `${created.name} (${created.ticket_type === 'incident' ? 'Incidente' : 'Solicitud'})`
      );
      onClose();

      // Reset form
      setName('');
      setContent('');
      setUrgency(3);
      setImpact(3);
      setAssignedTechnicianId('');
      setSelectedTemplate(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar el ticket';
      toast.error('Error al registrar ticket', msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content create-ticket-modal-shell"
        style={{ maxWidth: 780, maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Crear Nuevo Ticket de Mesa de Ayuda
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ITIL Service Desk v0.0.3 • Plantillas Estandarizadas GLPI
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              margin: '1rem 1.5rem 0',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.8rem',
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Template Selector (GLPI Inspired) */}
          <TemplateSelectorCard
            templates={templates}
            selectedTemplateId={selectedTemplate?.id || null}
            onSelectTemplate={applyTemplate}
          />

          {/* Active Template Rules Indicator */}
          {selectedTemplate && (
            <div className="active-template-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                <Info size={15} />
                <span>Plantilla activa: <strong>{selectedTemplate.name}</strong></span>
              </div>
              <div className="template-rules-badges">
                {selectedTemplate.mandatory_fields.length > 0 && (
                  <span className="badge-rule mandatory">
                    {selectedTemplate.mandatory_fields.length} campos requeridos
                  </span>
                )}
                {selectedTemplate.hidden_fields.length > 0 && (
                  <span className="badge-rule hidden">
                    Formulario simplificado ({selectedTemplate.hidden_fields.length} campos pre-fijados)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ticket Type Toggle: Incidente vs Petición */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>
              Tipo de Ticket (ITIL) *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setTicketType('incident')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: ticketType === 'incident' ? 'rgba(239, 68, 68, 0.12)' : 'var(--card-subtle-bg)',
                  border: `1.5px solid ${ticketType === 'incident' ? '#ef4444' : 'var(--border-subtle)'}`,
                  color: ticketType === 'incident' ? '#f87171' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <AlertTriangle size={20} color={ticketType === 'incident' ? '#ef4444' : 'currentColor'} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Incidente</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Interrupción o fallo no planeado en un servicio TI
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTicketType('request')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: ticketType === 'request' ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-subtle-bg)',
                  border: `1.5px solid ${ticketType === 'request' ? '#3b82f6' : 'var(--border-subtle)'}`,
                  color: ticketType === 'request' ? '#60a5fa' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LifeBuoy size={20} color={ticketType === 'request' ? '#3b82f6' : 'currentColor'} />
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Petición de Servicio</strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Solicitud de acceso, nuevo equipo o asistencia estándar
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              Título o Asunto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Falla en enlace de fibra óptica / Solicitud de monitor 27''"
              required
              className="input-control"
              style={{ fontSize: '0.85rem', padding: '0.65rem 0.85rem' }}
            />
          </div>

          {/* Scopes & Dispatch Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Entity Scope */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                <Building2 size={13} color="#60a5fa" />
                <span>Ámbito de Entidad</span>
              </label>
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="input-control"
                style={{ fontSize: '0.8rem' }}
              >
                {entities.length === 0 ? (
                  <option value={activeEntity.id}>{activeEntity.name}</option>
                ) : (
                  entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} (Nivel {ent.level})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Transversal Group Dispatch */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                <Users size={13} color="#38bdf8" />
                <span>Grupo Transversal Asignado</span>
              </label>
              <select
                value={assignedGroupId}
                onChange={(e) => setAssignedGroupId(e.target.value)}
                className="input-control"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">Sin grupo asignado</option>
                {transversalGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count} miembros)
                  </option>
                ))}
              </select>
            </div>

            {/* Technician Dispatch (Conditional if not hidden) */}
            {!isTechnicianHidden && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  <UserCheck size={13} color="#34d399" />
                  <span>Técnico Individual Asignado</span>
                </label>
                <select
                  value={assignedTechnicianId}
                  onChange={(e) => setAssignedTechnicianId(e.target.value)}
                  className="input-control"
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="">Sin asignar (Bolsa común de la mesa / Asignado al grupo)</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name} ({t.profile_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              <Tag size={13} color="#c084fc" />
              <span>Categoría del Servicio {isCategoryMandatory ? '*' : ''}</span>
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="input-control"
              style={{ fontSize: '0.8rem' }}
            >
              <option value="Hardware / Equipos">Hardware / Equipos (Laptops, PCs, Servidores)</option>
              <option value="Sistemas / Correo">Sistemas / Correo Electrónico y Buzones</option>
              <option value="Cuentas y Accesos">Cuentas y Accesos (VPN, Directorio Activo)</option>
              <option value="Gestión de Personal">Gestión de Personal (Onboarding TI, Bajas)</option>
              <option value="Redes / Infraestructura">Redes / Infraestructura y Enlaces</option>
              <option value="Software / Licencias">Software / Licenciamiento y Aplicaciones</option>
              <option value="Periféricos / Impresión">Periféricos e Impresión</option>
            </select>
          </div>

          {/* Interactive Urgency x Impact Matrix (Conditional if not hidden by template) */}
          {!isPriorityHidden ? (
            <PriorityMatrixPicker
              urgency={urgency}
              impact={impact}
              onChangeUrgency={setUrgency}
              onChangeImpact={setImpact}
            />
          ) : (
            <div className="hidden-priority-notice">
              <span className="notice-title">Prioridad Predefinida por Plantilla:</span>
              <span className="notice-badge">Urgencia {urgency} • Impacto {impact}</span>
              <span className="notice-desc">Esta solicitud cuenta con matriz de prioridad estandarizada</span>
            </div>
          )}

          {/* Description Content */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              <FileText size={13} color="#94a3b8" />
              <span>Descripción Detallada *</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Indica paso a paso qué ocurre, personas afectadas, mensajes de error observados y ubicación..."
              rows={5}
              required
              className="input-control"
              style={{ fontSize: '0.82rem', resize: 'vertical', fontFamily: 'var(--font-mono)' }}
            />
            {selectedTemplate && selectedTemplate.mandatory_fields.includes('content') && (
              <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--accent-amber)' }}>
                * Por favor completa cada uno de los puntos requeridos en el cuestionario de la plantilla.
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.5rem', gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>{submitting ? 'Creando ticket...' : 'Registrar Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
