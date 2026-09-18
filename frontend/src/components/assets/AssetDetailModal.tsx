import React, { useState, useEffect } from 'react';
import {
  X,
  Laptop,
  Server,
  Network,
  Monitor,
  Printer,
  Smartphone,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  ShieldAlert,
  Lock,
  Unlock,
  Radio,
  Clock,
  Package,
} from 'lucide-react';
import type { AssetDetail } from '../../types';
import { fetchAssetById, updateAsset } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface AssetDetailModalProps {
  assetId: string;
  onClose: () => void;
  onAssetUpdated?: () => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  assetId,
  onClose,
  onAssetUpdated,
}) => {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'hardware' | 'software' | 'network' | 'connections'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const loadAsset = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAssetById(assetId);
      setAsset(data);
    } catch (err: any) {
      showToast({
        title: 'Error al cargar activo',
        message: err.message,
        type: 'error',
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAsset();
  }, [assetId]);

  const handleToggleLockField = async (fieldName: string) => {
    if (!asset) return;
    try {
      setIsSaving(true);
      const currentLocked = asset.locked_fields || [];
      const newLocked = currentLocked.includes(fieldName)
        ? currentLocked.filter((f) => f !== fieldName)
        : [...currentLocked, fieldName];

      await updateAsset(asset.id, {
        is_locked: newLocked.length > 0,
        locked_fields: newLocked,
      });

      setAsset({
        ...asset,
        is_locked: newLocked.length > 0,
        locked_fields: newLocked,
      });

      showToast({
        title: 'Bloqueo actualizado',
        message: `El campo '${fieldName}' ahora está ${newLocked.includes(fieldName) ? 'bloqueado contra sobrescritura de agentes' : 'desbloqueado'}`,
        type: 'success',
      });

      if (onAssetUpdated) onAssetUpdated();
    } catch (err: any) {
      showToast({
        title: 'Error al actualizar bloqueo',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'computer':
        return <Laptop size={20} className="text-cyan-400" />;
      case 'server':
        return <Server size={20} className="text-purple-400" />;
      case 'network_equipment':
        return <Network size={20} className="text-amber-400" />;
      case 'monitor':
        return <Monitor size={20} className="text-emerald-400" />;
      case 'printer':
        return <Printer size={20} className="text-blue-400" />;
      case 'phone':
        return <Smartphone size={20} className="text-rose-400" />;
      default:
        return <Layers size={20} className="text-slate-400" />;
    }
  };

  if (isLoading || !asset) {
    return (
      <div className="modal-backdrop">
        <div className="modal-container asset-detail-modal loading-state">
          <div className="spinner-large" />
          <p className="loading-text">Cargando ficha técnica del activo...</p>
        </div>
      </div>
    );
  }

  const specs = asset.specifications || {};
  const isFieldLocked = (field: string) => (asset.locked_fields || []).includes(field);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container asset-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header asset-modal-header">
          <div className="asset-header-main">
            <div className="asset-type-badge-icon">
              {renderTypeIcon(asset.asset_type)}
            </div>
            <div>
              <div className="asset-header-title-row">
                <h2 className="modal-title">{asset.name}</h2>
                <span className={`asset-status-pill status-${asset.status}`}>
                  {asset.status === 'active' && 'Activo'}
                  {asset.status === 'in_stock' && 'En Stock'}
                  {asset.status === 'in_repair' && 'En Reparación'}
                  {asset.status === 'decommissioned' && 'Retirado'}
                  {asset.status === 'reserved' && 'Reservado'}
                </span>
                {asset.agent_version && (
                  <span className="agent-badge-pill" title={`Inventariado por ${asset.agent_version}`}>
                    <Radio size={12} className="pulse-icon" />
                    <span>{asset.agent_version}</span>
                  </span>
                )}
              </div>
              <p className="modal-subtitle">
                {asset.manufacturer || 'Fabricante Desconocido'} {asset.model || ''} | S/N: {asset.serial_number || 'N/D'} | Ámbito: <strong>{asset.entity_name}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="asset-tabs-nav">
          <button
            className={`asset-tab-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Activity size={15} />
            <span>General & Gestión</span>
          </button>
          <button
            className={`asset-tab-btn ${activeTab === 'hardware' ? 'active' : ''}`}
            onClick={() => setActiveTab('hardware')}
          >
            <Cpu size={15} />
            <span>Hardware & Componentes</span>
          </button>
          <button
            className={`asset-tab-btn ${activeTab === 'software' ? 'active' : ''}`}
            onClick={() => setActiveTab('software')}
          >
            <Package size={15} />
            <span>SO & Software</span>
          </button>
          <button
            className={`asset-tab-btn ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            <Network size={15} />
            <span>Redes & Puertos</span>
          </button>
          <button
            className={`asset-tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
          >
            <Layers size={15} />
            <span>Conexiones ({asset.connections?.length || 0})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="modal-body asset-modal-body">
          {/* 1. GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="asset-tab-content">
              <div className="asset-meta-grid">
                {/* Identification Card */}
                <div className="asset-info-card">
                  <h4 className="card-heading">Identificación del Activo</h4>
                  <div className="info-row">
                    <span className="info-label">Nombre de Host:</span>
                    <span className="info-value font-mono">{asset.name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Número de Serie (SSN):</span>
                    <span className="info-value font-mono">{asset.serial_number || 'No especificado'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Número de Inventario:</span>
                    <span className="info-value">{asset.inventory_number || 'N/D'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">UUID del Sistema (BIOS):</span>
                    <span className="info-value font-mono text-xs">{asset.uuid || 'N/D'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Fabricante / Modelo:</span>
                    <span className="info-value">{asset.manufacturer || 'N/D'} - {asset.model || 'N/D'}</span>
                  </div>
                </div>

                {/* Assignment & Location Card */}
                <div className="asset-info-card">
                  <h4 className="card-heading">Asignación & Ubicación</h4>
                  <div className="info-row">
                    <span className="info-label">Ubicación Física:</span>
                    <div className="info-value-locked">
                      <span>{asset.location || 'Sin asignar'}</span>
                      <button
                        className={`lock-toggle-btn ${isFieldLocked('location') ? 'locked' : ''}`}
                        onClick={() => handleToggleLockField('location')}
                        title={isFieldLocked('location') ? 'Campo bloqueado: el agente no lo sobreescribirá' : 'Hacer clic para bloquear campo'}
                        disabled={isSaving}
                      >
                        {isFieldLocked('location') ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Usuario Asignado:</span>
                    <div className="info-value-locked">
                      <span>{asset.user_name || 'Sin asignar'}</span>
                      <button
                        className={`lock-toggle-btn ${isFieldLocked('user_id') ? 'locked' : ''}`}
                        onClick={() => handleToggleLockField('user_id')}
                        title={isFieldLocked('user_id') ? 'Campo bloqueado' : 'Hacer clic para bloquear'}
                        disabled={isSaving}
                      >
                        {isFieldLocked('user_id') ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Técnico a Cargo:</span>
                    <span className="info-value">{asset.technician_name || 'Sin asignar'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Grupo Responsable:</span>
                    <span className="info-value">{asset.group_in_charge || 'Soporte TI'}</span>
                  </div>
                </div>
              </div>

              {/* Field Locks Notice Box */}
              <div className="field-locks-box">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldAlert size={16} className="text-amber-400" />
                  <span>Protección contra sobreescritura de Agentes (GLPI Field Locks):</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Los campos bloqueados preservan modificaciones manuales del administrador cuando `glpi-agent` transmite nuevos inventarios.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['name', 'location', 'user_id', 'manufacturer', 'model', 'comments'].map((field) => (
                    <button
                      key={field}
                      onClick={() => handleToggleLockField(field)}
                      disabled={isSaving}
                      className={`lock-tag ${isFieldLocked(field) ? 'active' : ''}`}
                    >
                      {isFieldLocked(field) ? <Lock size={11} /> : <Unlock size={11} />}
                      <span>{field}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div className="asset-info-card">
                <h4 className="card-heading">Comentarios y Observaciones</h4>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                  {asset.comments || 'Sin comentarios registrados para este activo.'}
                </p>
              </div>
            </div>
          )}

          {/* 2. HARDWARE TAB */}
          {activeTab === 'hardware' && (
            <div className="asset-tab-content">
              <div className="hardware-grid">
                {/* CPU Specs */}
                <div className="asset-info-card">
                  <div className="card-icon-title">
                    <Cpu size={18} className="text-cyan-400" />
                    <h4 className="card-heading">Procesador (CPU)</h4>
                  </div>
                  {specs.cpu ? (
                    <div className="space-y-2 mt-2">
                      <div className="text-sm font-semibold text-white">{specs.cpu.name || 'Procesador estándar'}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <div>Núcleos: <strong className="text-slate-200">{specs.cpu.cores || 'N/D'}</strong></div>
                        <div>Hilos: <strong className="text-slate-200">{specs.cpu.threads || 'N/D'}</strong></div>
                        <div>Frecuencia: <strong className="text-slate-200">{specs.cpu.speed_mhz ? `${specs.cpu.speed_mhz} MHz` : 'N/D'}</strong></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">Sin información detallada de CPU reportada.</p>
                  )}
                </div>

                {/* Memory Specs */}
                <div className="asset-info-card">
                  <div className="card-icon-title">
                    <Activity size={18} className="text-purple-400" />
                    <h4 className="card-heading">Memoria RAM</h4>
                  </div>
                  {specs.memory ? (
                    <div className="space-y-2 mt-2">
                      <div className="text-sm font-semibold text-white">
                        {specs.memory.total_mb ? `${Math.round(specs.memory.total_mb / 1024)} GB` : 'N/D'}{' '}
                        <span className="text-xs text-slate-400 font-normal">({specs.memory.type || 'DDR'})</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Ranuras ocupadas: <strong className="text-slate-200">{specs.memory.slots_used || 1}</strong> de {specs.memory.slots_total || specs.memory.slots_used || 2}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">Sin memoria reportada.</p>
                  )}
                </div>
              </div>

              {/* Storage Disks Section */}
              <div className="asset-info-card">
                <div className="card-icon-title">
                  <HardDrive size={18} className="text-amber-400" />
                  <h4 className="card-heading">Unidades de Almacenamiento</h4>
                </div>
                {specs.storage && specs.storage.length > 0 ? (
                  <div className="space-y-3 mt-3">
                    {specs.storage.map((disk: any, idx: number) => {
                      const usedGb = Math.max(0, (disk.size_gb || 0) - (disk.free_gb || 0));
                      const percentUsed = disk.size_gb ? Math.round((usedGb / disk.size_gb) * 100) : 0;
                      return (
                        <div key={idx} className="disk-row">
                          <div className="disk-meta flex justify-between text-xs mb-1">
                            <span className="font-mono text-slate-200">{disk.name} {disk.mount_point ? `(${disk.mount_point})` : ''}</span>
                            <span className="text-slate-400">
                              {usedGb} GB usados de {disk.size_gb} GB ({percentUsed}%) | Libres: {disk.free_gb} GB
                            </span>
                          </div>
                          <div className="disk-progress-bar">
                            <div
                              className={`disk-progress-fill ${percentUsed > 85 ? 'danger' : percentUsed > 70 ? 'warning' : 'normal'}`}
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">No se han registrado volúmenes de disco.</p>
                )}
              </div>
            </div>
          )}

          {/* 3. SOFTWARE TAB */}
          {activeTab === 'software' && (
            <div className="asset-tab-content">
              {/* OS Summary */}
              <div className="asset-info-card">
                <h4 className="card-heading">Sistema Operativo</h4>
                {specs.os ? (
                  <div className="grid grid-cols-2 gap-3 text-sm mt-2">
                    <div>Nombre: <strong className="text-white">{specs.os.name || 'N/D'}</strong></div>
                    <div>Versión: <strong className="text-slate-200">{specs.os.version || 'N/D'}</strong></div>
                    <div>Arquitectura: <strong className="text-slate-200">{specs.os.arch || 'x86_64'}</strong></div>
                    <div>Kernel: <strong className="text-slate-200 font-mono text-xs">{specs.os.kernel || 'N/D'}</strong></div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Sin sistema operativo detectado.</p>
                )}
              </div>

              {/* Softwares Table */}
              <div className="asset-info-card">
                <h4 className="card-heading">Paquetes de Software Instalados</h4>
                {specs.softwares && specs.softwares.length > 0 ? (
                  <div className="softwares-table-wrapper max-h-64 overflow-y-auto mt-2">
                    <table className="asset-table mini-table">
                      <thead>
                        <tr>
                          <th>Nombre del Paquete</th>
                          <th>Versión</th>
                          <th>Proveedor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specs.softwares.map((sw: any, idx: number) => (
                          <tr key={idx}>
                            <td className="font-medium text-slate-200">{sw.name}</td>
                            <td className="font-mono text-xs text-cyan-400">{sw.version || 'N/D'}</td>
                            <td className="text-xs text-slate-400">{sw.publisher || 'N/D'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-2">No se han listado aplicaciones instaladas.</p>
                )}
              </div>
            </div>
          )}

          {/* 4. NETWORK TAB */}
          {activeTab === 'network' && (
            <div className="asset-tab-content">
              {specs.networks && specs.networks.length > 0 ? (
                <div className="space-y-2">
                  {specs.networks.map((net: any, idx: number) => (
                    <div key={idx} className="asset-info-card">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-sm text-cyan-400 font-mono">{net.name}</span>
                        <span className={`status-pill-small ${net.status === 'up' ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {net.status === 'up' ? 'Enlace Activo (UP)' : 'Inactivo (DOWN)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block">Dirección IP:</span>
                          <strong className="text-slate-200 font-mono">{net.ip || 'N/D'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Dirección MAC:</span>
                          <strong className="text-slate-200 font-mono">{net.mac || 'N/D'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Máscara:</span>
                          <strong className="text-slate-200 font-mono">{net.netmask || 'N/D'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Velocidad / Tipo:</span>
                          <strong className="text-slate-200">{net.speed || 'Ethernet'}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-box">
                  <Network size={24} className="text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay interfaces de red registradas para este activo.</p>
                </div>
              )}
            </div>
          )}

          {/* 5. CONNECTIONS TAB */}
          {activeTab === 'connections' && (
            <div className="asset-tab-content">
              {asset.connections && asset.connections.length > 0 ? (
                <div className="space-y-2">
                  {asset.connections.map((conn) => (
                    <div key={conn.connection_id} className="asset-connection-card">
                      <div className="flex items-center gap-3">
                        <div className="conn-icon">
                          {renderTypeIcon(conn.asset_type)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-white">{conn.name}</div>
                          <div className="text-xs text-slate-400">
                            Tipo: {conn.asset_type} | Conexión: <strong className="text-cyan-400">{conn.connection_type}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-box">
                  <Layers size={24} className="text-slate-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay monitores ni periféricos conectados directamente a este equipo.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer asset-modal-footer">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Clock size={13} />
            <span>Último inventario: {asset.last_inventory_at ? new Date(asset.last_inventory_at).toLocaleString() : 'Manual'}</span>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
