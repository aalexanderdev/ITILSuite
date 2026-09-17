import React from 'react';
import { useToast, type ToastType } from '../../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactElement> = {
  success: <CheckCircle2 size={18} className="toast-icon-svg toast-icon-success" />,
  error: <AlertCircle size={18} className="toast-icon-svg toast-icon-error" />,
  warning: <AlertTriangle size={18} className="toast-icon-svg toast-icon-warning" />,
  info: <Info size={18} className="toast-icon-svg toast-icon-info" />,
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-live="polite" aria-label="Notificaciones">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={`toast-card toast-card--${item.type}`}
          role="alert"
        >
          <div className="toast-icon-wrapper">{ICONS[item.type]}</div>
          <div className="toast-content-wrapper">
            <span className="toast-title">{item.title}</span>
            {item.message && <p className="toast-message">{item.message}</p>}
          </div>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={() => dismissToast(item.id)}
            aria-label="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
