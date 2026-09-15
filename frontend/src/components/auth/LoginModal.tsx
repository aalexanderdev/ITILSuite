import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Lock, LogIn, X, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login, loginModalOpen, setLoginModalOpen } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!loginModalOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setUsername('admin');
    setPassword('admin');
    setError(null);
    setIsSubmitting(true);
    try {
      await login('admin', 'admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Quick login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setLoginModalOpen(false)}>
      <div
        className="modal-content"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Sign In to ITILSuite
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enterprise ITSM & Asset Multi-Tenant Session
              </p>
            </div>
          </div>
          <button
            onClick={() => setLoginModalOpen(false)}
            className="btn-icon"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '0.8rem',
              margin: '0.75rem 1.25rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.4rem',
              }}
            >
              Username
            </label>
            <div className="input-with-icon">
              <User size={16} color="#9ca3af" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                required
                className="input-control"
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <div className="input-with-icon">
              <Lock size={16} color="#9ca3af" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-control"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
            >
              <LogIn size={16} />
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
            </button>

            <button
              type="button"
              onClick={handleQuickAdminLogin}
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '0.55rem',
                borderColor: 'rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.06)',
                color: '#93c5fd',
              }}
            >
              <Sparkles size={14} color="#60a5fa" />
              <span>Quick Login as Admin (Default)</span>
            </button>
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.25rem' }}>
            Argon2id password verification • 24-hour signed JWT
          </div>
        </form>
      </div>
    </div>
  );
};
