import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  Edit2,
  Zap,
  Play,
  X,
  CalendarDays,
  Timer,
} from 'lucide-react';
import {
  fetchSlas,
  createSla,
  updateSla,
  deleteSla,
  fetchSlaLevels,
  createSlaLevel,
  updateSlaLevel,
  deleteSlaLevel,
  fetchCalendars,
  fetchCalendarById,
  saveCalendarSegments,
  addCalendarHoliday,
  deleteCalendarHoliday,
  simulateSlaDeadlines,
  fetchGroups,
  fetchUsers,
} from '../../services/api';
import type {
  SlaSummary,
  SlaLevel,
  Calendar,
  CalendarDetail,
  CalendarSegment,
  GroupSummary,
  UserSummary,
  EscalationActionType,
  SlaSimulationResponse,
} from '../../types';
import { useToast } from '../../context/ToastContext';

export const SLAsManagementView: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'slas' | 'escalations' | 'calendars'>('slas');

  // Data states
  const [slas, setSlas] = useState<SlaSummary[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isSlaModalOpen, setIsSlaModalOpen] = useState(false);
  const [editingSla, setEditingSla] = useState<SlaSummary | null>(null);

  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState(false);
  const [editingEscalation, setEditingEscalation] = useState<SlaLevel | null>(null);
  const [selectedSlaForEscalation, setSelectedSlaForEscalation] = useState<string>('');

  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [selectedCalendarDetail, setSelectedCalendarDetail] = useState<CalendarDetail | null>(null);

  // SLA Form State
  const [slaName, setSlaName] = useState('');
  const [slaDescription, setSlaDescription] = useState('');
  const [slaCalendarId, setSlaCalendarId] = useState<string>('');
  const [slaTtoMinutes, setSlaTtoMinutes] = useState(60);
  const [slaTtrMinutes, setSlaTtrMinutes] = useState(480);
  const [slaPriorityOverride, setSlaPriorityOverride] = useState<number | ''>('');
  const [slaIsActive, setSlaIsActive] = useState(true);

  // Escalation Form State
  const [escName, setEscName] = useState('');
  const [escTargetType, setEscTargetType] = useState<'tto' | 'ttr'>('ttr');
  const [escOffsetMinutes, setEscOffsetMinutes] = useState(-30);
  const [escActionType, setEscActionType] = useState<EscalationActionType>('send_alert');
  const [escActionValue, setEscActionValue] = useState('');

  // Weekly Schedule Editor State
  const [scheduleSegments, setScheduleSegments] = useState<
    Array<{ day_of_week: number; enabled: boolean; start_time: string; end_time: string }>
  >([
    { day_of_week: 1, enabled: true, start_time: '08:00', end_time: '18:00' },
    { day_of_week: 2, enabled: true, start_time: '08:00', end_time: '18:00' },
    { day_of_week: 3, enabled: true, start_time: '08:00', end_time: '18:00' },
    { day_of_week: 4, enabled: true, start_time: '08:00', end_time: '18:00' },
    { day_of_week: 5, enabled: true, start_time: '08:00', end_time: '18:00' },
    { day_of_week: 6, enabled: false, start_time: '08:00', end_time: '13:00' },
    { day_of_week: 7, enabled: false, start_time: '08:00', end_time: '13:00' },
  ]);

  // Holiday Form State
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');

  // Simulator State
  const [simDuration, setSimDuration] = useState(240); // 4h
  const [simCalendarId, setSimCalendarId] = useState<string>('');
  const [simResult, setSimResult] = useState<SlaSimulationResponse | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Escalations list for tab 2
  const [slaEscalations, setSlaEscalations] = useState<SlaLevel[]>([]);

  // Load initial data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [slasData, calendarsData, grpsData, usersData] = await Promise.all([
        fetchSlas(),
        fetchCalendars(),
        fetchGroups(),
        fetchUsers(),
      ]);
      setSlas(slasData);
      setCalendars(calendarsData);
      setGroups(grpsData.filter((g) => g.is_task));
      setTechnicians(usersData.filter((u) => u.profile_name === 'Technician' || u.profile_name === 'Super-Admin'));

      if (calendarsData.length > 0) {
        setSelectedCalendarId(calendarsData[0].id);
        setSimCalendarId(calendarsData[0].id);
      }
      if (slasData.length > 0) {
        setSelectedSlaForEscalation(slasData[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar Acuerdos SLA';
      toast.error('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // When selected calendar changes, fetch detail
  useEffect(() => {
    if (!selectedCalendarId) return;
    fetchCalendarById(selectedCalendarId)
      .then((detail) => {
        setSelectedCalendarDetail(detail);
        // Build schedule segments
        const daysMap: Record<number, CalendarSegment> = {};
        for (const s of detail.segments) {
          daysMap[s.day_of_week] = s;
        }

        const newSchedule = [1, 2, 3, 4, 5, 6, 7].map((day) => {
          const seg = daysMap[day];
          return {
            day_of_week: day,
            enabled: !!seg,
            start_time: seg ? seg.start_time.substring(0, 5) : '08:00',
            end_time: seg ? seg.end_time.substring(0, 5) : '18:00',
          };
        });
        setScheduleSegments(newSchedule);
      })
      .catch(() => {});
  }, [selectedCalendarId]);

  // When selected SLA for escalations changes, fetch levels
  useEffect(() => {
    if (!selectedSlaForEscalation) return;
    fetchSlaLevels(selectedSlaForEscalation)
      .then((levels) => setSlaEscalations(levels))
      .catch(() => setSlaEscalations([]));
  }, [selectedSlaForEscalation]);

  // Filtered SLAs
  const filteredSlas = useMemo(() => {
    if (!searchQuery.trim()) return slas;
    const q = searchQuery.toLowerCase().trim();
    return slas.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.calendar_name && s.calendar_name.toLowerCase().includes(q))
    );
  }, [slas, searchQuery]);

  // Handlers for SLAs
  const handleOpenSlaModal = (sla?: SlaSummary) => {
    if (sla) {
      setEditingSla(sla);
      setSlaName(sla.name);
      setSlaDescription(sla.description || '');
      setSlaCalendarId(sla.calendar_id || '');
      setSlaTtoMinutes(sla.tto_duration_minutes);
      setSlaTtrMinutes(sla.ttr_duration_minutes);
      setSlaPriorityOverride(sla.priority_override ?? '');
      setSlaIsActive(sla.is_active);
    } else {
      setEditingSla(null);
      setSlaName('');
      setSlaDescription('');
      setSlaCalendarId(calendars[0]?.id || '');
      setSlaTtoMinutes(60);
      setSlaTtrMinutes(480);
      setSlaPriorityOverride('');
      setSlaIsActive(true);
    }
    setIsSlaModalOpen(true);
  };

  const handleSaveSla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slaName.trim()) {
      toast.error('Campo Requerido', 'El nombre del SLA no puede estar vacío');
      return;
    }

    try {
      const payload = {
        name: slaName.trim(),
        description: slaDescription.trim() || undefined,
        calendar_id: slaCalendarId || null,
        tto_duration_minutes: Number(slaTtoMinutes),
        ttr_duration_minutes: Number(slaTtrMinutes),
        priority_override: slaPriorityOverride ? Number(slaPriorityOverride) : null,
        is_active: slaIsActive,
      };

      if (editingSla) {
        await updateSla(editingSla.id, payload);
        toast.success('SLA Actualizado', `Perfil "${payload.name}" guardado exitosamente.`);
      } else {
        await createSla(payload);
        toast.success('SLA Creado', `Nuevo perfil "${payload.name}" registrado exitosamente.`);
      }
      setIsSlaModalOpen(false);
      const updatedList = await fetchSlas();
      setSlas(updatedList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar SLA';
      toast.error('Error', msg);
    }
  };

  const handleDeleteSla = async (id: string, name: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar el acuerdo SLA "${name}"?`)) return;
    try {
      await deleteSla(id);
      toast.success('SLA Eliminado', `El perfil "${name}" ha sido eliminado.`);
      setSlas((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar SLA';
      toast.error('Error', msg);
    }
  };

  // Handlers for Escalation Levels
  const handleOpenEscalationModal = (level?: SlaLevel) => {
    if (level) {
      setEditingEscalation(level);
      setEscName(level.name);
      setEscTargetType(level.target_type);
      setEscOffsetMinutes(level.execution_offset_minutes);
      setEscActionType(level.action_type);
      setEscActionValue(level.action_value);
    } else {
      setEditingEscalation(null);
      setEscName('');
      setEscTargetType('ttr');
      setEscOffsetMinutes(-30);
      setEscActionType('send_alert');
      setEscActionValue('supervisor');
    }
    setIsEscalationModalOpen(true);
  };

  const handleSaveEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escName.trim()) {
      toast.error('Campo Requerido', 'El nombre de la regla de escalamiento no puede estar vacío');
      return;
    }
    if (!selectedSlaForEscalation) {
      toast.error('SLA no seleccionado', 'Seleccione un SLA para asociar la regla');
      return;
    }

    try {
      const payload = {
        name: escName.trim(),
        target_type: escTargetType,
        execution_offset_minutes: Number(escOffsetMinutes),
        action_type: escActionType,
        action_value: escActionValue.trim() || 'supervisor',
      };

      if (editingEscalation) {
        await updateSlaLevel(selectedSlaForEscalation, editingEscalation.id, payload);
        toast.success('Regla Actualizada', `Regla "${payload.name}" guardada.`);
      } else {
        await createSlaLevel(selectedSlaForEscalation, payload);
        toast.success('Regla Creada', `Regla de escalamiento "${payload.name}" agregada.`);
      }
      setIsEscalationModalOpen(false);
      const levels = await fetchSlaLevels(selectedSlaForEscalation);
      setSlaEscalations(levels);
      // Refresh SLA count
      const updatedSlas = await fetchSlas();
      setSlas(updatedSlas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar regla';
      toast.error('Error', msg);
    }
  };

  const handleDeleteEscalation = async (levelId: string, name: string) => {
    if (!window.confirm(`¿Eliminar regla de escalamiento "${name}"?`)) return;
    try {
      await deleteSlaLevel(selectedSlaForEscalation, levelId);
      toast.success('Regla Eliminada', `Regla "${name}" removida del SLA.`);
      setSlaEscalations((prev) => prev.filter((l) => l.id !== levelId));
      const updatedSlas = await fetchSlas();
      setSlas(updatedSlas);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar regla';
      toast.error('Error', msg);
    }
  };

  // Handlers for Calendars & Schedule
  const handleSaveSchedule = async () => {
    if (!selectedCalendarId) return;
    try {
      const activeSegs = scheduleSegments
        .filter((s) => s.enabled)
        .map((s) => ({
          day_of_week: s.day_of_week,
          start_time: `${s.start_time}:00`,
          end_time: `${s.end_time}:00`,
        }));

      await saveCalendarSegments(selectedCalendarId, activeSegs);
      toast.success('Horario Guardado', 'Franjas horarias de jornada laboral actualizadas.');
      const detail = await fetchCalendarById(selectedCalendarId);
      setSelectedCalendarDetail(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar franjas';
      toast.error('Error', msg);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayDate) {
      toast.error('Campos requeridos', 'Ingrese nombre y fecha del feriado/festivo.');
      return;
    }
    try {
      await addCalendarHoliday(selectedCalendarId, {
        name: holidayName.trim(),
        holiday_date: holidayDate,
      });
      toast.success('Feriado Añadido', `Día "${holidayName}" agregado al calendario.`);
      setHolidayName('');
      setHolidayDate('');
      const detail = await fetchCalendarById(selectedCalendarId);
      setSelectedCalendarDetail(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al agregar feriado';
      toast.error('Error', msg);
    }
  };

  const handleDeleteHoliday = async (holidayId: string, name: string) => {
    try {
      await deleteCalendarHoliday(selectedCalendarId, holidayId);
      toast.success('Feriado Removido', `Día "${name}" eliminado.`);
      const detail = await fetchCalendarById(selectedCalendarId);
      setSelectedCalendarDetail(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar feriado';
      toast.error('Error', msg);
    }
  };

  // Simulator
  const handleRunSimulation = async () => {
    setSimulating(true);
    try {
      const res = await simulateSlaDeadlines({
        calendar_id: simCalendarId || undefined,
        duration_minutes: simDuration,
      });
      setSimResult(res);
      toast.success('Simulación Completada', 'Plazo proyectado calculado exitosamente.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error en simulación';
      toast.error('Error', msg);
    } finally {
      setSimulating(false);
    }
  };

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} horas`;
  };

  const getDayName = (d: number) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days[d - 1] || `Día ${d}`;
  };

  return (
    <div className="users-management-view" style={{ animation: 'fadeIn 0.2s ease-in' }}>
      {/* View Header */}
      <div className="users-header">
        <div className="users-title-block">
          <div className="users-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
            <Clock size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2>Acuerdos de Nivel de Servicio (SLA) & Matrices de Escalamiento</h2>
              <span className="badge badge-primary" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                ITIL v0.0.7
              </span>
            </div>
            <p className="users-subtitle">
              Gestión de tiempos objetivos TTO / TTR, calendarios laborales y acciones automáticas de escalamiento
            </p>
          </div>
        </div>

        <div className="users-header-actions">
          {activeTab === 'slas' && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: 38 }}
              onClick={() => handleOpenSlaModal()}
            >
              <Plus size={16} />
              <span>Nuevo Perfil SLA</span>
            </button>
          )}
          {activeTab === 'escalations' && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: 38 }}
              onClick={() => handleOpenEscalationModal()}
            >
              <Plus size={16} />
              <span>Nueva Regla de Escalamiento</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="users-tabs-bar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('slas')}
          className={`users-tab-btn ${activeTab === 'slas' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
        >
          <ShieldCheck size={17} />
          <span>Perfiles de SLA</span>
          <span className="badge" style={{ background: 'var(--bg-card)', fontSize: '0.72rem' }}>
            {slas.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('escalations')}
          className={`users-tab-btn ${activeTab === 'escalations' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
        >
          <Zap size={17} />
          <span>Matriz de Escalamiento</span>
          <span className="badge" style={{ background: 'var(--bg-card)', fontSize: '0.72rem' }}>
            {slaEscalations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendars')}
          className={`users-tab-btn ${activeTab === 'calendars' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
        >
          <CalendarDays size={17} />
          <span>Calendarios Laborales</span>
          <span className="badge" style={{ background: 'var(--bg-card)', fontSize: '0.72rem' }}>
            {calendars.length}
          </span>
        </button>
      </div>

      {loading && (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando configuración de acuerdos de nivel de servicio (SLA)...
        </div>
      )}

      {/* TAB 1: SLA Profiles */}
      {!loading && activeTab === 'slas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Metrics Bar */}
          <div className="users-metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8' }}>
                <ShieldCheck size={20} />
              </div>
              <div className="metric-info">
                <span className="metric-label">SLAs Activos</span>
                <span className="metric-value">{slas.filter((s) => s.is_active).length}</span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
                <Timer size={20} />
              </div>
              <div className="metric-info">
                <span className="metric-label">TTO Promedio</span>
                <span className="metric-value">
                  {slas.length > 0
                    ? formatMinutes(Math.round(slas.reduce((acc, s) => acc + s.tto_duration_minutes, 0) / slas.length))
                    : '—'}
                </span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
                <Clock size={20} />
              </div>
              <div className="metric-info">
                <span className="metric-label">TTR Promedio</span>
                <span className="metric-value">
                  {slas.length > 0
                    ? formatMinutes(Math.round(slas.reduce((acc, s) => acc + s.ttr_duration_minutes, 0) / slas.length))
                    : '—'}
                </span>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
                <Zap size={20} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Reglas Escalamiento</span>
                <span className="metric-value">
                  {slas.reduce((acc, s) => acc + Number(s.escalation_levels_count || 0), 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="users-toolbar">
            <div className="search-input-wrapper" style={{ maxWidth: '400px', width: '100%' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por nombre, descripción o calendario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
            </div>
          </div>

          {/* SLA Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
            {filteredSlas.map((sla) => (
              <div
                key={sla.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  position: 'relative',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {sla.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                      <CalendarDays size={13} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {sla.calendar_name || 'Sin calendario (24/7 continuo)'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`status-pill ${sla.is_active ? 'status-assigned' : 'status-closed'}`}
                    style={{ fontSize: '0.72rem' }}
                  >
                    {sla.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {sla.description && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                    {sla.description}
                  </p>
                )}

                {/* TTO & TTR Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      TTO (Toma en Cuenta)
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                      {formatMinutes(sla.tto_duration_minutes)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      TTR (Resolución)
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981', marginTop: '0.2rem' }}>
                      {formatMinutes(sla.ttr_duration_minutes)}
                    </div>
                  </div>
                </div>

                {/* Footer Metadata & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {sla.priority_override ? (
                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', fontSize: '0.7rem' }}>
                        P{sla.priority_override} Sugerido
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        General
                      </span>
                    )}

                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      ⚡ {sla.escalation_levels_count} reglas
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ padding: '0.35rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      onClick={() => handleOpenSlaModal(sla)}
                      title="Editar SLA"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ padding: '0.35rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      onClick={() => handleDeleteSla(sla.id, sla.name)}
                      title="Eliminar SLA"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Escalation Matrix */}
      {activeTab === 'escalations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* SLA Filter Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Acuerdo SLA a Configurar:
            </span>
            <select
              className="form-select"
              style={{ maxWidth: '320px', height: '36px' }}
              value={selectedSlaForEscalation}
              onChange={(e) => setSelectedSlaForEscalation(e.target.value)}
            >
              {slas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.escalation_levels_count} reglas)
                </option>
              ))}
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Acciones automáticas ejecutadas de forma idempotente por el motor en segundo plano
              </span>
            </div>
          </div>

          {/* Timeline Rules Grid */}
          {slaEscalations.length === 0 ? (
            <div className="empty-state-box" style={{ padding: '3rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
              <Zap size={36} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>Sin Reglas de Escalamiento</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                Este perfil de SLA aún no cuenta con disparadores automáticos de pre-aviso, vencimiento o reasignación.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleOpenEscalationModal()}
              >
                <Plus size={16} /> Crear Primera Regla
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {slaEscalations.map((level) => {
                const isWarning = level.execution_offset_minutes < 0;
                const isOnBreach = level.execution_offset_minutes === 0;
                const isPostBreach = level.execution_offset_minutes > 0;

                return (
                  <div
                    key={level.id}
                    className="card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      padding: '1rem 1.25rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    {/* Offset Badge */}
                    <div style={{ minWidth: '150px' }}>
                      {isWarning && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '0.35rem 0.65rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <AlertTriangle size={12} />
                          {Math.abs(level.execution_offset_minutes)} min antes
                        </span>
                      )}
                      {isOnBreach && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            padding: '0.35rem 0.65rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <Clock size={12} />
                          Al Vencer (0m)
                        </span>
                      )}
                      {isPostBreach && (
                        <span
                          className="badge"
                          style={{
                            background: 'rgba(168, 85, 247, 0.12)',
                            color: '#a855f7',
                            border: '1px solid rgba(168, 85, 247, 0.25)',
                            padding: '0.35rem 0.65rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          <Zap size={12} />
                          +{level.execution_offset_minutes} min post
                        </span>
                      )}
                    </div>

                    {/* Rule Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {level.name}
                        </strong>
                        <span className="badge" style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.06)' }}>
                          Objetivo: {level.target_type.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Acción: {level.action_type === 'escalate_priority' && 'Elevar Prioridad'}
                        {level.action_type === 'reassign_group' && 'Reasignar Grupo Transversal'}
                        {level.action_type === 'reassign_technician' && 'Reasignar Técnico'}
                        {level.action_type === 'send_alert' && 'Enviar Alerta por Correo'}
                        {' → '}
                        <strong style={{ color: 'var(--text-secondary)' }}>
                          {level.action_value}
                        </strong>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        onClick={() => handleOpenEscalationModal(level)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ padding: '0.4rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        onClick={() => handleDeleteEscalation(level.id, level.name)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Business Calendars & Simulator */}
      {activeTab === 'calendars' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
          {/* Left: Schedule Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Franjas Horarias Semanales
                </h3>

                <select
                  className="form-select"
                  style={{ maxWidth: '280px', height: '36px' }}
                  value={selectedCalendarId}
                  onChange={(e) => setSelectedCalendarId(e.target.value)}
                >
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.is_default ? '(Predeterminado)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day segments table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {scheduleSegments.map((seg, idx) => (
                  <div
                    key={seg.day_of_week}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: seg.enabled ? 'rgba(56, 189, 248, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '130px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={seg.enabled}
                        onChange={(e) => {
                          const updated = [...scheduleSegments];
                          updated[idx].enabled = e.target.checked;
                          setScheduleSegments(updated);
                        }}
                      />
                      <strong style={{ fontSize: '0.85rem', color: seg.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {getDayName(seg.day_of_week)}
                      </strong>
                    </label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: seg.enabled ? 1 : 0.4 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Desde:</span>
                      <input
                        type="time"
                        className="form-input"
                        style={{ width: '110px', height: '32px' }}
                        value={seg.start_time}
                        disabled={!seg.enabled}
                        onChange={(e) => {
                          const updated = [...scheduleSegments];
                          updated[idx].start_time = e.target.value;
                          setScheduleSegments(updated);
                        }}
                      />

                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hasta:</span>
                      <input
                        type="time"
                        className="form-input"
                        style={{ width: '110px', height: '32px' }}
                        value={seg.end_time}
                        disabled={!seg.enabled}
                        onChange={(e) => {
                          const updated = [...scheduleSegments];
                          updated[idx].end_time = e.target.value;
                          setScheduleSegments(updated);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSchedule}
                >
                  Guardar Horario Laboral
                </button>
              </div>
            </div>

            {/* Holiday Exceptions */}
            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
                Feriados y Días No Laborables
              </h3>

              <form onSubmit={handleAddHoliday} style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="Descripción (ej. Feriado Nacional)"
                  className="form-input"
                  style={{ flex: 1, height: '36px' }}
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                />
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '160px', height: '36px' }}
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary" style={{ height: '36px' }}>
                  <Plus size={15} /> Añadir
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                {selectedCalendarDetail?.holidays && selectedCalendarDetail.holidays.length > 0 ? (
                  selectedCalendarDetail.holidays.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{h.name}</strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({h.holiday_date})
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleDeleteHoliday(h.id, h.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No se han registrado días feriados para este calendario.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live SLA Deadline Simulator */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              className="card"
              style={{
                padding: '1.25rem',
                background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Timer size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Simulador de Plazos Laborales
                </h3>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.45 }}>
                Verifica de forma interactiva cómo el motor de cálculo computa vencimientos respetando franjas laborales y festivos.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label className="form-label">Calendario de Referencia</label>
                  <select
                    className="form-select"
                    value={simCalendarId}
                    onChange={(e) => setSimCalendarId(e.target.value)}
                  >
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Duración Objetivo Comprometida</label>
                  <select
                    className="form-select"
                    value={simDuration}
                    onChange={(e) => setSimDuration(Number(e.target.value))}
                  >
                    <option value={15}>15 minutos (Crítico TTO)</option>
                    <option value={30}>30 minutos (Alta Prioridad TTO)</option>
                    <option value={120}>2 horas (TTR P5)</option>
                    <option value={240}>4 horas (TTR P4)</option>
                    <option value={480}>8 horas laborales (1 jornada completa)</option>
                    <option value={1440}>24 horas laborales (2.4 días hábiles)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  onClick={handleRunSimulation}
                  disabled={simulating}
                >
                  <Play size={16} />
                  <span>{simulating ? 'Calculando...' : 'Calcular Vencimiento'}</span>
                </button>
              </div>

              {simResult && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#10b981', fontWeight: 700 }}>
                    Resultado del Cálculo
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    {new Date(simResult.target_time).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Días hábiles transcurridos: <strong>{simResult.working_days_elapsed} día(s)</strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit SLA */}
      {isSlaModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingSla ? 'Editar Acuerdo SLA' : 'Nuevo Acuerdo SLA'}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsSlaModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSla}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Nombre del SLA *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={slaName}
                    onChange={(e) => setSlaName(e.target.value)}
                    placeholder="ej. SLA Platino - Incidentes Críticos"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={slaDescription}
                    onChange={(e) => setSlaDescription(e.target.value)}
                    placeholder="Alcance y compromisos del acuerdo de nivel..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Calendario Laboral Asociado</label>
                  <select
                    className="form-select"
                    value={slaCalendarId}
                    onChange={(e) => setSlaCalendarId(e.target.value)}
                  >
                    <option value="">Sin Calendario (24/7 Continuo)</option>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.is_default ? '(Predeterminado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">TTO (Toma en Cuenta - min) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="form-input"
                      value={slaTtoMinutes}
                      onChange={(e) => setSlaTtoMinutes(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">TTR (Resolución - min) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="form-input"
                      value={slaTtrMinutes}
                      onChange={(e) => setSlaTtrMinutes(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Prioridad Sugerida (Opcional)</label>
                  <select
                    className="form-select"
                    value={slaPriorityOverride}
                    onChange={(e) => setSlaPriorityOverride(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Cualquiera / Sin asignación fija</option>
                    <option value={5}>P5 - Crítico</option>
                    <option value={4}>P4 - Alto</option>
                    <option value={3}>P3 - Medio</option>
                    <option value={2}>P2 - Bajo</option>
                    <option value={1}>P1 - Muy Bajo</option>
                  </select>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={slaIsActive}
                    onChange={(e) => setSlaIsActive(e.target.checked)}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Perfil SLA Activo</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSlaModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSla ? 'Guardar Cambios' : 'Crear Perfil SLA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Escalation Rule */}
      {isEscalationModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingEscalation ? 'Editar Regla' : 'Nueva Regla de Escalamiento'}</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setIsEscalationModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEscalation}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Nombre de la Regla *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={escName}
                    onChange={(e) => setEscName(e.target.value)}
                    placeholder="ej. Alerta Previa TTR 30m"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Objetivo Evaluado</label>
                    <select
                      className="form-select"
                      value={escTargetType}
                      onChange={(e) => setEscTargetType(e.target.value as 'tto' | 'ttr')}
                    >
                      <option value="ttr">TTR (Tiempo de Resolución)</option>
                      <option value="tto">TTO (Tiempo de Toma)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Disparo (Offset en min) *</label>
                    <input
                      type="number"
                      required
                      className="form-input"
                      value={escOffsetMinutes}
                      onChange={(e) => setEscOffsetMinutes(Number(e.target.value))}
                      placeholder="-30 = 30m antes, 0 = al vencer"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Acción a Ejecutar Automáticamente</label>
                  <select
                    className="form-select"
                    value={escActionType}
                    onChange={(e) => {
                      const at = e.target.value as EscalationActionType;
                      setEscActionType(at);
                      if (at === 'escalate_priority') setEscActionValue('5');
                      else if (at === 'reassign_group' && groups[0]) setEscActionValue(groups[0].id);
                      else if (at === 'reassign_technician' && technicians[0]) setEscActionValue(technicians[0].id);
                      else setEscActionValue('supervisor');
                    }}
                  >
                    <option value="send_alert">Enviar Alerta por Correo</option>
                    <option value="escalate_priority">Elevar Nivel de Prioridad</option>
                    <option value="reassign_group">Reasignar a Grupo Transversal</option>
                    <option value="reassign_technician">Reasignar a Técnico Supervisor</option>
                  </select>
                </div>

                {escActionType === 'escalate_priority' && (
                  <div className="form-group">
                    <label className="form-label">Nueva Prioridad Objetivo</label>
                    <select
                      className="form-select"
                      value={escActionValue}
                      onChange={(e) => setEscActionValue(e.target.value)}
                    >
                      <option value="5">P5 - Crítica / Mayor</option>
                      <option value="4">P4 - Alta</option>
                      <option value="3">P3 - Media</option>
                    </select>
                  </div>
                )}

                {escActionType === 'reassign_group' && (
                  <div className="form-group">
                    <label className="form-label">Grupo Transversal Destino</label>
                    <select
                      className="form-select"
                      value={escActionValue}
                      onChange={(e) => setEscActionValue(e.target.value)}
                    >
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {escActionType === 'reassign_technician' && (
                  <div className="form-group">
                    <label className="form-label">Técnico Destino</label>
                    <select
                      className="form-select"
                      value={escActionValue}
                      onChange={(e) => setEscActionValue(e.target.value)}
                    >
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.display_name} ({t.username})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {escActionType === 'send_alert' && (
                  <div className="form-group">
                    <label className="form-label">Destinatario de Notificación</label>
                    <select
                      className="form-select"
                      value={escActionValue}
                      onChange={(e) => setEscActionValue(e.target.value)}
                    >
                      <option value="supervisor">Supervisor y Técnico Asignado</option>
                      <option value="all_members">Todos los miembros del Grupo</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEscalationModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEscalation ? 'Guardar Regla' : 'Crear Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
