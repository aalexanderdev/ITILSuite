import React, { useState, useEffect } from 'react';
import type { UserSummary, GroupSummary } from '../../types';
import { fetchUsers, fetchGroups, updateUser } from '../../services/api';
import {
  Users,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Plus,
  FileSpreadsheet,
  Layers,
  Power,
  SlidersHorizontal,
} from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';
import { GroupsManagementTab } from './GroupsManagementTab';
import { BatchUserImportTab } from './BatchUserImportTab';
import { useToast } from '../../context/ToastContext';

export const UsersListView: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'directory' | 'groups' | 'batch_import'>('directory');

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, groupsData] = await Promise.all([
        fetchUsers({
          is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
          group_id: selectedGroupFilter === 'all' ? undefined : selectedGroupFilter,
        }),
        fetchGroups(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, selectedGroupFilter]);

  const handleToggleActive = async (user: UserSummary) => {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      toast.info(
        !user.is_active ? 'Usuario activado' : 'Usuario desactivado',
        `@${user.username} ha sido ${!user.is_active ? 'activado' : 'desactivado'}.`
      );
      loadData();
    } catch (err: unknown) {
      toast.error(
        'Error',
        err instanceof Error ? err.message : 'Error al actualizar estado'
      );
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.profile_name.toLowerCase().includes(q)
    );
  });

  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;
  const withGroupsCount = users.filter((u) => u.groups && u.groups.length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner & Tab Navigation */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(52, 211, 153, 0.12)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                Directorio, Grupos & Gestión de Identidades
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Identidades, perfiles RBAC, grupos transversales e ingesta masiva (v0.0.6)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsCreateUserModalOpen(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem' }}
            >
              <Plus size={15} />
              <span>Nuevo Usuario</span>
            </button>

            <button
              onClick={() => setActiveTab('batch_import')}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem' }}
            >
              <FileSpreadsheet size={15} color="#f59e0b" />
              <span>Importación Masiva</span>
            </button>
          </div>
        </div>

        {/* Tab Buttons Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '0.75rem',
          }}
        >
          <button
            onClick={() => setActiveTab('directory')}
            className={`btn ${activeTab === 'directory' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
          >
            <Users size={14} />
            <span>Directorio de Usuarios ({totalCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`btn ${activeTab === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
          >
            <Layers size={14} />
            <span>Grupos Transversales ({groups.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('batch_import')}
            className={`btn ${activeTab === 'batch_import' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
          >
            <FileSpreadsheet size={14} />
            <span>Ingesta Masiva (CSV / JSON)</span>
          </button>
        </div>
      </div>

      {/* Render Active Tab */}
      {activeTab === 'groups' ? (
        <GroupsManagementTab />
      ) : activeTab === 'batch_import' ? (
        <BatchUserImportTab />
      ) : (
        /* Tab 1: Directory */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="card" style={{ padding: '0.85rem 1rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Registrados
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                {totalCount}
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem 1rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Cuentas Activas
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                {activeCount}
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem 1rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Cuentas Inactivas
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444', marginTop: '0.2rem' }}>
                {inactiveCount}
              </div>
            </div>

            <div className="card" style={{ padding: '0.85rem 1rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                En Grupos Transversales
              </span>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {withGroupsCount}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              {/* Search Box */}
              <div className="search-box" style={{ maxWidth: 240, padding: '0.35rem 0.65rem' }}>
                <Search size={14} color="#9ca3af" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Filtrar por nombre, usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`btn ${statusFilter === 'active' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Activos
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`btn ${statusFilter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                >
                  Inactivos
                </button>
              </div>

              {/* Group Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <SlidersHorizontal size={13} color="#9ca3af" />
                <select
                  value={selectedGroupFilter}
                  onChange={(e) => setSelectedGroupFilter(e.target.value)}
                  className="form-select"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                >
                  <option value="all">Todos los grupos</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.75rem' }}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span>Refrescar</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {error && (
              <div style={{ padding: '1rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                {error}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre Completo</th>
                    <th>Correo Electrónico</th>
                    <th>Perfil RBAC</th>
                    <th>Grupos Transversales</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
                        Cargando directorio de identidades...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No se encontraron usuarios coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  backgroundColor: u.is_active ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                  color: u.is_active ? '#34d399' : '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {u.username.substring(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>@{u.username}</span>
                            </div>
                          </td>

                          <td style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {u.display_name}
                          </td>

                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <Mail size={13} />
                              <span>{u.email}</span>
                            </div>
                          </td>

                          <td>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.75rem',
                                background:
                                  u.profile_name === 'Super-Admin'
                                    ? 'rgba(168, 85, 247, 0.15)'
                                    : u.profile_name === 'Technician'
                                    ? 'rgba(56, 189, 248, 0.15)'
                                    : 'rgba(107, 114, 128, 0.15)',
                                color:
                                  u.profile_name === 'Super-Admin'
                                    ? '#c084fc'
                                    : u.profile_name === 'Technician'
                                    ? '#38bdf8'
                                    : 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <ShieldCheck size={12} />
                              <span>{u.profile_name}</span>
                            </span>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                              {u.groups && u.groups.length > 0 ? (
                                u.groups.map((gname, i) => (
                                  <span
                                    key={i}
                                    className="badge badge-neutral"
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '0.15rem 0.45rem',
                                      background: 'var(--surface-01dp)',
                                      border: '1px solid var(--border-color)',
                                    }}
                                  >
                                    #{gname.toLowerCase().replace(/ /g, '-')}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                              )}
                            </div>
                          </td>

                          <td>
                            {u.is_active ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  color: '#34d399',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Activo</span>
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  color: '#ef4444',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                <XCircle size={13} />
                                <span>Inactivo</span>
                              </span>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleToggleActive(u)}
                              className="btn-icon"
                              title={u.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                              style={{ color: u.is_active ? '#34d399' : '#ef4444' }}
                            >
                              <Power size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onUserCreated={() => loadData()}
      />
    </div>
  );
};
