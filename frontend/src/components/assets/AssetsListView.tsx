import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Server,
  Network,
  Monitor,
  Search,
  Plus,
  Radio,
  RefreshCw,
  Eye,
  Trash2,
  Layers,
  HardDrive,
} from 'lucide-react';
import type { AssetSummary, AssetMetrics, AssetType } from '../../types';
import { fetchAssets, fetchAssetMetrics, deleteAsset } from '../../services/api';
import { AssetDetailModal } from './AssetDetailModal';
import { CreateAssetModal } from './CreateAssetModal';
import { AgentSimulatorModal } from './AgentSimulatorModal';
import { useToast } from '../../context/ToastContext';

export const AssetsListView: React.FC = () => {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [metrics, setMetrics] = useState<AssetMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, [activeCategory, statusFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [assetsData, metricsData] = await Promise.all([
        fetchAssets({
          asset_type: activeCategory,
          status: statusFilter,
          search: searchQuery || undefined,
        }),
        fetchAssetMetrics(),
      ]);
      setAssets(assetsData);
      setMetrics(metricsData);
    } catch (err: any) {
      showToast({
        title: 'Error al cargar inventario',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDeleteAsset = async (id: string, name: string) => {
    if (!window.confirm(`¿Confirmas la eliminación del activo '${name}'?`)) {
      return;
    }
    try {
      await deleteAsset(id);
      showToast({
        title: 'Activo eliminado',
        message: `El activo '${name}' fue dado de baja correctamente`,
        type: 'info',
      });
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Error al eliminar',
        message: err.message,
        type: 'error',
      });
    }
  };

  const renderTypeIcon = (type: AssetType) => {
    switch (type) {
      case 'computer':
        return <Laptop size={16} className="text-cyan-400" />;
      case 'server':
        return <Server size={16} className="text-purple-400" />;
      case 'network_equipment':
        return <Network size={16} className="text-amber-400" />;
      case 'monitor':
        return <Monitor size={16} className="text-emerald-400" />;
      default:
        return <Layers size={16} className="text-slate-400" />;
    }
  };

  const formatRelativeTime = (timestamp: string | null) => {
    if (!timestamp) return 'Manual';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return date.toLocaleDateString();
  };

  return (
    <div className="assets-workspace-view">
      {/* Metrics Row */}
      <div className="assets-metrics-grid">
        <div className="asset-metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-title">Total Activos (CMDB)</span>
            <HardDrive size={18} className="text-cyan-400" />
          </div>
          <div className="metric-value">{metrics?.total_assets || assets.length}</div>
          <span className="metric-subtext">Base de datos de configuración</span>
        </div>

        <div className="asset-metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-title">Computadoras & Servidores</span>
            <Laptop size={18} className="text-purple-400" />
          </div>
          <div className="metric-value">
            {(metrics?.computers_count || 0) + (metrics?.servers_count || 0)}
          </div>
          <span className="metric-subtext">
            {metrics?.computers_count || 0} Workstations | {metrics?.servers_count || 0} Servidores
          </span>
        </div>

        <div className="asset-metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-title">Equipos de Red</span>
            <Network size={18} className="text-amber-400" />
          </div>
          <div className="metric-value">{metrics?.network_equipment_count || 0}</div>
          <span className="metric-subtext">Switches, Routers & Firewalls</span>
        </div>

        <div className="asset-metric-card">
          <div className="flex items-center justify-between">
            <span className="metric-title">Monitores & Periféricos</span>
            <Monitor size={18} className="text-emerald-400" />
          </div>
          <div className="metric-value">{metrics?.monitors_count || 0}</div>
          <span className="metric-subtext">Pantallas unitarias y de grupo</span>
        </div>

        <div className="asset-metric-card highlight">
          <div className="flex items-center justify-between">
            <span className="metric-title">Inventariados por Agente</span>
            <Radio size={18} className="text-cyan-400 pulse-icon" />
          </div>
          <div className="metric-value">{metrics?.agent_inventoried_count || 0}</div>
          <span className="metric-subtext">Compatibles con GLPI-Agent</span>
        </div>
      </div>

      {/* Main Controls & Filters Bar */}
      <div className="assets-controls-bar">
        {/* Category Pills */}
        <div className="assets-category-tabs">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'computer', label: 'Computadoras' },
            { id: 'server', label: 'Servidores' },
            { id: 'network_equipment', label: 'Redes' },
            { id: 'monitor', label: 'Monitores' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`category-tab-pill ${activeCategory === cat.id ? 'active' : ''}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search and Action Buttons */}
        <div className="assets-actions-group">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="asset-search-form">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre, serial, modelo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="asset-search-input"
            />
          </form>

          {/* Status Dropdown */}
          <select
            className="asset-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activo</option>
            <option value="in_stock">En Stock</option>
            <option value="in_repair">En Reparación</option>
            <option value="reserved">Reservado</option>
            <option value="decommissioned">Retirado</option>
          </select>

          {/* GLPI-Agent Simulator Trigger */}
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="btn-agent-simulator"
            title="Disparar simulación de envío de inventario GLPI-Agent"
          >
            <Radio size={15} className="pulse-icon text-cyan-400" />
            <span>Simulador GLPI-Agent</span>
          </button>

          {/* Create Manual Asset */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Nuevo Activo</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            className="btn-icon-secondary"
            title="Recargar inventario"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Assets Table */}
      <div className="assets-table-container">
        {isLoading ? (
          <div className="table-loading-state">
            <RefreshCw size={24} className="animate-spin text-cyan-400 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Cargando parque de activos...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="table-empty-state">
            <HardDrive size={32} className="text-slate-500 mx-auto mb-2" />
            <p className="text-base font-medium text-slate-300">No se encontraron activos</p>
            <p className="text-xs text-slate-500 mt-1">
              Prueba cambiando los filtros o usa el <strong>Simulador GLPI-Agent</strong> para registrar un equipo con un clic.
            </p>
          </div>
        ) : (
          <table className="assets-table">
            <thead>
              <tr>
                <th>Activo / Nombre</th>
                <th>Tipo</th>
                <th>Fabricante & Modelo</th>
                <th>Número de Serie (SSN)</th>
                <th>Estado</th>
                <th>Ubicación</th>
                <th>Origen / Último Inventario</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className="asset-table-row cursor-pointer"
                >
                  {/* Name + Icon */}
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="asset-type-icon-wrapper">
                        {renderTypeIcon(asset.asset_type)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-white hover:text-cyan-400 transition-colors">
                          {asset.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {asset.inventory_number || asset.id.substring(0, 8)}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Asset Type */}
                  <td>
                    <span className={`type-tag type-${asset.asset_type}`}>
                      {asset.asset_type === 'computer' && 'Computadora'}
                      {asset.asset_type === 'server' && 'Servidor'}
                      {asset.asset_type === 'network_equipment' && 'Equipo de Red'}
                      {asset.asset_type === 'monitor' && 'Monitor'}
                      {asset.asset_type === 'printer' && 'Impresora'}
                      {asset.asset_type === 'peripheral' && 'Periférico'}
                      {asset.asset_type === 'phone' && 'Telefonía'}
                      {asset.asset_type === 'other' && 'Otro'}
                    </span>
                  </td>

                  {/* Manufacturer & Model */}
                  <td>
                    <div className="text-sm text-slate-200">
                      {asset.manufacturer || 'Desconocido'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {asset.model || '-'}
                    </div>
                  </td>

                  {/* Serial Number */}
                  <td>
                    <span className="font-mono text-xs text-slate-300">
                      {asset.serial_number || <span className="text-slate-600">N/D</span>}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`asset-status-pill status-${asset.status}`}>
                      {asset.status === 'active' && 'Activo'}
                      {asset.status === 'in_stock' && 'En Stock'}
                      {asset.status === 'in_repair' && 'En Reparación'}
                      {asset.status === 'decommissioned' && 'Retirado'}
                      {asset.status === 'reserved' && 'Reservado'}
                    </span>
                  </td>

                  {/* Location */}
                  <td>
                    <span className="text-xs text-slate-300">
                      {asset.location || <span className="text-slate-600">Sin asignar</span>}
                    </span>
                  </td>

                  {/* Origin / Agent */}
                  <td>
                    {asset.agent_version ? (
                      <div className="flex items-center gap-1.5" title={`Reportado por ${asset.agent_version}`}>
                        <Radio size={12} className="text-cyan-400 pulse-icon" />
                        <span className="text-xs text-cyan-300 font-medium">GLPI-Agent</span>
                        <span className="text-[11px] text-slate-500 font-mono">({formatRelativeTime(asset.last_inventory_at)})</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Manual</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedAssetId(asset.id)}
                        className="btn-action-icon"
                        title="Ver ficha técnica"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        className="btn-action-icon text-rose-400 hover:bg-rose-500/20"
                        title="Eliminar activo"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {selectedAssetId && (
        <AssetDetailModal
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
          onAssetUpdated={loadData}
        />
      )}

      {isCreateModalOpen && (
        <CreateAssetModal
          onClose={() => setIsCreateModalOpen(false)}
          onAssetCreated={loadData}
        />
      )}

      {isSimulatorOpen && (
        <AgentSimulatorModal
          onClose={() => setIsSimulatorOpen(false)}
          onSimulationSuccess={loadData}
        />
      )}
    </div>
  );
};
