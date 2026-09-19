import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { DryRunRequest, DryRunResult } from '../../types';
import { dryRunRules } from '../../services/api';

interface RuleSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRuleType?: string;
}

interface PresetOption {
  label: string;
  rule_type: string;
  inputs: Record<string, string>;
}

const PRESETS: PresetOption[] = [
  {
    label: 'Normalización: Hewlett-Packard -> HP',
    rule_type: 'dict_manufacturer',
    inputs: { raw_manufacturer: 'Hewlett-Packard Enterprise' },
  },
  {
    label: 'Normalización: Dell Computer -> Dell',
    rule_type: 'dict_manufacturer',
    inputs: { raw_manufacturer: 'Dell Inc. Corp' },
  },
  {
    label: 'Normalización: Windows 11 Pro 64-bit',
    rule_type: 'dict_os',
    inputs: { raw_os_name: 'Microsoft Windows 11 Pro Edition' },
  },
  {
    label: 'Mesa de Ayuda: Incidencia Crítica por Asunto',
    rule_type: 'ticket_business',
    inputs: {
      subject: 'Servidor de Producción caído y bloqueante',
      content: 'No hay conexión a la base de datos central.',
      from_email: 'gerencia@empresa.com',
      urgency: '3',
      impact: '3',
    },
  },
  {
    label: 'Mesa de Ayuda: Consulta General de Usuario',
    rule_type: 'ticket_business',
    inputs: {
      subject: 'Consulta sobre cambio de teclado',
      content: 'Hola, quería saber el procedimiento para renovar mi teclado.',
      from_email: 'carlos@empresa.com',
      urgency: '2',
      impact: '2',
    },
  },
  {
    label: 'Reconciliación: Activo por UUID de BIOS',
    rule_type: 'asset_import_link',
    inputs: {
      bios_uuid: '4c4c4544-004a-4a10-8054-b3c04f4a3433',
      serial_number: 'CNU1234XYZ',
      mac_address: '00:1A:2B:3C:4D:5E',
      hostname: 'PC-CONTABILIDAD-01',
    },
  },
  {
    label: 'Asignación de Entidad: IP en Sede Sucursal (192.168.10.45)',
    rule_type: 'asset_entity',
    inputs: {
      ip_address: '192.168.10.45',
      hostname: 'SRV-SUCURSAL-NORTE',
      domain: 'sucursal.empresa.local',
    },
  },
];

export const RuleSimulatorModal: React.FC<RuleSimulatorModalProps> = ({
  isOpen,
  onClose,
  initialRuleType = 'ticket_business',
}) => {
  const [ruleType, setRuleType] = useState(initialRuleType);
  const [inputFields, setInputFields] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setRuleType(initialRuleType);
    // Find matching preset
    const defaultPreset = PRESETS.find((p) => p.rule_type === initialRuleType) || PRESETS[0];
    setInputFields(defaultPreset.inputs);
    setResult(null);
    setErrorMsg(null);
  }, [initialRuleType, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: PresetOption) => {
    setRuleType(preset.rule_type);
    setInputFields(preset.inputs);
    setResult(null);
    setErrorMsg(null);
  };

  const handleFieldChange = (key: string, value: string) => {
    setInputFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddField = () => {
    if (!newKey.trim()) return;
    setInputFields((prev) => ({ ...prev, [newKey.trim()]: newVal }));
    setNewKey('');
    setNewVal('');
  };

  const handleRemoveField = (key: string) => {
    setInputFields((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleExecute = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setResult(null);

      const payload: DryRunRequest = {
        rule_type: ruleType,
        input_fields: inputFields,
      };

      const res = await dryRunRules(payload);
      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ejecutar la simulación de reglas');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="openitil-modal-overlay">
      <div className="openitil-modal rule-simulator-modal" style={{ maxWidth: 960 }}>
        {/* Modal Header */}
        <div className="openitil-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="rule-type-badge-icon" style={{ background: 'rgba(235, 77, 61, 0.15)' }}>
              <Play size={20} color="#eb4d3d" />
            </div>
            <div>
              <h2 className="openitil-modal-title">Sandbox de Simulación de Reglas</h2>
              <p className="rule-modal-subtitle">
                Evalúe el comportamiento y mutación en tiempo real sin alterar la base de datos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-modal-close" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="rule-simulator-body">
          {/* Top Presets bar */}
          <div className="rule-presets-section">
            <span className="rule-presets-title">
              <Sparkles size={14} color="#f59e0b" />
              <span>Plantillas de Prueba Rápidas:</span>
            </span>
            <div className="rule-presets-pills">
              {PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  className={`btn-preset-pill ${preset.rule_type === ruleType ? 'active' : ''}`}
                  onClick={() => handleApplyPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rule-simulator-grid">
            {/* Left Column: Mock Payload Inputs */}
            <div className="rule-sim-col rule-sim-input-col">
              <div className="rule-sim-header-row">
                <h3 className="rule-section-title">Parámetros de Entrada</h3>
                <span className="rule-sim-badge">Tipo: {ruleType}</span>
              </div>

              <div className="rule-sim-fields-list">
                {Object.entries(inputFields).map(([k, v]) => (
                  <div key={k} className="rule-sim-field-item">
                    <div className="rule-sim-field-meta">
                      <span className="rule-sim-field-key">{k}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(k)}
                        className="btn-rule-sim-del"
                        title="Quitar campo"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <input
                      type="text"
                      className="openitil-input rule-input-sm"
                      value={v}
                      onChange={(e) => handleFieldChange(k, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {/* Add custom field row */}
              <div className="rule-sim-add-field">
                <input
                  type="text"
                  placeholder="Nuevo campo (ej: domain)"
                  className="openitil-input rule-input-sm"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Valor"
                  className="openitil-input rule-input-sm"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-sim-add"
                  onClick={handleAddField}
                  disabled={!newKey.trim()}
                >
                  Añadir
                </button>
              </div>

              <button
                type="button"
                className="btn-execute-simulation"
                onClick={handleExecute}
                disabled={isLoading}
              >
                <Play size={16} fill="#ffffff" />
                <span>{isLoading ? 'Simulando...' : 'Ejecutar Simulación'}</span>
              </button>

              {errorMsg && (
                <div className="rule-error-alert" style={{ marginTop: 12 }}>
                  <ShieldAlert size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Right Column: Execution Trace & Results */}
            <div className="rule-sim-col rule-sim-result-col">
              <div className="rule-sim-header-row">
                <h3 className="rule-section-title">Traza de Ejecución y Salida</h3>
                {result && (
                  <div className="rule-sim-metrics">
                    <span className="rule-sim-metric-pill">
                      <Clock size={13} />
                      <span>{result.execution_time_us} µs</span>
                    </span>
                    <span className="rule-sim-metric-pill">
                      {result.total_rules_matched} / {result.total_rules_evaluated} Reglas
                    </span>
                  </div>
                )}
              </div>

              {!result && !isLoading && (
                <div className="rule-sim-placeholder">
                  <Sliders size={40} opacity={0.25} color="#eb4d3d" />
                  <p>Haga clic en <strong>"Ejecutar Simulación"</strong> para evaluar el pipeline de reglas sobre los datos mock.</p>
                </div>
              )}

              {result && (
                <div className="rule-sim-results-container">
                  {/* Step-by-Step Rule Pipeline Trace */}
                  <div className="rule-steps-trace">
                    <h4 className="rule-trace-title">Pasos del Pipeline Evaluados:</h4>
                    {result.steps.length === 0 ? (
                      <p className="rule-trace-empty">No hay reglas activas registradas para este tipo ({ruleType}).</p>
                    ) : (
                      result.steps.map((step) => (
                        <div
                          key={step.rule_id}
                          className={`rule-step-card ${step.matched ? 'step-matched' : 'step-not-matched'}`}
                        >
                          <div className="rule-step-header">
                            <div className="rule-step-title-group">
                              <span className="rule-step-rank">#{step.ranking}</span>
                              {step.matched ? (
                                <CheckCircle2 size={16} color="#10b981" />
                              ) : (
                                <XCircle size={16} color="#ef4444" />
                              )}
                              <span className="rule-step-name">{step.rule_name}</span>
                            </div>
                            <span className={`rule-step-status-pill ${step.matched ? 'matched' : 'unmatched'}`}>
                              {step.matched ? 'COINCIDIÓ' : 'NO COINCIDIÓ'}
                            </span>
                          </div>

                          {/* Criteria Checklist */}
                          {step.criteria_results.length > 0 && (
                            <div className="rule-step-criteria-list">
                              {step.criteria_results.map((c, cIdx) => (
                                <div key={cIdx} className="rule-step-criterion">
                                  {c.matched ? (
                                    <span className="crit-icon pass">✓</span>
                                  ) : (
                                    <span className="crit-icon fail">✕</span>
                                  )}
                                  <span className="crit-field">{c.field}</span>
                                  <span className="crit-op">[{c.operator}]</span>
                                  <span className="crit-pat">"{c.pattern}"</span>
                                  <span className="crit-sep">vs</span>
                                  <span className="crit-val">"{c.actual_value || ''}"</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions Executed */}
                          {step.matched && step.actions_executed.length > 0 && (
                            <div className="rule-step-actions-list">
                              <span className="rule-actions-label">Mutaciones aplicadas:</span>
                              {step.actions_executed.map((act, aIdx) => (
                                <div key={aIdx} className="rule-step-action-item">
                                  <ArrowRight size={13} color="#eb4d3d" />
                                  <span className="action-field">{act.field}</span>
                                  <span>=</span>
                                  <span className="action-val">"{act.computed_value}"</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {step.stopped_pipeline && (
                            <div className="rule-step-halted-notice">
                              <span>⛔ Detuvo la ejecución del pipeline (Stop on first match)</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Final Output Payload */}
                  <div className="rule-final-output-card">
                    <h4 className="rule-trace-title">Resultado Final Producido:</h4>
                    <pre className="rule-output-json">
                      {JSON.stringify(result.final_output_fields, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="openitil-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cerrar Simulador
          </button>
        </div>
      </div>
    </div>
  );
};
