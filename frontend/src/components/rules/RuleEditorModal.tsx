import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  HelpCircle,
  Save,
  Sliders,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type {
  RuleWithDetails,
  CreateRulePayload,
  UpdateRulePayload,
  CreateRuleCriteriaDto,
  CreateRuleActionDto,
} from '../../types';
import { createRule, updateRule } from '../../services/api';

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  ruleToEdit?: RuleWithDetails | null;
  defaultRuleType?: string;
}

export const OPERATORS = [
  { value: 'equals', label: 'Es igual a (=)' },
  { value: 'not_equals', label: 'No es igual a (!=)' },
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
  { value: 'starts_with', label: 'Empieza con' },
  { value: 'ends_with', label: 'Termina con' },
  { value: 'regex_match', label: 'Expresión Regular (Regex)' },
  { value: 'not_regex_match', label: 'No coincide con Regex' },
  { value: 'in_subnet', label: 'En subred CIDR (ej: 192.168.1.0/24)' },
  { value: 'is_empty', label: 'Está vacío o nulo' },
  { value: 'is_not_empty', label: 'No está vacío' },
];

export const ACTION_TYPES = [
  { value: 'assign', label: 'Asignar valor directo o interpolado' },
  { value: 'regex_replace', label: 'Reemplazo con Regex ($1, $2...)' },
  { value: 'append', label: 'Añadir texto' },
  { value: 'ignore', label: 'Ignorar / Rechazar' },
];

export const FIELD_SUGGESTIONS: Record<string, { criteria: string[]; actions: string[] }> = {
  dict_manufacturer: {
    criteria: ['raw_manufacturer'],
    actions: ['normalized_manufacturer'],
  },
  dict_os: {
    criteria: ['raw_os_name'],
    actions: ['normalized_os_name'],
  },
  dict_os_version: {
    criteria: ['raw_version'],
    actions: ['normalized_version'],
  },
  dict_os_architecture: {
    criteria: ['raw_arch'],
    actions: ['normalized_arch'],
  },
  dict_software: {
    criteria: ['raw_software_name'],
    actions: ['normalized_software_name'],
  },
  dict_model_computer: {
    criteria: ['raw_model_name'],
    actions: ['normalized_model_name'],
  },
  dict_model_monitor: {
    criteria: ['raw_model_name'],
    actions: ['normalized_model_name'],
  },
  dict_model_printer: {
    criteria: ['raw_model_name'],
    actions: ['normalized_model_name'],
  },
  dict_model_peripheral: {
    criteria: ['raw_model_name'],
    actions: ['normalized_model_name'],
  },
  dict_model_phone: {
    criteria: ['raw_model_name'],
    actions: ['normalized_model_name'],
  },
  ticket_entity: {
    criteria: ['from_email', 'domain', 'subject', 'ip_address'],
    actions: ['entity_id'],
  },
  ticket_business: {
    criteria: ['subject', 'content', 'from_email', 'urgency', 'impact'],
    actions: ['urgency', 'impact', 'priority', 'category', 'ticket_type', 'assigned_technician_id', 'assigned_group_id'],
  },
  problem_business: {
    criteria: ['name', 'content', 'impact', 'urgency', 'category'],
    actions: ['urgency', 'impact', 'priority', 'assigned_technician_id', 'status'],
  },
  change_business: {
    criteria: ['name', 'content', 'impact', 'urgency', 'category'],
    actions: ['urgency', 'impact', 'priority', 'status'],
  },
  asset_entity: {
    criteria: ['ip_address', 'inventory_tag', 'hostname', 'domain'],
    actions: ['entity_id'],
  },
  asset_import_link: {
    criteria: ['bios_uuid', 'serial_number', 'mac_address', 'hostname'],
    actions: ['reconciliation_decision'],
  },
  auth_assignment: {
    criteria: ['username', 'email', 'auth_method', 'ldap_group', 'saml_role'],
    actions: ['profile_id', 'entity_id', 'is_recursive'],
  },
  auth_group_assignment: {
    criteria: ['username', 'email', 'ldap_group', 'department', 'title'],
    actions: ['group_id'],
  },
};

export const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  ruleToEdit,
  defaultRuleType = 'ticket_business',
}) => {
  const [ruleType, setRuleType] = useState(defaultRuleType);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [ranking, setRanking] = useState(10);
  const [matchLogic, setMatchLogic] = useState('AND');
  const [stopOnFirstMatch, setStopOnFirstMatch] = useState(false);
  const [isRecursive, setIsRecursive] = useState(true);

  const [criteria, setCriteria] = useState<CreateRuleCriteriaDto[]>([
    { field: '', operator: 'contains', pattern: '' },
  ]);

  const [actions, setActions] = useState<CreateRuleActionDto[]>([
    { action_type: 'assign', field: '', value: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ruleToEdit) {
      setRuleType(ruleToEdit.rule.rule_type);
      setName(ruleToEdit.rule.name);
      setDescription(ruleToEdit.rule.description || '');
      setIsActive(ruleToEdit.rule.is_active);
      setRanking(ruleToEdit.rule.ranking);
      setMatchLogic(ruleToEdit.rule.match_logic);
      setStopOnFirstMatch(ruleToEdit.rule.stop_on_first_match);
      setIsRecursive(ruleToEdit.rule.is_recursive);
      setCriteria(
        ruleToEdit.criteria.map((c) => ({
          field: c.field,
          operator: c.operator,
          pattern: c.pattern,
        }))
      );
      setActions(
        ruleToEdit.actions.map((a) => ({
          action_type: a.action_type,
          field: a.field,
          value: a.value,
        }))
      );
    } else {
      setRuleType(defaultRuleType);
      setName('');
      setDescription('');
      setIsActive(true);
      setRanking(10);
      setMatchLogic('AND');
      setStopOnFirstMatch(false);
      setIsRecursive(true);

      const suggestions = FIELD_SUGGESTIONS[defaultRuleType];
      const defaultField = suggestions?.criteria[0] || '';
      const defaultActionField = suggestions?.actions[0] || '';

      setCriteria([{ field: defaultField, operator: 'contains', pattern: '' }]);
      setActions([{ action_type: 'assign', field: defaultActionField, value: '' }]);
    }
    setErrorMsg(null);
  }, [ruleToEdit, defaultRuleType, isOpen]);

  if (!isOpen) return null;

  const currentSuggestions = FIELD_SUGGESTIONS[ruleType] || {
    criteria: [],
    actions: [],
  };

  const handleAddCriterion = () => {
    const defaultField = currentSuggestions.criteria[0] || '';
    setCriteria([...criteria, { field: defaultField, operator: 'contains', pattern: '' }]);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleCriterionChange = (index: number, key: keyof CreateRuleCriteriaDto, val: string) => {
    const updated = [...criteria];
    updated[index] = { ...updated[index], [key]: val };
    setCriteria(updated);
  };

  const handleAddAction = () => {
    const defaultField = currentSuggestions.actions[0] || '';
    setActions([...actions, { action_type: 'assign', field: defaultField, value: '' }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, key: keyof CreateRuleActionDto, val: string) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], [key]: val };
    setActions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor ingrese un nombre para la regla.');
      return;
    }
    if (actions.length === 0) {
      setErrorMsg('Debe definir al menos una acción a ejecutar.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (ruleToEdit) {
        const payload: UpdateRulePayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
          ranking,
          match_logic: matchLogic,
          stop_on_first_match: stopOnFirstMatch,
          is_recursive: isRecursive,
          criteria,
          actions,
        };
        await updateRule(ruleToEdit.rule.id, payload);
      } else {
        const payload: CreateRulePayload = {
          rule_type: ruleType,
          name: name.trim(),
          description: description.trim() || undefined,
          is_active: isActive,
          ranking,
          match_logic: matchLogic,
          stop_on_first_match: stopOnFirstMatch,
          is_recursive: isRecursive,
          criteria,
          actions,
        };
        await createRule(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la regla');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="openitil-modal-overlay">
      <div className="openitil-modal rule-editor-modal" style={{ maxWidth: 840 }}>
        {/* Modal Header */}
        <div className="openitil-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="rule-type-badge-icon">
              <Sliders size={20} color="#eb4d3d" />
            </div>
            <div>
              <h2 className="openitil-modal-title">
                {ruleToEdit ? 'Editar Regla de Negocio' : 'Crear Nueva Regla'}
              </h2>
              <p className="rule-modal-subtitle">
                Configure criterios condicionales y acciones automáticas para el motor de lógica
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-modal-close" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rule-editor-form">
          {errorMsg && (
            <div className="rule-error-alert">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* General Metadata Section */}
          <div className="rule-form-section">
            <h3 className="rule-section-title">1. Propiedades Principales</h3>
            <div className="rule-form-grid">
              <div className="rule-form-group">
                <label className="rule-form-label">Nombre de la Regla *</label>
                <input
                  type="text"
                  className="openitil-input"
                  placeholder="Ej: Normalizar fabricante Dell o Asignar a Soporte Redes"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="rule-form-group">
                <label className="rule-form-label">Prioridad / Ranking (Menor = Antes)</label>
                <input
                  type="number"
                  className="openitil-input"
                  value={ranking}
                  onChange={(e) => setRanking(parseInt(e.target.value, 10) || 10)}
                  min={1}
                  max={9999}
                />
              </div>
            </div>

            <div className="rule-form-group" style={{ marginTop: 12 }}>
              <label className="rule-form-label">Descripción o Notas de Comportamiento</label>
              <textarea
                className="openitil-input rule-textarea"
                placeholder="Explique el propósito o justificación técnica de esta automatización..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="rule-checkbox-row">
              <label className="rule-checkbox-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Regla Activa</span>
              </label>

              <label className="rule-checkbox-label">
                <input
                  type="checkbox"
                  checked={stopOnFirstMatch}
                  onChange={(e) => setStopOnFirstMatch(e.target.checked)}
                />
                <span>Detener ejecución si coincide (Stop on first match)</span>
              </label>

              <label className="rule-checkbox-label">
                <input
                  type="checkbox"
                  checked={isRecursive}
                  onChange={(e) => setIsRecursive(e.target.checked)}
                />
                <span>Aplicar a subentidades hijas (Recursivo)</span>
              </label>
            </div>
          </div>

          {/* Criteria Section */}
          <div className="rule-form-section">
            <div className="rule-section-header">
              <div>
                <h3 className="rule-section-title">2. Criterios de Coincidencia</h3>
                <span className="rule-section-desc">
                  Condiciones requeridas para que se disparen las acciones.
                </span>
              </div>
              <div className="rule-match-logic-toggle">
                <span>Evaluar con lógica:</span>
                <div className="rule-logic-buttons">
                  <button
                    type="button"
                    className={`rule-logic-btn ${matchLogic === 'AND' ? 'active' : ''}`}
                    onClick={() => setMatchLogic('AND')}
                  >
                    TODAS (AND)
                  </button>
                  <button
                    type="button"
                    className={`rule-logic-btn ${matchLogic === 'OR' ? 'active' : ''}`}
                    onClick={() => setMatchLogic('OR')}
                  >
                    CUALQUIERA (OR)
                  </button>
                </div>
              </div>
            </div>

            {criteria.length === 0 ? (
              <div className="rule-empty-criteria-box">
                <Sparkles size={18} color="#eb4d3d" />
                <span>Sin criterios: Esta regla se ejecutará como comodín para todas las entradas.</span>
              </div>
            ) : (
              <div className="rule-criteria-list">
                {criteria.map((crit, idx) => (
                  <div key={idx} className="rule-criterion-row">
                    <div className="rule-criterion-field">
                      <input
                        type="text"
                        className="openitil-input rule-input-sm"
                        placeholder="Campo (ej: subject)"
                        value={crit.field}
                        onChange={(e) => handleCriterionChange(idx, 'field', e.target.value)}
                        list={`criteria-suggestions-${idx}`}
                        required
                      />
                      <datalist id={`criteria-suggestions-${idx}`}>
                        {currentSuggestions.criteria.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>

                    <div className="rule-criterion-operator">
                      <select
                        className="openitil-select rule-input-sm"
                        value={crit.operator}
                        onChange={(e) => handleCriterionChange(idx, 'operator', e.target.value)}
                      >
                        {OPERATORS.map((op) => (
                          <option key={op.value} value={op.value}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rule-criterion-pattern">
                      <input
                        type="text"
                        className="openitil-input rule-input-sm"
                        placeholder={
                          crit.operator === 'regex_match'
                            ? 'Patrón Regex (ej: (?i)^Windows 11)'
                            : crit.operator === 'in_subnet'
                            ? '192.168.1.0/24'
                            : 'Valor patrón a comparar'
                        }
                        value={crit.pattern}
                        onChange={(e) => handleCriterionChange(idx, 'pattern', e.target.value)}
                        disabled={crit.operator === 'is_empty' || crit.operator === 'is_not_empty'}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-rule-delete-row"
                      onClick={() => handleRemoveCriterion(idx)}
                      title="Eliminar criterio"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn-rule-add-row"
              onClick={handleAddCriterion}
            >
              <Plus size={15} />
              <span>Añadir Criterio Condicional</span>
            </button>
          </div>

          {/* Actions Section */}
          <div className="rule-form-section">
            <div className="rule-section-header">
              <div>
                <h3 className="rule-section-title">3. Acciones a Ejecutar</h3>
                <span className="rule-section-desc">
                  Mutaciones aplicadas sobre el elemento o resultado devuelto por la regla.
                </span>
              </div>
              <div className="rule-helper-pill" title="En expresiones regulares, puede usar $1, $2 para insertar grupos capturados">
                <HelpCircle size={14} />
                <span>Soporta $1, $2 de Regex</span>
              </div>
            </div>

            <div className="rule-actions-list">
              {actions.map((act, idx) => (
                <div key={idx} className="rule-action-row">
                  <div className="rule-action-type">
                    <select
                      className="openitil-select rule-input-sm"
                      value={act.action_type}
                      onChange={(e) => handleActionChange(idx, 'action_type', e.target.value)}
                    >
                      {ACTION_TYPES.map((at) => (
                        <option key={at.value} value={at.value}>
                          {at.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rule-action-field">
                    <input
                      type="text"
                      className="openitil-input rule-input-sm"
                      placeholder="Campo a mutar (ej: urgency)"
                      value={act.field}
                      onChange={(e) => handleActionChange(idx, 'field', e.target.value)}
                      list={`action-suggestions-${idx}`}
                      required
                    />
                    <datalist id={`action-suggestions-${idx}`}>
                      {currentSuggestions.actions.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>

                  <div className="rule-action-value">
                    <input
                      type="text"
                      className="openitil-input rule-input-sm"
                      placeholder="Valor asignado (ej: 5 o Windows $1)"
                      value={act.value}
                      onChange={(e) => handleActionChange(idx, 'value', e.target.value)}
                      required={act.action_type !== 'ignore'}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-rule-delete-row"
                    onClick={() => handleRemoveAction(idx)}
                    title="Eliminar acción"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn-rule-add-row"
              onClick={handleAddAction}
            >
              <Plus size={15} />
              <span>Añadir Acción</span>
            </button>
          </div>

          {/* Modal Footer */}
          <div className="openitil-modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-save-primary"
              disabled={isSubmitting}
            >
              <Save size={16} />
              <span>{isSubmitting ? 'Guardando...' : ruleToEdit ? 'Actualizar Regla' : 'Guardar Regla'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
