import React from 'react';
import { LifeBuoy, Server, Clock, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

export const MetricsGrid: React.FC = () => {
  const metrics = [
    {
      title: 'Open Tickets (ITIL)',
      value: '24',
      subtext: '16 Incidents • 8 Service Requests',
      badge: '+3 today',
      badgePositive: false,
      icon: LifeBuoy,
      iconColor: '#60a5fa',
      bgColor: 'rgba(59, 130, 246, 0.12)',
    },
    {
      title: 'Assets in Inventory',
      value: '180',
      subtext: '148 Computers • 32 Network Devices',
      badge: '98% synchronized',
      badgePositive: true,
      icon: Server,
      iconColor: '#34d399',
      bgColor: 'rgba(168, 85, 247, 0.12)',
    },
    {
      title: 'Resolution SLAs at Risk',
      value: '2',
      subtext: 'Expiring in less than 2 hours',
      badge: 'Action required',
      badgePositive: false,
      icon: AlertTriangle,
      iconColor: '#f87171',
      bgColor: 'rgba(244, 63, 94, 0.12)',
    },
    {
      title: 'First Contact Resolution',
      value: '78.4%',
      subtext: 'Global average across Root Entity',
      badge: '+4.2% vs last month',
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
                {m.badgePositive ? <TrendingUp size={11} style={{ marginRight: 3 }} /> : <Clock size={11} style={{ marginRight: 3 }} />}
                {m.badge}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>real-time</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
