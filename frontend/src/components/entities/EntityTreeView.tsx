import React, { useState, useEffect } from 'react';
import type { EntityTreeNode } from '../../types';
import { fetchEntities, createEntity } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  FolderTree,
  Building2,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle2,
  X,
  Layers,
} from 'lucide-react';

interface TreeNodeProps {
  node: EntityTreeNode;
  activeEntityId: string;
  onSelectEntity: (node: EntityTreeNode) => void;
  onAddChild: (parent: EntityTreeNode) => void;
}

const TreeNodeItem: React.FC<TreeNodeProps> = ({
  node,
  activeEntityId,
  onSelectEntity,
  onAddChild,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const isSelected = activeEntityId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: node.level * 24 }}>
      <div
        className={`tree-node-row ${isSelected ? 'active' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
          border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
          marginBottom: '0.35rem',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="btn-icon"
              style={{ padding: '0.2rem', color: '#9ca3af' }}
            >
              {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <div style={{ width: 23, height: 15 }} />
          )}

          <Building2 size={16} color={isSelected ? '#60a5fa' : '#9ca3af'} />

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#93c5fd' : 'var(--text-primary)' }}>
              {node.name}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {node.completeness}
            </span>
          </div>

          <span
            className="badge"
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.65rem',
              padding: '0.1rem 0.45rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-muted)',
            }}
          >
            Level {node.level}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isSelected ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.7rem',
                color: '#34d399',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(52, 211, 153, 0.1)',
              }}
            >
              <CheckCircle2 size={12} /> Active Scope
            </span>
          ) : (
            <button
              onClick={() => onSelectEntity(node)}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', height: 26 }}
            >
              Switch To
            </button>
          )}

          <button
            onClick={() => onAddChild(node)}
            className="btn btn-secondary"
            title={`Add child entity under ${node.name}`}
            style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem', height: 26 }}
          >
            <Plus size={13} /> Sub-Entity
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div style={{ borderLeft: '1px dashed rgba(255, 255, 255, 0.1)', marginLeft: 11, paddingLeft: 6 }}>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              activeEntityId={activeEntityId}
              onSelectEntity={onSelectEntity}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const EntityTreeView: React.FC = () => {
  const { activeEntity, setActiveEntity } = useAuth();
  const [tree, setTree] = useState<EntityTreeNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State for Sub-entity creation
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [parentTarget, setParentTarget] = useState<EntityTreeNode | null>(null);
  const [newEntityName, setNewEntityName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEntities();
      setTree(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve entity tree');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const handleOpenAddModal = (parent: EntityTreeNode) => {
    setParentTarget(parent);
    setNewEntityName('');
    setModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityName.trim()) return;

    setIsCreating(true);
    try {
      await createEntity({
        parent_id: parentTarget?.id ?? null,
        name: newEntityName.trim(),
      });
      setModalOpen(false);
      await loadTree();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating entity');
    } finally {
      setIsCreating(false);
    }
  };

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
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FolderTree size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Organizational Entity Hierarchy
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Multi-tenant recursive boundary tree inherited from enterprise multi-tenant architecture
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={loadTree}
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Tree Card */}
      <div className="card">
        {loading && tree.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            Loading hierarchical tree...
          </div>
        ) : error ? (
          <div style={{ padding: '1.5rem', color: '#f87171', fontSize: '0.85rem' }}>
            {error}
          </div>
        ) : tree.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No entities configured.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tree.map((rootNode) => (
              <TreeNodeItem
                key={rootNode.id}
                node={rootNode}
                activeEntityId={activeEntity.id}
                onSelectEntity={(node) =>
                  setActiveEntity({ id: node.id, name: node.name })
                }
                onAddChild={handleOpenAddModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#60a5fa" />
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Create Sub-Entity</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                  Parent Node
                </label>
                <div
                  style={{
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    color: '#93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Building2 size={14} />
                  <span>{parentTarget?.completeness || 'Root'}</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Sub-Entity Name
                </label>
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="e.g. IT Helpdesk or European Branch"
                  required
                  autoFocus
                  className="input-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn btn-primary"
                >
                  <Check size={14} />
                  <span>{isCreating ? 'Creating...' : 'Create Sub-Entity'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
