import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type {
  BatchUserImportItem,
  BatchUserImportResponse,
  ConflictResolution,
  GroupSummary,
} from '../../types';
import { batchImportUsers, fetchGroups } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const DEMO_CSV_DATA = `username,email,firstname,realname,profile_name,group_name
laura_soporte,laura.martinez@empresa.com,Laura,Martínez,Technician,Soporte Nivel 1
esteban_redes,esteban.rodriguez@empresa.com,Esteban,Rodríguez,Technician,Infraestructura & Redes
valeria_rh,valeria.sanchez@empresa.com,Valeria,Sánchez,Self-Service,Recursos Humanos
miguel_dev,miguel.lopez@empresa.com,Miguel,López,Technician,Desarrollo & Sistemas
ana_coord,ana.torres@empresa.com,Ana,Torres,Super-Admin,Soporte Nivel 1`;

export const BatchUserImportTab: React.FC = () => {
  const { activeEntity } = useAuth();
  const { toast } = useToast();

  const [inputFormat, setInputFormat] = useState<'csv' | 'json'>('csv');
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(',');
  const [rawText, setRawText] = useState('');
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [defaultProfileId, setDefaultProfileId] = useState('00000000-0000-0000-0000-000000000012'); // Self-Service
  const [defaultGroupId, setDefaultGroupId] = useState('');
  const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([]);

  const [parsedRows, setParsedRows] = useState<BatchUserImportItem[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<BatchUserImportResponse | null>(null);

  useEffect(() => {
    fetchGroups().then(setAvailableGroups).catch(console.error);
  }, []);

  // Parse raw text whenever it changes
  useEffect(() => {
    if (!rawText.trim()) {
      setParsedRows([]);
      setParsingError(null);
      return;
    }

    try {
      if (inputFormat === 'json') {
        const json = JSON.parse(rawText);
        if (Array.isArray(json)) {
          setParsedRows(json);
          setParsingError(null);
        } else {
          setParsingError('El JSON debe ser un arreglo de objetos de usuario.');
          setParsedRows([]);
        }
      } else {
        // Parse CSV
        const lines = rawText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setParsedRows([]);
          setParsingError('El archivo CSV debe tener una fila de encabezados y al menos una fila de datos.');
          return;
        }

        const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase());
        const uIdx = headers.indexOf('username');
        const eIdx = headers.indexOf('email');
        const fnIdx = headers.indexOf('firstname');
        const rnIdx = headers.indexOf('realname');
        const pIdx = headers.indexOf('profile_name') !== -1 ? headers.indexOf('profile_name') : headers.indexOf('profile');
        const gIdx = headers.indexOf('group_name') !== -1 ? headers.indexOf('group_name') : headers.indexOf('group');

        if (uIdx === -1 || eIdx === -1) {
          setParsingError("El CSV debe contener al menos las columnas 'username' y 'email'.");
          setParsedRows([]);
          return;
        }

        const rows: BatchUserImportItem[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(delimiter).map((c) => c.trim());
          if (cols.length < 2) continue;

          rows.push({
            username: cols[uIdx] || '',
            email: cols[eIdx] || '',
            firstname: fnIdx !== -1 ? cols[fnIdx] : undefined,
            realname: rnIdx !== -1 ? cols[rnIdx] : undefined,
            profile_name: pIdx !== -1 ? cols[pIdx] : undefined,
            group_name: gIdx !== -1 ? cols[gIdx] : undefined,
            is_active: true,
          });
        }

        setParsedRows(rows);
        setParsingError(null);
      }
    } catch (err: unknown) {
      setParsingError(err instanceof Error ? err.message : 'Error al parsear datos');
      setParsedRows([]);
    }
  }, [rawText, inputFormat, delimiter]);

  const handleLoadDemo = () => {
    setInputFormat('csv');
    setDelimiter(',');
    setRawText(DEMO_CSV_DATA);
    setExecutionResult(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        setInputFormat('json');
      } else {
        setInputFormat('csv');
      }
      setRawText(content);
      setExecutionResult(null);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const res = await batchImportUsers({
        users: parsedRows,
        conflict_resolution: conflictResolution,
        default_entity_id: activeEntity.id,
        default_profile_id: defaultProfileId,
        default_group_id: defaultGroupId || undefined,
        default_password: 'WelcomeITIL2026!',
      });

      setExecutionResult(res);

      toast.success(
        'Importación completada',
        `Procesados: ${res.total_processed} | Creados: ${res.created_count} | Actualizados: ${res.updated_count} | Omitidos: ${res.skipped_count}`
      );
    } catch (err: unknown) {
      toast.error(
        'Fallo en la importación masiva',
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Configuration & Input Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Ingesta Masiva de Usuarios (Batch Ingestion)</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Importación por lotes mediante CSV o JSON con validación previa y resolución de conflictos
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={handleLoadDemo} className="btn btn-secondary" style={{ fontSize: '0.75rem' }}>
              <Sparkles size={14} color="#f59e0b" />
              <span>Cargar Plantilla Demo</span>
            </button>

            <label className="btn btn-secondary" style={{ fontSize: '0.75rem', cursor: 'pointer', margin: 0 }}>
              <Upload size={14} />
              <span>Subir Archivo</span>
              <input type="file" accept=".csv,.json,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Import Settings Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            padding: '0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-01dp)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Format */}
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Formato</label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setInputFormat('csv')}
                className={`btn ${inputFormat === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setInputFormat('json')}
                className={`btn ${inputFormat === 'json' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
              >
                JSON
              </button>
            </div>
          </div>

          {/* Delimiter if CSV */}
          {inputFormat === 'csv' && (
            <div>
              <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Delimitador</label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value as any)}
                className="form-select"
                style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
              >
                <option value=",">Coma (,)</option>
                <option value=";">Punto y coma (;)</option>
                <option value="&#9;">Tabulador (\t)</option>
              </select>
            </div>
          )}

          {/* Conflict Resolution */}
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Si el usuario ya existe</label>
            <select
              value={conflictResolution}
              onChange={(e) => setConflictResolution(e.target.value as ConflictResolution)}
              className="form-select"
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
            >
              <option value="skip">Omitir duplicados (Skip)</option>
              <option value="overwrite">Sobrescribir existentes (Overwrite)</option>
            </select>
          </div>

          {/* Default Profile */}
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Perfil RBAC por Defecto</label>
            <select
              value={defaultProfileId}
              onChange={(e) => setDefaultProfileId(e.target.value)}
              className="form-select"
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
            >
              <option value="00000000-0000-0000-0000-000000000012">Self-Service (Usuario)</option>
              <option value="00000000-0000-0000-0000-000000000011">Technician (Técnico)</option>
              <option value="00000000-0000-0000-0000-000000000010">Super-Admin</option>
              <option value="00000000-0000-0000-0000-000000000013">Observer</option>
            </select>
          </div>

          {/* Default Group */}
          <div>
            <label className="form-label" style={{ fontSize: '0.7rem', fontWeight: 600 }}>Grupo por Defecto (Opcional)</label>
            <select
              value={defaultGroupId}
              onChange={(e) => setDefaultGroupId(e.target.value)}
              className="form-select"
              style={{ width: '100%', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
            >
              <option value="">Sin grupo asignado</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text Area */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>
              Contenido en Bruto ({inputFormat.toUpperCase()})
            </label>
            {rawText && (
              <button
                onClick={() => setRawText('')}
                className="btn-icon"
                title="Limpiar"
                style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              inputFormat === 'csv'
                ? 'username,email,firstname,realname,profile_name,group_name\njuan,juan@empresa.com,Juan,Perez,Technician,Soporte Nivel 1'
                : '[\n  { "username": "juan", "email": "juan@empresa.com", "firstname": "Juan" }\n]'
            }
            className="form-textarea"
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
          />
        </div>

        {parsingError && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={16} />
            <span>{parsingError}</span>
          </div>
        )}
      </div>

      {/* Preview & Execution Section */}
      {parsedRows.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                {parsedRows.length} {parsedRows.length === 1 ? 'fila detectada' : 'filas detectadas'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Previsualización previa a la ejecución en base de datos
              </span>
            </div>

            <button
              onClick={handleExecuteImport}
              disabled={isExecuting}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1rem' }}
            >
              <Play size={15} />
              <span>{isExecuting ? 'Procesando lote...' : `Ejecutar Importación (${parsedRows.length})`}</span>
            </button>
          </div>

          {/* Table Preview */}
          <div style={{ overflowX: 'auto', maxHeight: 280 }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Nombre Completo</th>
                  <th>Perfil Solicitado</th>
                  <th>Grupo Asignado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => {
                  const isValid = row.username && row.email && row.email.includes('@');
                  return (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td>
                        <strong>@{row.username || '—'}</strong>
                      </td>
                      <td>{row.email || '—'}</td>
                      <td>{row.firstname || row.realname ? `${row.firstname || ''} ${row.realname || ''}`.trim() : '—'}</td>
                      <td>{row.profile_name || 'Por defecto'}</td>
                      <td>
                        {row.group_name ? (
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            {row.group_name}
                          </span>
                        ) : defaultGroupId ? (
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                            {availableGroups.find((g) => g.id === defaultGroupId)?.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {isValid ? (
                          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> Válido
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={12} /> Inválido
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Execution Results Summary */}
      {executionResult && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Resumen de Importación</h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total procesados: {executionResult.total_processed}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(52, 211, 153, 0.12)', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#34d399' }}>{executionResult.created_count}</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Creados</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(56, 189, 248, 0.12)', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>{executionResult.updated_count}</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Actualizados</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(251, 191, 36, 0.12)', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fbbf24' }}>{executionResult.skipped_count}</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Omitidos</p>
            </div>
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>{executionResult.failed_count}</span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Fallidos</p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Resultado</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {executionResult.results.map((r, i) => (
                  <tr key={i}>
                    <td><strong>@{r.username}</strong></td>
                    <td>{r.email}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.65rem',
                          background:
                            r.status === 'created'
                              ? 'rgba(52, 211, 153, 0.15)'
                              : r.status === 'updated'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : r.status === 'skipped'
                              ? 'rgba(251, 191, 36, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            r.status === 'created'
                              ? '#34d399'
                              : r.status === 'updated'
                              ? '#38bdf8'
                              : r.status === 'skipped'
                              ? '#fbbf24'
                              : '#ef4444',
                        }}
                      >
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
