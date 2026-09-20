import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Crown,
  UserX,
  UserPlus,
  Trash2,
  Globe,
  Building2,
  X,
} from 'lucide-react';
import type { GroupSummary, GroupDetail, UserSummary } from '../../types';
import {
  fetchGroups,
  createGroup,
  deleteGroup,
  fetchGroupById,
  addGroupMember,
  removeGroupMember,
  updateGroupMemberRole,
  fetchUsers,
} from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const GroupsManagementTab: React.FC = () => {
  const { activeEntity } = useAuth();
  const { toast } = useToast();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);

  // Create Group Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupComment, setNewGroupComment] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [isTask, setIsTask] = useState(true);
  const [isRequester, setIsRequester] = useState(true);
  const [isRecursive, setIsRecursive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Add Member to Group state
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('');
  const [isManagerToAdd, setIsManagerToAdd] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        'Error al cargar grupos',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const data = await fetchUsers({ is_active: true });
      setAllUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadGroups();
    loadAllUsers();
  }, []);

  const openGroupDetail = async (groupId: string) => {
    try {
      const detail = await fetchGroupById(groupId);
      setSelectedGroup(detail);
    } catch (err: unknown) {
      console.error(err);
      toast.error('Error', 'No se pudo obtener el detalle del grupo');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setCreating(true);
    try {
      await createGroup({
        name: newGroupName.trim(),
        comment: newGroupComment.trim() || undefined,
        entity_id: isGlobal ? null : activeEntity.id,
        is_task: isTask,
        is_requester: isRequester,
        is_recursive: isRecursive,
      });

      toast.success(
        'Grupo transversal creado',
        `El grupo "${newGroupName}" fue creado y sincronizado con HelpdeskChat.`
      );

      setNewGroupName('');
      setNewGroupComment('');
      setIsCreateModalOpen(false);
      loadGroups();
    } catch (err: unknown) {
      toast.error(
        'Error al crear grupo',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el grupo "${groupName}"?`)) return;

    try {
      await deleteGroup(groupId);
      toast.info('Grupo eliminado', `El grupo "${groupName}" ha sido eliminado.`);
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
      loadGroups();
    } catch (err: unknown) {
      toast.error(
        'Error al eliminar',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUserIdToAdd) return;

    setAddingMember(true);
    try {
      await addGroupMember(selectedGroup.id, {
        user_id: selectedUserIdToAdd,
        is_manager: isManagerToAdd,
        is_user: true,
      });

      toast.success(
        'Miembro añadido',
        'El usuario fue integrado al grupo y a su sala de chat.'
      );

      setSelectedUserIdToAdd('');
      setIsManagerToAdd(false);
      openGroupDetail(selectedGroup.id);
      loadGroups();
    } catch (err: unknown) {
      toast.error(
        'Error al añadir miembro',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string, username: string) => {
    if (!selectedGroup) return;
    if (!window.confirm(`¿Remover a @${username} del grupo "${selectedGroup.name}"?`)) return;

    try {
      await removeGroupMember(selectedGroup.id, userId);
      toast.info('Miembro removido', `@${username} ya no pertenece al grupo.`);
      openGroupDetail(selectedGroup.id);
      loadGroups();
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const handleToggleManager = async (userId: string, currentIsManager: boolean) => {
    if (!selectedGroup) return;

    try {
      await updateGroupMemberRole(selectedGroup.id, userId, !currentIsManager);
      toast.success(
        !currentIsManager ? 'Promovido a Líder / Supervisor' : 'Rol cambiado a Miembro regular',
        'Los permisos del grupo fueron actualizados.'
      );
      openGroupDetail(selectedGroup.id);
      loadGroups();
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  const filteredGroups = groups.filter((g) => {
    const q = search.toLowerCase();
    return g.name.toLowerCase().includes(q) || (g.comment && g.comment.toLowerCase().includes(q));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Subheader Toolbar */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Grupos Transversales</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Equipos transversales utilizables en Service Desk, CMDB, Chat y Notificaciones
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="search-box" style={{ maxWidth: 220, padding: '0.35rem 0.65rem' }}>
            <Search size={14} color="#9ca3af" />
            <input
              type="text"
              className="search-input"
              placeholder="Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            />
          </div>

          <button onClick={loadGroups} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>

          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
            <Plus size={15} />
            <span>Nuevo Grupo</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Groups Cards + Detail Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedGroup ? '1fr 380px' : '1fr', gap: '1.25rem' }}>
        {/* Groups Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
            alignContent: 'start',
          }}
        >
          {loading ? (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem', color: 'var(--accent-primary)' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Cargando grupos transversales...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', padding: '2.5rem', textAlign: 'center' }}>
              <Users size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <h4 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No se encontraron grupos</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Crea un nuevo grupo transversal para empezar a asignar tickets y sincronizar canales.
              </p>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">
                <Plus size={14} />
                <span>Crear Primer Grupo</span>
              </button>
            </div>
          ) : (
            filteredGroups.map((g) => {
              const isSelected = selectedGroup?.id === g.id;
              return (
                <div
                  key={g.id}
                  className={`card ${isSelected ? 'card-selected' : ''}`}
                  onClick={() => openGroupDetail(g.id)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.1rem',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.7rem',
                          background: g.entity_id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                          color: g.entity_id ? '#38bdf8' : '#c084fc',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        {g.entity_id ? <Building2 size={11} /> : <Globe size={11} />}
                        <span>{g.entity_id ? g.entity_name || 'Entidad' : 'Global (Transversal)'}</span>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {g.is_task && (
                          <span
                            title="Asignable en tickets"
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: 4,
                              background: 'rgba(52, 211, 153, 0.12)',
                              color: '#34d399',
                              fontWeight: 600,
                            }}
                          >
                            TICKETS
                          </span>
                        )}
                        {g.is_requester && (
                          <span
                            title="Puede solicitar tickets"
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: 4,
                              background: 'rgba(251, 191, 36, 0.12)',
                              color: '#fbbf24',
                              fontWeight: 600,
                            }}
                          >
                            SOLICITANTE
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.35rem' }}>{g.name}</h4>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        marginBottom: '0.85rem',
                        minHeight: '2.1rem',
                      }}
                    >
                      {g.comment || 'Sin descripción asignada.'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-color)',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-primary)' }}>
                        <Users size={14} color="#9ca3af" />
                        <strong>{g.member_count}</strong> {g.member_count === 1 ? 'miembro' : 'miembros'}
                      </span>
                      {g.manager_count > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24' }}>
                          <Crown size={12} />
                          <strong>{g.manager_count}</strong> {g.manager_count === 1 ? 'líder' : 'líderes'}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGroup(g.id, g.name);
                      }}
                      className="btn-icon"
                      title="Eliminar grupo"
                      style={{ opacity: 0.6 }}
                    >
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Group Detail Drawer */}
        {selectedGroup && (
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              height: 'fit-content',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--accent-primary)',
                  }}
                >
                  Detalle del Grupo
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedGroup.name}</h3>
              </div>
              <button onClick={() => setSelectedGroup(null)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {selectedGroup.comment && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {selectedGroup.comment}
              </p>
            )}

            {/* Add Member Bar */}
            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-01dp)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserPlus size={13} color="#38bdf8" />
                <span>Incorporar Miembro</span>
              </label>

              <select
                value={selectedUserIdToAdd}
                onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                className="form-select"
                style={{ width: '100%', fontSize: '0.8rem' }}
              >
                <option value="">Seleccionar usuario del directorio...</option>
                {allUsers
                  .filter((u) => !selectedGroup.members.some((m) => m.user_id === u.id))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} (@{u.username})
                    </option>
                  ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isManagerToAdd}
                    onChange={(e) => setIsManagerToAdd(e.target.checked)}
                  />
                  <span>Asignar como Líder / Supervisor</span>
                </label>

                <button
                  onClick={handleAddMember}
                  disabled={!selectedUserIdToAdd || addingMember}
                  className="btn btn-primary"
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  <Plus size={13} />
                  <span>{addingMember ? 'Añadiendo...' : 'Añadir'}</span>
                </button>
              </div>
            </div>

            {/* Members List */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Miembros ({selectedGroup.members.length})
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Sincronizado con #{selectedGroup.name.toLowerCase().replace(/ /g, '-')}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 350, overflowY: 'auto' }}>
                {selectedGroup.members.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                    Este grupo no tiene miembros todavía.
                  </p>
                ) : (
                  selectedGroup.members.map((m) => (
                    <div
                      key={m.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-00dp)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.display_name}</span>
                          {m.is_manager && (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.65rem',
                                background: 'rgba(251, 191, 36, 0.15)',
                                color: '#fbbf24',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                              }}
                            >
                              <Crown size={10} />
                              <span>Líder</span>
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          @{m.username} · {m.profile_name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          onClick={() => handleToggleManager(m.user_id, m.is_manager)}
                          className="btn-icon"
                          title={m.is_manager ? 'Degradar a miembro' : 'Promover a líder / supervisor'}
                          style={{ color: m.is_manager ? '#fbbf24' : '#9ca3af' }}
                        >
                          <Crown size={14} />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.user_id, m.username)}
                          className="btn-icon"
                          title="Remover del grupo"
                          style={{ color: '#ef4444' }}
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Nuevo Grupo Transversal</h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Equipo utilizable en tickets, activos, canales de chat y avisos
                  </span>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Nombre del Grupo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Ciberseguridad & SOC"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Descripción / Comentarios
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Finalidad del grupo, responsabilidades..."
                    value={newGroupComment}
                    onChange={(e) => setNewGroupComment(e.target.value)}
                    className="form-textarea"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Ámbito y Capacidades GLPI
                  </span>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isGlobal}
                      onChange={(e) => setIsGlobal(e.target.checked)}
                    />
                    <span>
                      <strong>Ámbito Global Transversal</strong> (accesible por todas las entidades y sedes)
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isTask}
                      onChange={(e) => setIsTask(e.target.checked)}
                    />
                    <span>
                      <strong>Asignable a Tickets (is_assign)</strong>: puede recibir tickets en la mesa de ayuda
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isRequester}
                      onChange={(e) => setIsRequester(e.target.checked)}
                    />
                    <span>
                      <strong>Grupo Solicitante (is_requester)</strong>: los usuarios pueden abrir incidentes a nombre del grupo
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isRecursive}
                      onChange={(e) => setIsRecursive(e.target.checked)}
                    />
                    <span>
                      <strong>Herencia Recursiva (is_recursive)</strong>: visible en entidades hijas
                    </span>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={creating}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  <Users size={15} />
                  <span>{creating ? 'Creando...' : 'Crear Grupo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
