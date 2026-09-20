import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle2, Users } from 'lucide-react';
import type { GroupSummary } from '../../types';
import { createUser, fetchGroups } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onUserCreated,
}) => {
  const { activeEntity } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [firstname, setFirstname] = useState('');
  const [realname, setRealname] = useState('');
  const [password, setPassword] = useState('');
  const [profileId, setProfileId] = useState('00000000-0000-0000-0000-000000000012'); // Self-Service
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchGroups().then(setAvailableGroups).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) {
      setError('Nombre de usuario y correo electrónico son obligatorios');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createUser({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        firstname: firstname.trim() || undefined,
        realname: realname.trim() || undefined,
        password: password.trim() || undefined,
        profile_id: profileId,
        entity_id: activeEntity.id,
        initial_group_ids: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
      });

      toast.success(
        'Usuario creado exitosamente',
        `El usuario @${username} ha sido registrado en el directorio.`
      );

      onUserCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%' }}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(52, 211, 153, 0.12)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Nuevo Usuario</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Creación manual e individual de cuenta en ITILSuite
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  fontSize: '0.8rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Nombre de Usuario *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. jperez"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ej. juan.perez@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Nombre de Pila
                </label>
                <input
                  type="text"
                  placeholder="ej. Juan"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Apellidos
                </label>
                <input
                  type="text"
                  placeholder="ej. Pérez"
                  value={realname}
                  onChange={(e) => setRealname(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Perfil RBAC ITIL
                </label>
                <select
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  <option value="00000000-0000-0000-0000-000000000010">Super-Admin</option>
                  <option value="00000000-0000-0000-0000-000000000011">Technician (Técnico)</option>
                  <option value="00000000-0000-0000-0000-000000000012">Self-Service (Usuario Final)</option>
                  <option value="00000000-0000-0000-0000-000000000013">Observer (Auditor)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Contraseña Inicial (Opcional)
                </label>
                <input
                  type="password"
                  placeholder="Predeterminada: WelcomeITIL2026!"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            {/* Transversal Groups Membership */}
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Users size={14} color="#38bdf8" />
                <span>Pertenencia a Grupos Transversales</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  maxHeight: 120,
                  overflowY: 'auto',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-01dp)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {availableGroups.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No hay grupos disponibles.
                  </span>
                ) : (
                  availableGroups.map((g) => {
                    const isSelected = selectedGroupIds.includes(g.id);
                    return (
                      <button
                        type="button"
                        key={g.id}
                        onClick={() => toggleGroup(g.id)}
                        className={`badge ${isSelected ? 'badge-primary' : 'badge-neutral'}`}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.75rem',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        }}
                      >
                        {isSelected && <CheckCircle2 size={12} />}
                        <span>{g.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <UserPlus size={15} />
              <span>{loading ? 'Creando...' : 'Crear Usuario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
