import React, { useState, useEffect } from 'react';
import type { UserSummary } from '../../types';
import { fetchUsers } from '../../services/api';
import {
  Users,
  User,
  Mail,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
} from 'lucide-react';

export const UsersListView: React.FC = () => {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.profile_name.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              User Directory & RBAC Profiles
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Identities, roles and permissions mapped across organization entities
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className="search-box" style={{ maxWidth: 220, padding: '0.35rem 0.65rem' }}>
            <Search size={14} color="#9ca3af" />
            <input
              type="text"
              className="search-input"
              placeholder="Filter users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            />
          </div>
          <button
            onClick={loadUsers}
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            Loading user directory...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#f87171' }}>
            {error}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No users found matching search criteria.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600 }}>User</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Email Address</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>RBAC Profile</th>
                <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s ease',
                  }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(59, 130, 246, 0.12)',
                          color: '#60a5fa',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                        }}
                      >
                        <User size={16} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{user.display_name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user.username}</span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={13} color="#9ca3af" />
                      <span>{user.email}</span>
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor:
                          user.profile_name === 'Super-Admin'
                            ? 'rgba(168, 85, 247, 0.12)'
                            : user.profile_name === 'Technician'
                            ? 'rgba(59, 130, 246, 0.12)'
                            : 'rgba(255, 255, 255, 0.05)',
                        color:
                          user.profile_name === 'Super-Admin'
                            ? '#c084fc'
                            : user.profile_name === 'Technician'
                            ? '#60a5fa'
                            : 'var(--text-secondary)',
                      }}
                    >
                      <ShieldCheck size={13} />
                      {user.profile_name}
                    </span>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {user.is_active ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#34d399', fontSize: '0.75rem' }}>
                        <CheckCircle2 size={13} /> Active
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#f87171', fontSize: '0.75rem' }}>
                        <XCircle size={13} /> Inactive
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', height: 26 }}
                      onClick={() => alert(`User details modal planned for v0.0.3`)}
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
