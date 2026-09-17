import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createTicket, fetchUsers, fetchEntities } from '../../services/api';
import type { TicketSummary, UserSummary, EntityTreeNode, TicketType } from '../../types';
import { PriorityMatrixPicker } from './PriorityMatrixPicker';
import {
  X,
  Plus,
  LifeBuoy,
  AlertTriangle,
  Building2,
  UserCheck,
  Tag,
  FileText,
} from 'lucide-react';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated: (ticket: TicketSummary) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  onTicketCreated,
}) => {
  const { activeEntity } = useAuth();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [ticketType, setTicketType] = useState<TicketType>('incident');
  const [urgency, setUrgency] = useState(3);
  const [impact, setImpact] = useState(3);
  const [category, setCategory] = useState('Hardware / Equipos');
  const [assignedTechnicianId, setAssignedTechnicianId] = useState<string>('');
  const [entityId, setEntityId] = useState<string>(activeEntity.id);

  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [entities, setEntities] = useState<EntityTreeNode[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntityId(activeEntity.id);
      fetchUsers()
        .then((users) => {
          // Technicians or Admins eligible for dispatch
          const techs = users.filter(
            (u) => u.profile_name === 'Technician' || u.profile_name === 'Super-Admin'
          );
          setTechnicians(techs);
        })
        .catch(() => {});

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
    }
  }, [isOpen, activeEntity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor indica un título para el ticket');
      return;
    }
    if (!content.trim()) {
      setError('Por favor detalla la descripción del incidente o solicitud');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createTicket({
        name: name.trim(),
        content: content.trim(),
        ticket_type: ticketType,
        urgency,
        impact,
        entity_id: entityId || activeEntity.id,
        assigned_technician_id: assignedTechnicianId || undefined,
        category,
      });

      onTicketCreated(created);
      onClose();
      // Reset form
      setName('');
      setContent('');
      setUrgency(3);
      setImpact(3);
      setAssignedTechnicianId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar el ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
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
                Módulo ITIL Service Desk v0.0.3 • Gestión de Incidentes y Peticiones de Servicio
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-icon" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

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
          {/* Ticket Type Toggle: Incidente vs Petición */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>
              Tipo de Ticket (ITIL)
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
                    Solicitud de acceso, nuevo equipo o asesoría estándar
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

            {/* Technician Dispatch */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                <UserCheck size={13} color="#34d399" />
                <span>Despachar a Técnico</span>
              </label>
              <select
                value={assignedTechnicianId}
                onChange={(e) => setAssignedTechnicianId(e.target.value)}
                className="input-control"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">Sin asignar (Bolsa común de la mesa)</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name} ({t.profile_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
              <Tag size={13} color="#c084fc" />
              <span>Categoría del Servicio</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-control"
              style={{ fontSize: '0.8rem' }}
            >
              <option value="Hardware / Equipos">Hardware / Equipos de Cómputo</option>
              <option value="Software / Licencias">Software / Licenciamiento y Aplicaciones</option>
              <option value="Redes / Telecomunicaciones">Redes / Telecomunicaciones y VPN</option>
              <option value="Acceso & Seguridad">Acceso, Cuentas y Ciberseguridad</option>
              <option value="Servidores & Storage">Servidores, Storage y Cloud</option>
              <option value="Periféricos / Impresión">Periféricos e Impresión</option>
            </select>
          </div>

          {/* Interactive Urgency x Impact Matrix */}
          <PriorityMatrixPicker
            urgency={urgency}
            impact={impact}
            onChangeUrgency={setUrgency}
            onChangeImpact={setImpact}
          />

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
              rows={4}
              required
              className="input-control"
              style={{ fontSize: '0.82rem', resize: 'vertical' }}
            />
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
