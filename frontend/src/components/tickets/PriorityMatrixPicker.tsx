import React from 'react';
import { Zap, ShieldAlert } from 'lucide-react';

interface PriorityMatrixPickerProps {
  urgency: number;
  impact: number;
  onChangeUrgency: (val: number) => void;
  onChangeImpact: (val: number) => void;
}

export function calculatePriority(urgency: number, impact: number): number {
  const u = Math.min(5, Math.max(1, urgency));
  const i = Math.min(5, Math.max(1, impact));

  // Rows: Urgency 1..5, Cols: Impact 1..5
  const matrix: number[][] = [
    [1, 1, 2, 3, 4], // Urgency 1
    [1, 2, 2, 3, 4], // Urgency 2
    [2, 2, 3, 4, 5], // Urgency 3
    [3, 3, 4, 5, 5], // Urgency 4
    [4, 4, 5, 5, 5], // Urgency 5
  ];

  return matrix[u - 1][i - 1];
}

export function getPriorityMeta(priority: number) {
  switch (priority) {
    case 5:
      return {
        label: 'Crítica / Muy Alta (P1)',
        color: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.15)',
        border: 'rgba(244, 63, 94, 0.35)',
        sla: 'SLA: 4 Horas',
      };
    case 4:
      return {
        label: 'Alta (P2)',
        color: '#fb923c',
        bg: 'rgba(249, 115, 22, 0.15)',
        border: 'rgba(249, 115, 22, 0.35)',
        sla: 'SLA: 8 Horas',
      };
    case 3:
      return {
        label: 'Media (P3)',
        color: '#fbbf24',
        bg: 'rgba(245, 158, 11, 0.15)',
        border: 'rgba(245, 158, 11, 0.35)',
        sla: 'SLA: 24 Horas',
      };
    case 2:
      return {
        label: 'Baja (P4)',
        color: '#60a5fa',
        bg: 'rgba(59, 130, 246, 0.15)',
        border: 'rgba(59, 130, 246, 0.35)',
        sla: 'SLA: 48 Horas',
      };
    default:
      return {
        label: 'Muy Baja (P5)',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.15)',
        border: 'rgba(148, 163, 184, 0.35)',
        sla: 'SLA: 72 Horas',
      };
  }
}

export const PriorityMatrixPicker: React.FC<PriorityMatrixPickerProps> = ({
  urgency,
  impact,
  onChangeUrgency,
  onChangeImpact,
}) => {
  const priority = calculatePriority(urgency, impact);
  const meta = getPriorityMeta(priority);

  const urgencyLabels = [
    { val: 1, text: '1 - Muy Baja', desc: 'No interrumpe tareas cotidianas' },
    { val: 2, text: '2 - Baja', desc: 'Inconveniente menor con alternativa' },
    { val: 3, text: '3 - Media', desc: 'Degradación parcial de servicio' },
    { val: 4, text: '4 - Alta', desc: 'Operación severamente afectada' },
    { val: 5, text: '5 - Muy Alta', desc: 'Servicio totalmente paralizado' },
  ];

  const impactLabels = [
    { val: 1, text: '1 - Muy Bajo', desc: 'Un solo usuario afectado' },
    { val: 2, text: '2 - Bajo', desc: 'Un grupo pequeño o área menor' },
    { val: 3, text: '3 - Medio', desc: 'Departamento o sede completa' },
    { val: 4, text: '4 - Alto', desc: 'Múltiples áreas clave del negocio' },
    { val: 5, text: '5 - Muy Alto', desc: 'Organización entera o clientes' },
  ];

  return (
    <div className="priority-matrix-picker" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Priority Result Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-md)',
          background: meta.bg,
          border: `1px solid ${meta.border}`,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              padding: '0.35rem',
              borderRadius: '6px',
              background: meta.bg,
              color: meta.color,
              display: 'flex',
            }}
          >
            {priority >= 4 ? <ShieldAlert size={18} /> : <Zap size={18} />}
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              PRIORIDAD CALCULADA (MATRIZ ITIL)
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: meta.color }}>
              {meta.label}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--card-subtle-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {meta.sla}
          </span>
        </div>
      </div>

      {/* Dual Selector: Urgencia e Impacto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Urgency */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>
            Urgencia (Velocidad requerida)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {urgencyLabels.map((item) => (
              <button
                type="button"
                key={item.val}
                onClick={() => onChangeUrgency(item.val)}
                className={`matrix-option-btn ${urgency === item.val ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: urgency === item.val ? 'rgba(59, 130, 246, 0.15)' : 'var(--card-subtle-bg)',
                  border: `1px solid ${urgency === item.val ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                  color: urgency === item.val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: urgency === item.val ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{item.text}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Impact */}
        <div>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.45rem', color: 'var(--text-primary)' }}>
            Impacto (Magnitud y alcance)
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {impactLabels.map((item) => (
              <button
                type="button"
                key={item.val}
                onClick={() => onChangeImpact(item.val)}
                className={`matrix-option-btn ${impact === item.val ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: impact === item.val ? 'rgba(59, 130, 246, 0.15)' : 'var(--card-subtle-bg)',
                  border: `1px solid ${impact === item.val ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                  color: impact === item.val ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: impact === item.val ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{item.text}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
