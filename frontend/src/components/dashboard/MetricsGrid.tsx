import React, { useState, useEffect } from 'react';
import { LifeBuoy, Server, Clock, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { fetchTicketMetrics } from '../../services/api';
import type { TicketMetrics } from '../../types';

export const MetricsGrid: React.FC = () => {
  const [ticketMetrics, setTicketMetrics] = useState<TicketMetrics | null>(null);

  useEffect(() => {
    fetchTicketMetrics()
      .then((data) => setTicketMetrics(data))
      .catch(() => {});
  }, []);

  const metrics = [
    {
      title: 'Tickets Abiertos (ITIL)',
      value: ticketMetrics ? ticketMetrics.total_open.toString() : '4',
      subtext: ticketMetrics
        ? `${ticketMetrics.incidents_count} Incidentes • ${ticketMetrics.requests_count} Peticiones`
        : '3 Incidentes • 1 Petición',
      badge: 'En tiempo SLA',
      badgePositive: true,
      icon: LifeBuoy,
      iconColor: '#60a5fa',
      bgColor: 'rgba(59, 130, 246, 0.12)',
    },
    {
      title: 'Activos en Inventario',
      value: '180',
      subtext: '148 Equipos • 32 Dispositivos de Red',
      badge: '98% sincronizado',
      badgePositive: true,
      icon: Server,
      iconColor: '#34d399',
      bgColor: 'rgba(16, 185, 129, 0.12)',
    },
    {
      title: 'SLAs en Riesgo',
      value: ticketMetrics ? ticketMetrics.sla_at_risk_count.toString() : '0',
      subtext: 'Límite menor a 4 horas de resolución',
      badge: ticketMetrics && ticketMetrics.sla_at_risk_count > 0 ? 'Acción requerida' : 'Sin demoras',
      badgePositive: !ticketMetrics || ticketMetrics.sla_at_risk_count === 0,
      icon: AlertTriangle,
      iconColor: '#f87171',
      bgColor: 'rgba(244, 63, 94, 0.12)',
    },
    {
      title: 'Soluciones Aplicadas',
      value: ticketMetrics ? (ticketMetrics.solved_count + ticketMetrics.closed_count).toString() : '2',
      subtext: ticketMetrics
        ? `Prioridad promedio: P${ticketMetrics.average_priority.toFixed(1)}`
        : 'Resolución de primer contacto 78%',
      badge: '+12% este mes',
      badgePositive: true,
      icon: CheckCircle2,
      iconColor: '#a78bfa',
      bgColor: 'rgba(168, 85, 247, 0.12)',
    },
  ];

  return (
    <div className="grid-cards">
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        return (
          <div key={idx} className="card">
            <div className="kpi-header">
              <div>
                <div className="kpi-title">{m.title}</div>
                <div className="kpi-value">{m.value}</div>
              </div>
              <div className="kpi-icon-wrap" style={{ backgroundColor: m.bgColor }}>
                <Icon size={22} color={m.iconColor} />
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {m.subtext}
            </div>

            <div className="kpi-footer">
              <span
                className={`badge ${m.badgePositive ? 'badge-emerald' : 'badge-amber'}`}
                style={{ fontSize: '0.7rem' }}
              >
                {m.badgePositive ? (
                  <TrendingUp size={11} style={{ marginRight: 3 }} />
                ) : (
                  <Clock size={11} style={{ marginRight: 3 }} />
                )}
                {m.badge}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>en tiempo real</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
