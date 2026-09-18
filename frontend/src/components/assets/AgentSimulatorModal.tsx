import React, { useState } from 'react';
import { X, Radio, Play, CheckCircle2, RefreshCw, Laptop, Server } from 'lucide-react';
import { simulateAgentInventory } from '../../services/api';
import type { AgentSimulationResponse } from '../../types';
import { useToast } from '../../context/ToastContext';

interface AgentSimulatorModalProps {
  onClose: () => void;
  onSimulationSuccess: () => void;
}

export const AgentSimulatorModal: React.FC<AgentSimulatorModalProps> = ({
  onClose,
  onSimulationSuccess,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<'thinkpad_laptop' | 'ubuntu_workstation' | 'new_macbook'>('thinkpad_laptop');
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<AgentSimulationResponse | null>(null);
  const { showToast } = useToast();

  const presets = [
    {
      id: 'thinkpad_laptop',
      name: 'Lenovo ThinkPad T14s Gen 4 (Windows 11)',
      icon: Laptop,
      badge: 'Reconciliación por S/N',
      description: 'Envía el payload del portátil NB-STOCK-04 existente en la base de datos (SSN: PF48X91A). Verifica que el pipeline actualice su RAM, disco y software sin duplicarlo.',
    },
    {
      id: 'ubuntu_workstation',
      name: 'Dell Precision 5570 + Monitor 4K (Ubuntu)',
      icon: Laptop,
      badge: 'Reconciliación + Monitor',
      description: 'Envía el payload de la estación WS-DEV-JUAN (UUID: 4c4c4544-...). Verifica la reconciliación por UUID del sistema y el enlace con el monitor Dell U2723QE.',
    },
    {
      id: 'new_macbook',
      name: 'Apple MacBook Pro 16" M3 Max + Studio Display 5K',
      icon: Server,
      badge: 'Alta de Nuevo Activo',
      description: 'Envía un equipo Apple no registrado previamente. Verifica que el motor registre automáticamente el ordenador y cree el monitor Apple Studio Display conectado vía USB-C.',
    },
  ];

  const handleSimulate = async () => {
    try {
      setIsSimulating(true);
      setResult(null);
      const res = await simulateAgentInventory({
        preset_name: selectedPreset,
      });
      setResult(res);

      showToast({
        title: 'Inventario GLPI-Agent procesado',
        message: `Activo: ${res.asset_name} | Acción: ${res.action_taken === 'created' ? 'Nuevo Registro Creado' : 'Reconciliado y Actualizado'}`,
        type: 'success',
      });

      onSimulationSuccess();
    } catch (err: any) {
      showToast({
        title: 'Fallo en la simulación',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container agent-simulator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-cyan-400 pulse-icon" />
            <h2 className="modal-title">Simulador de Ingestión GLPI-Agent</h2>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body space-y-4">
          <p className="text-sm text-slate-300">
            Este simulador genera un payload JSON en el formato estándar transmitido por el demonio oficial <code>glpi-agent</code> a través de HTTP POST hacia <code>/api/v1/inventory/agent</code> para validar el pipeline de reconciliación en tiempo real.
          </p>

          {/* Preset Selector */}
          <div className="space-y-2">
            <label className="form-label">Selecciona el Escenario de Prueba:</label>
            <div className="space-y-2">
              {presets.map((p) => {
                const Icon = p.icon;
                const isSelected = selectedPreset === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPreset(p.id as any)}
                    className={`agent-preset-card ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="preset-icon-box">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">{p.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono border border-cyan-900/50">
                            {p.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Execution Result Box */}
          {result && (
            <div className="simulation-result-box">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
                <CheckCircle2 size={16} />
                <span>Respuesta del Servidor ITILSuite (HTTP 200 OK)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/80 p-3 rounded border border-emerald-900/40">
                <div>
                  <span className="text-slate-500 block">Acción Ejecutada:</span>
                  <strong className={result.action_taken === 'created' ? 'text-cyan-400' : 'text-amber-400'}>
                    {result.action_taken === 'created' ? 'NUEVO ACTIVO REGISTRADO' : 'RECONCILIADO & ACTUALIZADO'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Activo ID:</span>
                  <span className="text-slate-300">{result.asset_id}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block">Mensaje:</span>
                  <span className="text-slate-300">{result.message}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSimulating}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleSimulate}
            className="btn btn-primary flex items-center gap-2"
            disabled={isSimulating}
          >
            {isSimulating ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
            <span>{isSimulating ? 'Transmitiendo Ingestión...' : 'Disparar Ingestión GLPI-Agent'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
