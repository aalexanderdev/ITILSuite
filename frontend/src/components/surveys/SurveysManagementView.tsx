import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  LayoutTemplate,
  Sliders,
  Smartphone,
  Monitor,
  KeyRound,
  BarChart3,
  Plus,
  Copy,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  Star,
  ChevronUp,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Share2,
  X,
} from 'lucide-react';
import {
  fetchSurveys,
  fetchSurveyDetail,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  cloneSurvey,
  fetchSurveyPresets,
  fetchSurveyDashboardMetrics,
  createSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  reorderSurveyQuestions,
  fetchSurveyTokens,
  generateSurveyToken,
  fetchEntities,
} from '../../services/api';
import type {
  SurveySummary,
  SurveyDetail,
  SurveyPresetDef,
  SurveyDashboardMetrics,
  SurveyToken,
  SurveyQuestion,
  SurveyQuestionType,
  CreateSurveyPayload,
  CreateQuestionPayload,
} from '../../types';
import { useToast } from '../../context/ToastContext';
import { PublicSurveyView } from './PublicSurveyView';
import './surveys.css';

type ActiveTab = 'presets' | 'builder' | 'designer' | 'preview' | 'tokens' | 'analytics';

export const SurveysManagementView: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('builder');

  // Core data states
  const [surveys, setSurveys] = useState<SurveySummary[]>([]);
  const [presets, setPresets] = useState<SurveyPresetDef[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyDetail | null>(null);
  const [metrics, setMetrics] = useState<SurveyDashboardMetrics | null>(null);
  const [tokens, setTokens] = useState<SurveyToken[]>([]);
  const [entities, setEntities] = useState<any[]>([]);

  // Preview options
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'smartphone'>('smartphone');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPresetForCreation, setSelectedPresetForCreation] = useState<SurveyPresetDef | null>(null);
  const [newSurveyName, setNewSurveyName] = useState('');
  const [newSurveyEntityId, setNewSurveyEntityId] = useState<string>('');

  // Question Modal
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [qName, setQName] = useState('');
  const [qType, setQType] = useState<SurveyQuestionType>('rating5');
  const [qMandatory, setQMandatory] = useState(true);
  const [qCondQuestionId, setQCondQuestionId] = useState<string>('');
  const [qCondValue, setQCondValue] = useState<string>('');
  const [qOptionsText, setQOptionsText] = useState<string>('');

  // Manual Token Modal
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tokenSurveyId, setTokenSurveyId] = useState<string>('');
  const [tokenRequesterEmail, setTokenRequesterEmail] = useState('');

  // Copy feedback
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // Load initial datasets
  const loadSurveys = async () => {
    try {
      const data = await fetchSurveys();
      setSurveys(data);
      if (data.length > 0 && !selectedSurvey) {
        const detail = await fetchSurveyDetail(data[0].id);
        setSelectedSurvey(detail);
      }
    } catch (err: any) {
      toast.error('Error al cargar encuestas', err.message);
    }
  };

  const loadPresets = async () => {
    try {
      const data = await fetchSurveyPresets();
      setPresets(data);
    } catch {
      // ignore
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await fetchSurveyDashboardMetrics(selectedSurvey?.id);
      setMetrics(data);
    } catch {
      // ignore
    }
  };

  const loadTokens = async () => {
    try {
      const data = await fetchSurveyTokens({ limit: 50 });
      setTokens(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    Promise.all([loadSurveys(), loadPresets(), loadTokens(), fetchEntities()]).then(
      ([_, __, ___, ents]) => {
        setEntities(ents || []);
      }
    );
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadMetrics();
    } else if (activeTab === 'tokens') {
      loadTokens();
    }
  }, [activeTab, selectedSurvey?.id]);

  // Select Survey for builder/designer/preview
  const handleSelectSurvey = async (id: string) => {
    try {
      const detail = await fetchSurveyDetail(id);
      setSelectedSurvey(detail);
    } catch (err: any) {
      toast.error('Error al cargar encuesta', err.message);
    }
  };

  // Instantiating survey from Preset or Blank
  const handleOpenCreateModal = (preset?: SurveyPresetDef) => {
    setSelectedPresetForCreation(preset || null);
    setNewSurveyName(preset ? preset.name : 'Nueva Encuesta de Satisfacción');
    setNewSurveyEntityId('');
    setIsCreateModalOpen(true);
  };

  const handleCreateSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSurveyName.trim()) {
      toast.error('Nombre requerido', 'Ingrese un nombre para la encuesta');
      return;
    }

    try {
      const payload: CreateSurveyPayload = {
        name: newSurveyName.trim(),
        entity_id: newSurveyEntityId || null,
        template_preset: selectedPresetForCreation?.key,
        header_content: selectedPresetForCreation?.header,
        success_content: selectedPresetForCreation?.success,
        is_active: true,
        is_default: surveys.length === 0,
        ttl_days_override: 15,
        allow_reentry_override: 1,
      };

      const created = await createSurvey(payload);
      toast.success('Encuesta creada', `Se ha generado "${created.name}" exitosamente.`);
      setIsCreateModalOpen(false);
      await loadSurveys();
      setSelectedSurvey(created);
      setActiveTab('builder');
    } catch (err: any) {
      toast.error('Error al crear encuesta', err.message);
    }
  };

  // Deep clone survey
  const handleCloneSurvey = async (id: string, name: string) => {
    try {
      const cloned = await cloneSurvey(id, `${name} (Copia)`);
      toast.success('Encuesta duplicada', `Se clonó "${cloned.name}" con todas sus preguntas.`);
      await loadSurveys();
      setSelectedSurvey(cloned);
    } catch (err: any) {
      toast.error('Error al clonar', err.message);
    }
  };

  // Delete survey
  const handleDeleteSurvey = async (id: string, name: string) => {
    if (!window.confirm(`¿Está seguro de eliminar la encuesta "${name}" y todos sus datos asociados?`)) {
      return;
    }
    try {
      await deleteSurvey(id);
      toast.success('Encuesta eliminada', `"${name}" fue eliminada.`);
      if (selectedSurvey?.id === id) {
        setSelectedSurvey(null);
      }
      await loadSurveys();
    } catch (err: any) {
      toast.error('Error al eliminar', err.message);
    }
  };

  // Question Management
  const handleOpenQuestionModal = (q?: SurveyQuestion) => {
    if (q) {
      setEditingQuestion(q);
      setQName(q.name);
      setQType(q.question_type);
      setQMandatory(q.is_mandatory);
      setQCondQuestionId(q.condition_question_id || '');
      setQCondValue(q.condition_value || '');
      setQOptionsText(q.options.map((o) => o.value).join('\n'));
    } else {
      setEditingQuestion(null);
      setQName('');
      setQType('rating5');
      setQMandatory(true);
      setQCondQuestionId('');
      setQCondValue('');
      setQOptionsText('');
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurvey || !qName.trim()) {
      toast.error('Validación', 'El texto de la pregunta es obligatorio');
      return;
    }

    const options = ['choice_single', 'choice_multiple', 'dropdown'].includes(qType)
      ? qOptionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    try {
      if (editingQuestion) {
        await updateSurveyQuestion(editingQuestion.id, {
          name: qName.trim(),
          question_type: qType,
          is_mandatory: qMandatory,
          condition_question_id: qCondQuestionId || null,
          condition_value: qCondValue.trim() || null,
          options,
        });
        toast.success('Pregunta actualizada', 'Se guardaron los cambios.');
      } else {
        const payload: CreateQuestionPayload = {
          name: qName.trim(),
          question_type: qType,
          is_mandatory: qMandatory,
          condition_question_id: qCondQuestionId || null,
          condition_value: qCondValue.trim() || null,
          options,
        };
        await createSurveyQuestion(selectedSurvey.id, payload);
        toast.success('Pregunta agregada', 'Se añadió la pregunta a la encuesta.');
      }

      setIsQuestionModalOpen(false);
      const updated = await fetchSurveyDetail(selectedSurvey.id);
      setSelectedSurvey(updated);
      await loadSurveys();
    } catch (err: any) {
      toast.error('Error al guardar pregunta', err.message);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!selectedSurvey || !window.confirm('¿Eliminar esta pregunta?')) return;
    try {
      await deleteSurveyQuestion(qId);
      toast.success('Pregunta eliminada', 'Se removió la pregunta.');
      const updated = await fetchSurveyDetail(selectedSurvey.id);
      setSelectedSurvey(updated);
      await loadSurveys();
    } catch (err: any) {
      toast.error('Error al eliminar pregunta', err.message);
    }
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (!selectedSurvey) return;
    const questions = [...selectedSurvey.questions];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    // Swap
    const temp = questions[index];
    questions[index] = questions[targetIdx];
    questions[targetIdx] = temp;

    const ids = questions.map((q) => q.id);
    try {
      await reorderSurveyQuestions(selectedSurvey.id, ids);
      const updated = await fetchSurveyDetail(selectedSurvey.id);
      setSelectedSurvey(updated);
    } catch (err: any) {
      toast.error('Error al reordenar', err.message);
    }
  };

  // Copy Public URL
  const handleCopyUrl = (tokenStr: string, tokenId: string) => {
    const fullUrl = `${window.location.origin}/survey/${tokenStr}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedTokenId(tokenId);
    toast.success('Enlace copiado', 'URL de encuesta pública copiada al portapapeles');
    setTimeout(() => setCopiedTokenId(null), 2500);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (tokenStr: string, ticketNumber?: string | null) => {
    const fullUrl = `${window.location.origin}/survey/${tokenStr}`;
    const text = encodeURIComponent(
      `Hola! Nos gustaría conocer tu opinión sobre la atención brindada en el ticket #${
        ticketNumber || ''
      }. Por favor completa esta breve encuesta: ${fullUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Generate Manual Token
  const handleGenerateManualToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenSurveyId) {
      toast.error('Seleccione encuesta', 'Debe elegir una encuesta para generar el enlace.');
      return;
    }
    try {
      await generateSurveyToken({
        survey_id: tokenSurveyId,
        requester_email: tokenRequesterEmail.trim() || undefined,
      });
      toast.success('Enlace generado', 'Se generó un nuevo enlace criptográfico de 64 caracteres.');
      setIsTokenModalOpen(false);
      setTokenRequesterEmail('');
      await loadTokens();
      setActiveTab('tokens');
    } catch (err: any) {
      toast.error('Error al generar enlace', err.message);
    }
  };

  return (
    <div className="surveys-container">
      {/* Header */}
      <div className="surveys-header">
        <div className="surveys-title-group">
          <h1>
            <HeartHandshake className="w-7 h-7 text-coral" style={{ color: 'var(--accent-coral)' }} />
            <span>Encuestas de Satisfacción & CSAT / NPS</span>
          </h1>
          <p>
            Constructor nativo de encuestas multi-entidad, lógica condicional, simulación en vivo y analítica de lealtad.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setTokenSurveyId(selectedSurvey?.id || (surveys[0]?.id ?? ''));
              setIsTokenModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <KeyRound className="w-4 h-4" />
            <span>Generar Enlace Manual</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenCreateModal()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Encuesta</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="surveys-nav-tabs">
        <button
          className={`surveys-tab-btn ${activeTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <Sparkles className="w-4 h-4" />
          <span>Plantillas Predefinidas</span>
        </button>

        <button
          className={`surveys-tab-btn ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <LayoutTemplate className="w-4 h-4" />
          <span>Constructor & Preguntas</span>
        </button>

        <button
          className={`surveys-tab-btn ${activeTab === 'designer' ? 'active' : ''}`}
          onClick={() => setActiveTab('designer')}
        >
          <Sliders className="w-4 h-4" />
          <span>Diseño & Etiquetas</span>
        </button>

        <button
          className={`surveys-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          <Smartphone className="w-4 h-4" />
          <span>Previsualización en Vivo</span>
        </button>

        <button
          className={`surveys-tab-btn ${activeTab === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          <KeyRound className="w-4 h-4" />
          <span>Enlaces & Tokens</span>
        </button>

        <button
          className={`surveys-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Métricas CSAT / NPS</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: PRESETS / PLANTILLAS STARTER                                  */}
      {/* ==================================================================== */}
      {activeTab === 'presets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: 'var(--surface-01dp)', padding: '1rem 1.25rem', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', fontWeight: 600 }}>
              Plantillas de Encuesta con 1 Clic
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Acelere la implementación seleccionando un modelo estándar con preguntas y lógica preconfiguradas.
            </p>
          </div>

          <div className="presets-grid">
            {presets.map((preset) => (
              <div key={preset.key} className="preset-card">
                <div>
                  <div className="preset-header">
                    <span className="preset-badge">{preset.badge}</span>
                  </div>
                  <h3 className="preset-title">{preset.name}</h3>
                  <p className="preset-desc">{preset.description}</p>

                  <div className="preset-questions-preview">
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Preguntas incluidas ({preset.questions.length}):
                    </span>
                    {preset.questions.map((q, idx) => (
                      <div key={idx} className="preset-q-item">
                        <span>•</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.name}
                        </span>
                      </div>
                    ))}
                    {preset.questions.length === 0 && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Formulario en blanco listo para crear preguntas a medida.
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenCreateModal(preset)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear desde esta Plantilla</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: BUILDER & QUESTIONS                                           */}
      {/* ==================================================================== */}
      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Surveys List */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Encuestas ({surveys.length})</h3>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleOpenCreateModal()}
                title="Nueva Encuesta"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {surveys.map((s) => {
                const isSelected = selectedSurvey?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSurvey(s.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(235, 77, 61, 0.12)' : 'var(--surface-01dp)',
                      border: isSelected ? '1px solid var(--accent-coral)' : '1px solid var(--border-subtle)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: isSelected ? 'var(--accent-coral)' : 'var(--text-primary)' }}>
                        {s.name}
                      </strong>
                      {s.is_default && (
                        <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 600 }}>
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>{s.questions_count} preguntas</span>
                      <span>{s.completed_tokens_count} respuestas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Survey Questions Builder */}
          {selectedSurvey ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.25rem' }}>{selectedSurvey.name}</h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Preguntas configuradas para esta encuesta ({selectedSurvey.questions.length})
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCloneSurvey(selectedSurvey.id, selectedSurvey.name)}
                    title="Duplicar Encuesta"
                  >
                    <Copy className="w-3.5 h-3.5" /> Clonar
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteSurvey(selectedSurvey.id, selectedSurvey.name)}
                    title="Eliminar Encuesta"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenQuestionModal()}
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Pregunta
                  </button>
                </div>
              </div>

              {/* Questions Stream */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedSurvey.questions.map((q, index) => (
                  <div
                    key={q.id}
                    style={{
                      background: 'var(--surface-01dp)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      {/* Reorder Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveQuestion(index, 'up')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: index === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                            cursor: index === 0 ? 'default' : 'pointer',
                            padding: 0,
                          }}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedSurvey.questions.length - 1}
                          onClick={() => handleMoveQuestion(index, 'down')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color:
                              index === selectedSurvey.questions.length - 1
                                ? 'var(--text-muted)'
                                : 'var(--text-secondary)',
                            cursor: index === selectedSurvey.questions.length - 1 ? 'default' : 'pointer',
                            padding: 0,
                          }}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {index + 1}. {q.name}
                          </span>
                          {q.is_mandatory && (
                            <span style={{ fontSize: '0.75rem', color: '#fb7185' }}>*Obligatoria</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span className={`q-type-badge ${q.question_type}`}>{q.question_type}</span>

                          {q.condition_question_id && (
                            <span style={{ fontSize: '0.75rem', color: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                              Condición: valor {q.condition_value}
                            </span>
                          )}

                          {q.options.length > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {q.options.length} opciones
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenQuestionModal(q)}
                        title="Editar Pregunta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Eliminar Pregunta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {selectedSurvey.questions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Esta encuesta no contiene preguntas aún. Presione "+ Agregar Pregunta" para comenzar.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Seleccione una encuesta a la izquierda para visualizar y configurar sus preguntas.
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: DESIGNER & TEMPLATE TAGS                                      */}
      {/* ==================================================================== */}
      {activeTab === 'designer' && selectedSurvey && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Diseño de Mensajes y Etiquetas Dinámicas
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Personalice los textos de bienvenida, agradecimiento y pie de página de la encuesta "{selectedSurvey.name}".
          </p>

          {/* Available tags bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              Etiquetas disponibles para reemplazo automático (clic para copiar):
            </span>
            <div className="tags-insert-bar">
              {['##ticket.id##', '##ticket.title##', '##ticket.technician##', '##ticket.requester##'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="tag-insert-chip"
                  onClick={() => {
                    navigator.clipboard.writeText(tag);
                    toast.success('Etiqueta copiada', tag);
                  }}
                >
                  <Copy className="w-3 h-3" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await updateSurvey(selectedSurvey.id, {
                  header_content: selectedSurvey.header_content,
                  footer_content: selectedSurvey.footer_content,
                  success_content: selectedSurvey.success_content,
                  ttl_days_override: selectedSurvey.ttl_days_override,
                  allow_reentry_override: selectedSurvey.allow_reentry_override,
                  is_active: selectedSurvey.is_active,
                  is_default: selectedSurvey.is_default,
                });
                toast.success('Plantilla guardada', 'Se actualizaron los textos de la encuesta.');
                await loadSurveys();
              } catch (err: any) {
                toast.error('Error al guardar', err.message);
              }
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="styled-label">Encabezado de Bienvenida (HTML o texto)</label>
                <textarea
                  rows={4}
                  className="styled-input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  value={selectedSurvey.header_content || ''}
                  onChange={(e) =>
                    setSelectedSurvey((prev) => (prev ? { ...prev, header_content: e.target.value } : null))
                  }
                />
              </div>

              <div>
                <label className="styled-label">Pantalla de Agradecimiento / Éxito (HTML o texto)</label>
                <textarea
                  rows={4}
                  className="styled-input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                  value={selectedSurvey.success_content || ''}
                  onChange={(e) =>
                    setSelectedSurvey((prev) => (prev ? { ...prev, success_content: e.target.value } : null))
                  }
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="styled-label">Pie de Página (Opcional)</label>
              <textarea
                rows={2}
                className="styled-input"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                value={selectedSurvey.footer_content || ''}
                onChange={(e) =>
                  setSelectedSurvey((prev) => (prev ? { ...prev, footer_content: e.target.value } : null))
                }
              />
            </div>

            {/* TTL & Reentry toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', background: 'var(--surface-01dp)', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <label className="styled-label">Vigencia del Enlace (Días)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="styled-input"
                  value={selectedSurvey.ttl_days_override}
                  onChange={(e) =>
                    setSelectedSurvey((prev) =>
                      prev ? { ...prev, ttl_days_override: parseInt(e.target.value, 10) || 15 } : null
                    )
                  }
                />
              </div>

              <div>
                <label className="styled-label">Borradores & Reingreso</label>
                <select
                  className="styled-input"
                  value={selectedSurvey.allow_reentry_override}
                  onChange={(e) =>
                    setSelectedSurvey((prev) =>
                      prev ? { ...prev, allow_reentry_override: parseInt(e.target.value, 10) || 0 } : null
                    )
                  }
                >
                  <option value={1}>Permitir autosave y reingreso hasta enviar</option>
                  <option value={0}>Bloqueo absoluto tras primer envío</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="chk-active"
                  checked={selectedSurvey.is_active}
                  onChange={(e) =>
                    setSelectedSurvey((prev) => (prev ? { ...prev, is_active: e.target.checked } : null))
                  }
                />
                <label htmlFor="chk-active" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Encuesta Activa
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="chk-default"
                  checked={selectedSurvey.is_default}
                  onChange={(e) =>
                    setSelectedSurvey((prev) => (prev ? { ...prev, is_default: e.target.checked } : null))
                  }
                />
                <label htmlFor="chk-default" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Predeterminada Global
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: LIVE PREVIEW & PHONE/DESKTOP SIMULATOR                        */}
      {/* ==================================================================== */}
      {activeTab === 'preview' && selectedSurvey && (
        <div className="preview-wrapper">
          <div className="preview-controls">
            <button
              type="button"
              className={`preview-toggle-btn ${previewDevice === 'smartphone' ? 'active' : ''}`}
              onClick={() => setPreviewDevice('smartphone')}
            >
              <Smartphone className="w-4 h-4" />
              <span>Smartphone (Móvil)</span>
            </button>
            <button
              type="button"
              className={`preview-toggle-btn ${previewDevice === 'desktop' ? 'active' : ''}`}
              onClick={() => setPreviewDevice('desktop')}
            >
              <Monitor className="w-4 h-4" />
              <span>Escritorio (PC)</span>
            </button>
          </div>

          {previewDevice === 'smartphone' ? (
            <div className="mockup-smartphone">
              <div className="smartphone-notch">
                <div className="smartphone-camera" />
              </div>
              <div className="smartphone-screen">
                <PublicSurveyView token="preview_mode" />
              </div>
            </div>
          ) : (
            <div className="mockup-desktop">
              <div className="desktop-browser-bar">
                <div className="browser-dots">
                  <div className="browser-dot red" />
                  <div className="browser-dot yellow" />
                  <div className="browser-dot green" />
                </div>
                <div className="browser-url-pill">
                  https://itilsuite.local/survey/preview-simulator-token
                </div>
              </div>
              <div className="desktop-screen">
                <PublicSurveyView token="preview_mode" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: TOKENS & ACCESS LINKS                                         */}
      {/* ==================================================================== */}
      {activeTab === 'tokens' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Enlaces Públicos & Tokens Emitidos</h2>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Tokens criptográficos únicos de 64 caracteres generados para tickets o solicitantes directos.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setTokenSurveyId(selectedSurvey?.id || (surveys[0]?.id ?? ''));
                setIsTokenModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" /> Generar Nuevo Enlace
            </button>
          </div>

          <div className="surveys-table-container">
            <table className="surveys-table">
              <thead>
                <tr>
                  <th>Ticket / Solicitante</th>
                  <th>Encuesta</th>
                  <th>Estado</th>
                  <th>Fecha Expiración</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((tok) => {
                  const isCopied = copiedTokenId === tok.id;

                  return (
                    <tr key={tok.id}>
                      <td>
                        {tok.ticket_number ? (
                          <div>
                            <strong>#{tok.ticket_number}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {tok.ticket_name}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span>{tok.requester_email || 'Sin email registrado'}</span>
                          </div>
                        )}
                      </td>
                      <td>{tok.survey_name}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background:
                              tok.status === 'completed'
                                ? 'rgba(52, 211, 153, 0.15)'
                                : tok.status === 'in_progress'
                                ? 'rgba(96, 165, 250, 0.15)'
                                : tok.status === 'expired'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(251, 191, 36, 0.15)',
                            color:
                              tok.status === 'completed'
                                ? '#34d399'
                                : tok.status === 'in_progress'
                                ? '#60a5fa'
                                : tok.status === 'expired'
                                ? '#f87171'
                                : '#fbbf24',
                          }}
                        >
                          {tok.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(tok.expires_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyUrl(tok.token, tok.id)}
                            title="Copiar Enlace de Encuesta"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleShareWhatsApp(tok.token, tok.ticket_number)}
                            title="Compartir por WhatsApp"
                          >
                            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          <a
                            href={`/survey/${tok.token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            title="Abrir Encuesta Pública"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tokens.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No se han emitido enlaces de encuesta todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 6: ANALYTICS & CSAT / NPS DASHBOARD                              */}
      {/* ==================================================================== */}
      {activeTab === 'analytics' && metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Enlaces Emitidos</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.25rem 0 0' }}>{metrics.total_links_issued}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{metrics.completed_surveys} completados</span>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tasa de Respuesta</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.25rem 0 0', color: '#60a5fa' }}>
                {metrics.response_rate.toFixed(1)}%
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{metrics.pending_surveys} pendientes</span>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>CSAT Promedio (1-5)</span>
              <h3 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0.25rem 0 0', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
                <span>{metrics.average_csat > 0 ? metrics.average_csat.toFixed(2) : '-'}</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Satisfacción global</span>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.25rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>NPS (Net Promoter Score)</span>
              <h3
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  margin: '0.25rem 0 0',
                  color: metrics.nps.score >= 50 ? '#34d399' : metrics.nps.score >= 0 ? '#fbbf24' : '#f87171',
                }}
              >
                {metrics.nps.total > 0 ? (metrics.nps.score > 0 ? `+${metrics.nps.score}` : metrics.nps.score) : '-'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {metrics.nps.promoters} Promotores / {metrics.nps.detractors} Detractores
              </span>
            </div>
          </div>

          {/* Breakdown Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* CSAT Distribution */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                Distribución de Calificaciones CSAT
              </h3>
              <div>
                {[5, 4, 3, 2, 1].map((star) => {
                  const item = metrics.csat_distribution.find((d) => d.star === star);
                  const count = item?.count || 0;
                  const pct = item?.percentage || 0;

                  return (
                    <div key={star} className="csat-breakdown-bar">
                      <div style={{ width: '80px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>{star}</span>
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="csat-bar-bg">
                        <div className="csat-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div style={{ width: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {count} ({pct.toFixed(0)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NPS Breakdown */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
                Composición NPS (Recomendación)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>Promotores (9-10)</span>
                    <span>{metrics.nps.promoters} respuestas</span>
                  </div>
                  <div className="csat-bar-bg">
                    <div
                      className="csat-bar-fill"
                      style={{
                        width: `${metrics.nps.total > 0 ? (metrics.nps.promoters / metrics.nps.total) * 100 : 0}%`,
                        background: '#10b981',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>Pasivos (7-8)</span>
                    <span>{metrics.nps.passives} respuestas</span>
                  </div>
                  <div className="csat-bar-bg">
                    <div
                      className="csat-bar-fill"
                      style={{
                        width: `${metrics.nps.total > 0 ? (metrics.nps.passives / metrics.nps.total) * 100 : 0}%`,
                        background: '#f59e0b',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: '#f87171', fontWeight: 600 }}>Detractores (0-6)</span>
                    <span>{metrics.nps.detractors} respuestas</span>
                  </div>
                  <div className="csat-bar-bg">
                    <div
                      className="csat-bar-fill"
                      style={{
                        width: `${metrics.nps.total > 0 ? (metrics.nps.detractors / metrics.nps.total) * 100 : 0}%`,
                        background: '#ef4444',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Responses Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
              Respuestas Recientes de Clientes
            </h3>
            <div className="surveys-table-container">
              <table className="surveys-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ticket</th>
                    <th>Encuesta</th>
                    <th>CSAT</th>
                    <th>NPS</th>
                    <th>Respuestas Clave</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recent_responses.map((resp) => (
                    <tr key={resp.token_id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(resp.answered_at).toLocaleString()}
                      </td>
                      <td>
                        {resp.ticket_number ? (
                          <span>#{resp.ticket_number}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{resp.requester_email || '-'}</span>
                        )}
                      </td>
                      <td>{resp.survey_name}</td>
                      <td>
                        {resp.csat_rating ? (
                          <span style={{ color: '#fbbf24', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {resp.csat_rating}/5
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{resp.nps_score !== null ? <strong>{resp.nps_score}/10</strong> : '-'}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {resp.answers_summary
                            .filter((a) => a.answer && a.question_type !== 'rating5' && a.question_type !== 'nps')
                            .map((a) => `${a.question_name}: ${a.answer}`)
                            .join(' | ') || 'Sin comentarios adicionales'}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {metrics.recent_responses.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No hay respuestas registradas aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREAR ENCUESTA                                                */}
      {/* ==================================================================== */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>{selectedPresetForCreation ? `Crear desde ${selectedPresetForCreation.name}` : 'Nueva Encuesta'}</h3>
              <button type="button" className="btn-close" onClick={() => setIsCreateModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSurveySubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="styled-label">Nombre de la Encuesta *</label>
                  <input
                    type="text"
                    className="styled-input"
                    value={newSurveyName}
                    onChange={(e) => setNewSurveyName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="styled-label">Entidad Organizacional (Opcional - Heredable)</label>
                  <select
                    className="styled-input"
                    value={newSurveyEntityId}
                    onChange={(e) => setNewSurveyEntityId(e.target.value)}
                  >
                    <option value="">(Raíz / Global - Para toda la organización)</option>
                    {entities.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Encuesta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: AGREGAR / EDITAR PREGUNTA                                     */}
      {/* ==================================================================== */}
      {isQuestionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3>{editingQuestion ? 'Editar Pregunta' : 'Agregar Pregunta'}</h3>
              <button type="button" className="btn-close" onClick={() => setIsQuestionModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="styled-label">Texto de la Pregunta *</label>
                  <input
                    type="text"
                    className="styled-input"
                    placeholder="Ej. ¿Cómo califica la atención recibida?"
                    value={qName}
                    onChange={(e) => setQName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label className="styled-label">Tipo de Pregunta *</label>
                    <select
                      className="styled-input"
                      value={qType}
                      onChange={(e) => setQType(e.target.value as SurveyQuestionType)}
                    >
                      <option value="rating5">⭐ Valoración 1 a 5 Estrellas</option>
                      <option value="nps">📊 Escala NPS (0 a 10)</option>
                      <option value="yesno">👍 Sí / No</option>
                      <option value="choice_single">🔘 Opción Única (Radio)</option>
                      <option value="choice_multiple">☑️ Selección Múltiple</option>
                      <option value="dropdown">🔽 Menú Desplegable</option>
                      <option value="text">✏️ Texto Corto</option>
                      <option value="textarea">📝 Texto Largo / Comentarios</option>
                      <option value="date">📅 Fecha</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={qMandatory}
                        onChange={(e) => setQMandatory(e.target.checked)}
                      />
                      <span>Respuesta Obligatoria</span>
                    </label>
                  </div>
                </div>

                {/* Options field for choice and dropdown */}
                {['choice_single', 'choice_multiple', 'dropdown'].includes(qType) && (
                  <div>
                    <label className="styled-label">Opciones (una por línea)</label>
                    <textarea
                      rows={3}
                      className="styled-input"
                      placeholder="Excelente&#10;Bueno&#10;Regular&#10;Malo"
                      value={qOptionsText}
                      onChange={(e) => setQOptionsText(e.target.value)}
                    />
                  </div>
                )}

                {/* Conditional Logic Section */}
                <div style={{ background: 'var(--surface-01dp)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <label className="styled-label" style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
                    <span>Lógica Condicional de Visualización (Opcional)</span>
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                    Muestre esta pregunta sólo si el usuario respondió cierto valor en una pregunta anterior.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <select
                        className="styled-input"
                        value={qCondQuestionId}
                        onChange={(e) => setQCondQuestionId(e.target.value)}
                      >
                        <option value="">(Mostrar siempre)</option>
                        {selectedSurvey?.questions
                          .filter((q) => q.id !== editingQuestion?.id)
                          .map((q, idx) => (
                            <option key={q.id} value={q.id}>
                              {idx + 1}. {q.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        className="styled-input"
                        placeholder="Ej: <=3, yes, Malo"
                        value={qCondValue}
                        onChange={(e) => setQCondValue(e.target.value)}
                        disabled={!qCondQuestionId}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsQuestionModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Pregunta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: GENERAR TOKEN MANUAL                                          */}
      {/* ==================================================================== */}
      {isTokenModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Generar Enlace Manual</h3>
              <button type="button" className="btn-close" onClick={() => setIsTokenModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateManualToken}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="styled-label">Encuesta *</label>
                  <select
                    className="styled-input"
                    value={tokenSurveyId}
                    onChange={(e) => setTokenSurveyId(e.target.value)}
                    required
                  >
                    {surveys.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="styled-label">Email del Destinatario (Opcional)</label>
                  <input
                    type="email"
                    className="styled-input"
                    placeholder="cliente@empresa.com"
                    value={tokenRequesterEmail}
                    onChange={(e) => setTokenRequesterEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsTokenModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Generar Enlace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
