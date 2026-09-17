import React from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'badge';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style = {},
}) => {
  const inlineStyles: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <span
      className={`skeleton-box skeleton-box--${variant} ${className}`}
      style={inlineStyles}
      aria-hidden="true"
    />
  );
};

export const TicketTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  return (
    <div className="tickets-table-skeleton" aria-busy="true" aria-label="Cargando tickets">
      <table className="tickets-table">
        <thead>
          <tr>
            <th style={{ width: '125px' }}>Ticket #</th>
            <th style={{ width: '110px' }}>Tipo</th>
            <th>Título y Categoría</th>
            <th style={{ width: '130px' }}>Prioridad</th>
            <th style={{ width: '110px' }}>Estado</th>
            <th style={{ width: '170px' }}>Técnico Asignado</th>
            <th style={{ width: '140px' }}>Límite SLA</th>
            <th style={{ width: '85px', textAlign: 'center' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={`skeleton-row-${i}`} className="ticket-row-skeleton">
              <td>
                <Skeleton variant="badge" width={90} height={22} />
              </td>
              <td>
                <Skeleton variant="badge" width={80} height={22} />
              </td>
              <td>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <Skeleton variant="text" width={i % 2 === 0 ? '75%' : '60%'} height={15} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Skeleton variant="text" width={110} height={12} />
                    <Skeleton variant="text" width={90} height={12} />
                  </div>
                </div>
              </td>
              <td>
                <Skeleton variant="badge" width={95} height={22} />
              </td>
              <td>
                <Skeleton variant="badge" width={75} height={22} />
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Skeleton variant="circular" width={22} height={22} />
                  <Skeleton variant="text" width={90} height={14} />
                </div>
              </td>
              <td>
                <Skeleton variant="text" width={95} height={14} />
              </td>
              <td style={{ textAlign: 'center' }}>
                <Skeleton variant="rectangular" width={28} height={28} style={{ borderRadius: '6px', margin: '0 auto' }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const TicketDetailSkeleton: React.FC = () => {
  return (
    <div className="ticket-detail-skeleton-container" aria-busy="true" aria-label="Cargando detalles del ticket">
      {/* Pipeline Stepper Skeleton */}
      <div className="skeleton-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <Skeleton variant="text" width={140} height={16} />
          <Skeleton variant="text" width={220} height={13} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={42} style={{ borderRadius: '8px' }} />
          ))}
        </div>
      </div>

      {/* Grid: Main + Sidebar */}
      <div className="ticket-modal-content-grid">
        {/* Main Col */}
        <div className="ticket-modal-main-col">
          <div className="skeleton-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
            <Skeleton variant="text" width={160} height={16} style={{ marginBottom: '1rem' }} />
            <Skeleton variant="text" width="95%" height={14} style={{ marginBottom: '0.5rem' }} />
            <Skeleton variant="text" width="85%" height={14} style={{ marginBottom: '0.5rem' }} />
            <Skeleton variant="text" width="70%" height={14} />
          </div>

          <div className="skeleton-card" style={{ padding: '1.25rem' }}>
            <Skeleton variant="text" width={180} height={16} style={{ marginBottom: '1.25rem' }} />
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <Skeleton variant="circular" width={32} height={32} />
              <div style={{ flex: 1 }}>
                <Skeleton variant="text" width={120} height={14} style={{ marginBottom: '0.4rem' }} />
                <Skeleton variant="text" width="90%" height={13} />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Col */}
        <div className="ticket-modal-sidebar">
          <div className="skeleton-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <Skeleton variant="text" width={120} height={15} style={{ marginBottom: '0.75rem' }} />
            <Skeleton variant="rectangular" height={50} style={{ borderRadius: '6px', marginBottom: '0.75rem' }} />
            <Skeleton variant="text" width={100} height={14} />
          </div>

          <div className="skeleton-card" style={{ padding: '1rem' }}>
            <Skeleton variant="text" width={130} height={15} style={{ marginBottom: '0.75rem' }} />
            <Skeleton variant="rectangular" height={38} style={{ borderRadius: '6px', marginBottom: '0.75rem' }} />
            <Skeleton variant="text" width="80%" height={13} />
          </div>
        </div>
      </div>
    </div>
  );
};
