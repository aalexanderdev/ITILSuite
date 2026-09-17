import React, { useState } from 'react';
import { X, Plus, Laptop, Server, Network, Monitor, Layers } from 'lucide-react';
import type { AssetType, AssetStatus, CreateAssetPayload } from '../../types';
import { createAsset } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface CreateAssetModalProps {
  onClose: () => void;
  onAssetCreated: () => void;
}

export const CreateAssetModal: React.FC<CreateAssetModalProps> = ({
  onClose,
  onAssetCreated,
}) => {
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('computer');
  const [status, setStatus] = useState<AssetStatus>('active');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [location, setLocation] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast({
        title: 'Campo obligatorio',
        message: 'Por favor, ingresa el nombre del activo.',
        type: 'error',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreateAssetPayload = {
        name: name.trim(),
        asset_type: assetType,
        status,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        inventory_number: inventoryNumber.trim() || undefined,
        location: location.trim() || undefined,
        comments: comments.trim() || undefined,
      };

      await createAsset(payload);
      showToast({
        title: 'Activo creado con éxito',
        message: `El activo '${name}' fue registrado en la base CMDB`,
        type: 'success',
      });

      onAssetCreated();
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Error al registrar activo',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container create-asset-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Plus size={20} className="text-cyan-400" />
            <h2 className="modal-title">Registrar Nuevo Activo (ITAM / CMDB)</h2>
          </div>
          <button onClick={onClose} className="modal-close-btn" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* Asset Type Selector */}
            <div className="form-group">
              <label className="form-label">Tipo de Activo *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'computer', label: 'Computadora', icon: Laptop },
                  { id: 'server', label: 'Servidor', icon: Server },
                  { id: 'network_equipment', label: 'Equipo de Red', icon: Network },
                  { id: 'monitor', label: 'Monitor', icon: Monitor },
                  { id: 'printer', label: 'Impresora', icon: Layers },
                  { id: 'other', label: 'Otro / Periférico', icon: Layers },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`type-picker-btn ${assetType === t.id ? 'active' : ''}`}
                      onClick={() => setAssetType(t.id as AssetType)}
                    >
                      <Icon size={16} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Nombre del Activo / Hostname *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: PC-VENTAS-02, SW-PISO1-01"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AssetStatus)}
                >
                  <option value="active">Activo</option>
                  <option value="in_stock">En Stock</option>
                  <option value="in_repair">En Reparación</option>
                  <option value="reserved">Reservado</option>
                  <option value="decommissioned">Retirado / Desmantelado</option>
                </select>
              </div>
            </div>

            {/* Manufacturer & Model */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Fabricante</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Dell, Cisco, Lenovo, HP"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: Latitude 5430, Catalyst 9200L"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>

            {/* Serial & Inventory Number */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Número de Serie (SSN)</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="Ej: 7B9X2K3"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Número de Inventario Interno</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej: INV-2026-0120"
                  value={inventoryNumber}
                  onChange={(e) => setInventoryNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="form-group">
              <label className="form-label">Ubicación Física</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Edificio Central - Piso 2 - Sala Servidores"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {/* Comments */}
            <div className="form-group">
              <label className="form-label">Observaciones y Comentarios</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Notas técnicas sobre el hardware o configuración inicial..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar Activo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
