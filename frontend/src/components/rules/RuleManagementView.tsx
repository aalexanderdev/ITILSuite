import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Play,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Server,
  LifeBuoy,
  Users,
  BookOpen,
} from 'lucide-react';
import type { RuleWithDetails } from '../../types';
import { fetchRules, deleteRule, updateRule, reorderRules } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { RuleEditorModal } from './RuleEditorModal';
import { RuleSimulatorModal } from './RuleSimulatorModal';

type DomainId = 'helpdesk' | 'assets' | 'auth' | 'dictionaries';

interface RuleSubtypeDef {
  id: string;
  name: string;
  description: string;
  badge: string;
}

interface DomainDef {
  id: DomainId;
  name: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  description: string;
  subtypes: RuleSubtypeDef[];
}

const RULE_DOMAINS: DomainDef[] = [
  {
    id: 'helpdesk',
    name: 'Mesa de Ayuda (Helpdesk)',
    icon: LifeBuoy,
    description: 'Automatiza la clasificación, enrutamiento, impacto y escalamiento de tickets, problemas y cambios.',
    subtypes: [
      {
        id: 'ticket_business',
        name: 'Reglas de Negocio para Tickets',
        description: 'Modifica categoría, urgencia, impacto, técnico o grupo según contenido, palabras clave o remitente.',
        badge: 'Tickets',
      },
      {
        id: 'ticket_entity',
        name: 'Asignación de Entidades para Tickets',
        description: 'Enruta tickets nuevos hacia la entidad correspondiente según el correo, dominio o IP remitente.',
        badge: 'Entidades',
      },
      {
        id: 'problem_business',
        name: 'Reglas de Negocio para Problemas',
        description: 'Automatiza propiedades y ciclos de vida dentro del módulo de gestión de problemas (ITIL).',
        badge: 'Problemas',
      },
      {
        id: 'change_business',
        name: 'Reglas de Negocio para Cambios',
        description: 'Gestiona aprobaciones y propiedades automáticas para solicitudes de cambio estructuradas.',
        badge: 'Cambios',
      },
    ],
  },
  {
    id: 'assets',
    name: 'Activos e Inventario (ITAM/CMDB)',
    icon: Server,
    description: 'Controla la importación automática de agentes GLPI, asignación de sedes y reconciliación de duplicados.',
    subtypes: [
      {
        id: 'asset_entity',
        name: 'Asignación de Entidades para Equipos',
        description: 'Determina a qué entidad pertenecerá un equipo según subred IP (CIDR), tag de inventario o dominio.',
        badge: 'Sedes & Red',
      },
      {
        id: 'asset_import_link',
        name: 'Reconciliación e Importación de Equipos',
        description: 'Decide si enlazar, crear nuevo, descartar o enviar a papelera según UUID, serie, MAC o hostname.',
        badge: 'Reconciliación',
      },
    ],
  },
  {
    id: 'auth',
    name: 'Autorizaciones y Grupos',
    icon: Users,
    description: 'Reglas de asignación automática de perfiles, entidades y grupos transversales en primer login o SSO.',
    subtypes: [
      {
        id: 'auth_assignment',
        name: 'Asignación de Perfiles y Entidades',
        description: 'Asigna perfil (Técnico, Super-Admin, Autoservicio) y entidad inicial según atributos LDAP/AD/SAML.',
        badge: 'RBAC',
      },
      {
        id: 'auth_group_assignment',
        name: 'Asignación a Grupos Transversales',
        description: 'Agrega automáticamente al usuario a grupos transversales compartidos por toda la plataforma y chat.',
        badge: 'Grupos',
      },
    ],
  },
  {
    id: 'dictionaries',
    name: 'Diccionarios y Normalización',
    icon: BookOpen,
    description: 'Limpia y estandariza cadenas dispares provenientes de agentes (10 motores de normalización).',
    subtypes: [
      {
        id: 'dict_manufacturer',
        name: 'Fabricantes de Hardware',
        description: 'Normaliza variantes de marca (ej: Hewlett-Packard -> HP, Dell Inc. -> Dell).',
        badge: 'Fabricantes',
      },
      {
        id: 'dict_software',
        name: 'Software y Programas',
        description: 'Agrupa versiones y nombres dispares de software para inventario limpio de licencias.',
        badge: 'Software',
      },
      {
        id: 'dict_model_computer',
        name: 'Modelos de Computadoras',
        description: 'Estandariza nomenclaturas de laptops, desktops y servidores físicos o virtuales.',
        badge: 'Modelos PC',
      },
      {
        id: 'dict_model_monitor',
        name: 'Modelos de Monitores',
        description: 'Normaliza nombres comerciales de pantallas y monitores conectados.',
        badge: 'Monitores',
      },
      {
        id: 'dict_model_printer',
        name: 'Modelos de Impresoras',
        description: 'Estandariza impresoras de red y locales.',
        badge: 'Impresoras',
      },
      {
        id: 'dict_model_peripheral',
        name: 'Modelos de Periféricos',
        description: 'Limpia nombres de teclados, mouses, lectores y dispositivos auxiliares.',
        badge: 'Periféricos',
      },
      {
        id: 'dict_model_phone',
        name: 'Modelos de Teléfonos y Móviles',
        description: 'Normaliza teléfonos IP, smartphones y terminales de comunicación.',
        badge: 'Teléfonos',
      },
      {
        id: 'dict_os',
        name: 'Sistemas Operativos',
        description: 'Limpia nombres de SO (Microsoft Windows, Debian GNU/Linux, Ubuntu, macOS).',
        badge: 'SO',
      },
      {
        id: 'dict_os_version',
        name: 'Versiones de SO',
        description: 'Estandariza versiones de SO (ej: 10.0.19045 -> 22H2, 22.04.3 LTS).',
        badge: 'Versión SO',
      },
      {
        id: 'dict_os_architecture',
        name: 'Arquitecturas de SO',
        description: 'Normaliza nomenclaturas de arquitectura (ej: x86_64, amd64, 64-bit -> 64-bit).',
        badge: 'Arquitectura',
      },
    ],
  },
];

export const RuleManagementView: React.FC = () => {
  const { activeEntity } = useAuth();

  const [activeDomain, setActiveDomain] = useState<DomainId>('helpdesk');
  const [activeSubtype, setActiveSubtype] = useState<string>('ticket_business');

  const [rules, setRules] = useState<RuleWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedRuleToEdit, setSelectedRuleToEdit] = useState<RuleWithDetails | null>(null);

  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatorInitialType, setSimulatorInitialType] = useState<string>('ticket_business');

  const currentDomain = useMemo(
    () => RULE_DOMAINS.find((d) => d.id === activeDomain) || RULE_DOMAINS[0],
    [activeDomain]
  );

  const currentSubtype = useMemo(
    () => currentDomain.subtypes.find((s) => s.id === activeSubtype) || currentDomain.subtypes[0],
    [currentDomain, activeSubtype]
  );

  // Load rules when activeSubtype changes
  const loadRules = async () => {
    try {
      setIsLoading(true);
      const data = await fetchRules(activeSubtype);
      setRules(data);
    } catch (err) {
      console.error('Failed to load rules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [activeSubtype]);

  // When domain changes, default to its first subtype
  const handleSelectDomain = (domainId: DomainId) => {
    setActiveDomain(domainId);
    const dom = RULE_DOMAINS.find((d) => d.id === domainId);
    if (dom && dom.subtypes.length > 0) {
      setActiveSubtype(dom.subtypes[0].id);
    }
  };

  const handleCreateRule = () => {
    setSelectedRuleToEdit(null);
    setEditorOpen(true);
  };

  const handleEditRule = (ruleWithDetails: RuleWithDetails) => {
    setSelectedRuleToEdit(ruleWithDetails);
    setEditorOpen(true);
  };

  const handleOpenSimulator = (ruleTypeToSimulate?: string) => {
    setSimulatorInitialType(ruleTypeToSimulate || activeSubtype);
    setSimulatorOpen(true);
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar la regla "${name}"?`)) {
      return;
    }
    try {
      await deleteRule(id);
      loadRules();
    } catch (err: any) {
      alert(`Error al eliminar regla: ${err.message}`);
    }
  };

  const handleToggleActive = async (rule: RuleWithDetails) => {
    try {
      await updateRule(rule.rule.id, { is_active: !rule.rule.is_active });
      loadRules();
    } catch (err: any) {
      alert(`Error al cambiar estado: ${err.message}`);
    }
  };

  const handleMoveRanking = async (ruleId: string, direction: 'up' | 'down') => {
    const idx = rules.findIndex((r) => r.rule.id === ruleId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rules.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const reordered = [...rules];
    const temp = reordered[idx];
    reordered[idx] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    // Recalculate rankings in increments of 10
    const updates = reordered.map((item, index) => ({
      id: item.rule.id,
      ranking: (index + 1) * 10,
    }));

    try {
      await reorderRules(updates);
      loadRules();
    } catch (err: any) {
      alert(`Error al reordenar reglas: ${err.message}`);
    }
  };

  // Filter rules by search & active state
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesSearch =
        r.rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.rule.description && r.rule.description.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterActive === 'active') return r.rule.is_active;
      if (filterActive === 'inactive') return !r.rule.is_active;
      return true;
    });
  }, [rules, searchTerm, filterActive]);

  return (
    <div className="openitil-rules-view">
      {/* Top Banner Header */}
      <div className="openitil-rules-header">
        <div className="rules-header-info">
          <div className="rules-header-icon-box">
            <Sliders size={26} color="#eb4d3d" />
          </div>
          <div>
            <h1 className="rules-header-title">Motor de Reglas de Negocio y Diccionarios</h1>
            <p className="rules-header-subtitle">
              Automatice la clasificación de tickets, asignación de sedes, reconciliación de inventario y normalización de diccionarios inspirado en GLPI | Ámbito: <strong>{activeEntity.name}</strong>
            </p>
          </div>
        </div>

        <div className="rules-header-actions">
          <button
            type="button"
            className="btn-rule-simulator"
            onClick={() => handleOpenSimulator()}
          >
            <Play size={16} fill="#ffffff" />
            <span>Simulador / Sandbox</span>
          </button>

          <button
            type="button"
            className="btn-rule-create"
            onClick={handleCreateRule}
          >
            <Plus size={16} />
            <span>Nueva Regla</span>
          </button>
        </div>
      </div>

      {/* Domain Navigation Tabs (Helpdesk, Assets, Auth, Dictionaries) */}
      <div className="rule-domain-nav-tabs">
        {RULE_DOMAINS.map((domain) => {
          const Icon = domain.icon;
          const isActive = domain.id === activeDomain;
          return (
            <button
              key={domain.id}
              type="button"
              className={`rule-domain-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectDomain(domain.id)}
            >
              <Icon size={18} />
              <div className="domain-tab-text">
                <span className="domain-tab-name">{domain.name}</span>
                <span className="domain-tab-count">{domain.subtypes.length} tipos</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Subtype Pills Bar */}
      <div className="rule-subtypes-bar">
        <div className="rule-subtypes-pills">
          {currentDomain.subtypes.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`rule-subtype-pill ${st.id === activeSubtype ? 'active' : ''}`}
              onClick={() => setActiveSubtype(st.id)}
            >
              <span className="subtype-pill-label">{st.name}</span>
              <span className="subtype-pill-badge">{st.badge}</span>
            </button>
          ))}
        </div>

        <div className="rule-subtype-description">
          <span>{currentSubtype.description}</span>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="rule-controls-bar">
        <div className="rule-search-box">
          <Search size={15} color="#9ca3af" />
          <input
            type="text"
            className="rule-search-input"
            placeholder="Buscar por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="btn-clear-search"
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="rule-filters-group">
          <div className="rule-status-filter">
            <button
              type="button"
              className={`rule-status-btn ${filterActive === 'all' ? 'active' : ''}`}
              onClick={() => setFilterActive('all')}
            >
              Todas ({rules.length})
            </button>
            <button
              type="button"
              className={`rule-status-btn ${filterActive === 'active' ? 'active' : ''}`}
              onClick={() => setFilterActive('active')}
            >
              Activas ({rules.filter((r) => r.rule.is_active).length})
            </button>
            <button
              type="button"
              className={`rule-status-btn ${filterActive === 'inactive' ? 'active' : ''}`}
              onClick={() => setFilterActive('inactive')}
            >
              Inactivas ({rules.filter((r) => !r.rule.is_active).length})
            </button>
          </div>

          <button
            type="button"
            className="btn-rule-refresh"
            onClick={loadRules}
            disabled={isLoading}
            title="Refrescar reglas"
          >
            <RefreshCw size={15} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Rules Table / Cards Area */}
      <div className="rule-content-area">
        {isLoading ? (
          <div className="rules-loading-state">
            <RefreshCw size={28} className="spinning" color="#eb4d3d" />
            <span>Cargando reglas de negocio...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="rules-empty-state">
            <Sliders size={48} opacity={0.3} color="#eb4d3d" />
            <h3 className="empty-state-title">No se encontraron reglas en esta categoría</h3>
            <p className="empty-state-desc">
              {searchTerm
                ? 'No hay reglas que coincidan con los filtros de búsqueda aplicados.'
                : `Aún no se han configurado reglas para "${currentSubtype.name}". Cree su primera regla para automatizar este flujo.`}
            </p>
            <button
              type="button"
              className="btn-rule-create"
              style={{ marginTop: 16 }}
              onClick={handleCreateRule}
            >
              <Plus size={16} />
              <span>Crear Primera Regla</span>
            </button>
          </div>
        ) : (
          <div className="rule-list-container">
            {filteredRules.map((item, index) => {
              const r = item.rule;
              return (
                <div
                  key={r.id}
                  className={`rule-card-item ${!r.is_active ? 'rule-disabled' : ''}`}
                >
                  {/* Left priority reorder column */}
                  <div className="rule-card-reorder">
                    <button
                      type="button"
                      className="btn-rule-reorder"
                      onClick={() => handleMoveRanking(r.id, 'up')}
                      disabled={index === 0}
                      title="Subir prioridad"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <span className="rule-card-rank">#{r.ranking}</span>
                    <button
                      type="button"
                      className="btn-rule-reorder"
                      onClick={() => handleMoveRanking(r.id, 'down')}
                      disabled={index === filteredRules.length - 1}
                      title="Bajar prioridad"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  {/* Main rule info */}
                  <div className="rule-card-main">
                    <div className="rule-card-header">
                      <div className="rule-card-title-group">
                        <button
                          type="button"
                          className={`rule-toggle-active-btn ${r.is_active ? 'is-active' : 'is-inactive'}`}
                          onClick={() => handleToggleActive(item)}
                          title={r.is_active ? 'Regla Activa (Clic para pausar)' : 'Regla Inactiva (Clic para activar)'}
                        >
                          {r.is_active ? (
                            <CheckCircle2 size={16} color="#10b981" />
                          ) : (
                            <XCircle size={16} color="#9ca3af" />
                          )}
                          <span>{r.is_active ? 'Activa' : 'Inactiva'}</span>
                        </button>

                        <h3 className="rule-card-title">{r.name}</h3>

                        <div className="rule-card-pills">
                          <span className="rule-logic-pill">
                            Lógica: {r.match_logic}
                          </span>

                          {r.stop_on_first_match && (
                            <span className="rule-stop-pill" title="Si coincide, no se evalúan las siguientes reglas">
                              ⛔ Detener flujo
                            </span>
                          )}

                          {r.is_recursive && (
                            <span className="rule-recursive-pill">
                              Recursiva
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="rule-card-actions">
                        <button
                          type="button"
                          className="btn-rule-action test-btn"
                          onClick={() => handleOpenSimulator(r.rule_type)}
                          title="Probar en simulador"
                        >
                          <Play size={13} fill="#eb4d3d" color="#eb4d3d" />
                          <span>Simular</span>
                        </button>

                        <button
                          type="button"
                          className="btn-rule-action edit-btn"
                          onClick={() => handleEditRule(item)}
                          title="Editar regla"
                        >
                          <Edit2 size={13} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          className="btn-rule-action delete-btn"
                          onClick={() => handleDeleteRule(r.id, r.name)}
                          title="Eliminar regla"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {r.description && (
                      <p className="rule-card-description">{r.description}</p>
                    )}

                    {/* Criteria & Actions Preview Badges */}
                    <div className="rule-card-details-preview">
                      <div className="rule-preview-section">
                        <span className="rule-preview-label">
                          Criterios ({item.criteria.length}):
                        </span>
                        {item.criteria.length === 0 ? (
                          <span className="rule-tag-empty">Sin criterios (Comodín general)</span>
                        ) : (
                          <div className="rule-tags-wrap">
                            {item.criteria.map((c) => (
                              <span key={c.id} className="rule-criteria-tag">
                                <strong>{c.field}</strong> [{c.operator}] "{c.pattern}"
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rule-preview-section">
                        <span className="rule-preview-label">
                          Acciones ({item.actions.length}):
                        </span>
                        {item.actions.length === 0 ? (
                          <span className="rule-tag-empty">Sin acciones</span>
                        ) : (
                          <div className="rule-tags-wrap">
                            {item.actions.map((a) => (
                              <span key={a.id} className="rule-action-tag">
                                <strong>{a.field}</strong> = "{a.value}"
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <RuleEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={loadRules}
        ruleToEdit={selectedRuleToEdit}
        defaultRuleType={activeSubtype}
      />

      {/* Simulator Modal */}
      <RuleSimulatorModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        initialRuleType={simulatorInitialType}
      />
    </div>
  );
};
