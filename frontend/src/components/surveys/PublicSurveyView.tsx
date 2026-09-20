import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchPublicSurvey,
  savePublicSurveyDraft,
  submitPublicSurvey,
} from '../../services/api';
import type { PublicSurvey, PublicQuestion } from '../../types';
import './surveys.css';

interface PublicSurveyViewProps {
  token?: string;
}

export const PublicSurveyView: React.FC<PublicSurveyViewProps> = ({ token: propToken }) => {
  // Resolve token from props or URL
  const token = propToken || (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const qToken = urlParams.get('survey_token');
    if (qToken) return qToken;
    const match = window.location.pathname.match(/\/survey\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : '';
  })();

  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hoveredStars, setHoveredStars] = useState<Record<string, number>>({});
  const [autosaving, setAutosaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load survey data
  useEffect(() => {
    if (!token) {
      setErrorMsg('No se proporcionó ningún token de acceso a la encuesta.');
      setLoading(false);
      return;
    }

    fetchPublicSurvey(token)
      .then((data) => {
        setSurvey(data);
        if (data.draft_answers) {
          setAnswers(data.draft_answers);
        }
        if (data.status === 'completed' && !data.allow_reentry) {
          setIsCompleted(true);
        }
      })
      .catch((err) => {
        setErrorMsg(err.message || 'Error al cargar la encuesta');
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Debounced autosave
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAutosave = useCallback(
    (currentAnswers: Record<string, string>) => {
      if (!token || isCompleted) return;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          setAutosaving(true);
          const formatted = Object.entries(currentAnswers).map(([qid, val]) => ({
            question_id: qid,
            value: val,
          }));
          await savePublicSurveyDraft(token, { answers: formatted });
          setLastSaved(new Date());
        } catch {
          // silently continue
        } finally {
          setAutosaving(false);
        }
      }, 900);
    },
    [token, isCompleted]
  );

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: value };
      triggerAutosave(updated);
      return updated;
    });
  };

  const handleMultipleChoiceToggle = (questionId: string, optVal: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] ? prev[questionId].split(',').filter(Boolean) : [];
      const updatedList = current.includes(optVal)
        ? current.filter((v) => v !== optVal)
        : [...current, optVal];
      const valStr = updatedList.join(',');
      const updated = { ...prev, [questionId]: valStr };
      triggerAutosave(updated);
      return updated;
    });
  };

  // Visibility logic
  const isQuestionVisible = (q: PublicQuestion): boolean => {
    if (!q.condition_question_id || !q.condition_value) return true;
    const parentVal = answers[q.condition_question_id]?.trim();
    if (!parentVal) return false;

    const cond = q.condition_value.trim();
    if (cond.startsWith('<=') || cond.startsWith('<') || cond.startsWith('>=') || cond.startsWith('>')) {
      const parentNum = parseFloat(parentVal);
      if (isNaN(parentNum)) return false;
      if (cond.startsWith('<=')) {
        const threshold = parseFloat(cond.substring(2).trim());
        return !isNaN(threshold) && parentNum <= threshold;
      }
      if (cond.startsWith('<')) {
        const threshold = parseFloat(cond.substring(1).trim());
        return !isNaN(threshold) && parentNum < threshold;
      }
      if (cond.startsWith('>=')) {
        const threshold = parseFloat(cond.substring(2).trim());
        return !isNaN(threshold) && parentNum >= threshold;
      }
      if (cond.startsWith('>')) {
        const threshold = parseFloat(cond.substring(1).trim());
        return !isNaN(threshold) && parentNum > threshold;
      }
    }
    return parentVal.toLowerCase() === cond.toLowerCase();
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !token) return;

    // Validate mandatory visible questions
    const visibleQuestions = survey.questions.filter(isQuestionVisible);
    for (const q of visibleQuestions) {
      if (q.is_mandatory) {
        const ans = answers[q.id]?.trim();
        if (!ans) {
          alert(`Por favor responda a la pregunta obligatoria: "${q.name}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const formatted = Object.entries(answers).map(([qid, val]) => ({
        question_id: qid,
        value: val,
      }));
      await submitPublicSurvey(token, { answers: formatted });
      setIsCompleted(true);
    } catch (err: any) {
      alert(err.message || 'Error al enviar la encuesta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="public-survey-viewport">
        <div className="public-survey-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Clock className="w-8 h-8 text-amber-500 animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#b8aca0' }}>Cargando encuesta de satisfacción...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="public-survey-viewport">
        <div className="public-survey-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle className="w-12 h-12 text-rose-500" style={{ margin: '0 auto 1rem', color: '#fb7185' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem' }}>Encuesta no disponible</h2>
          <p style={{ color: '#b8aca0', lineHeight: 1.5 }}>{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="public-survey-viewport">
        <div className="public-survey-card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(52, 211, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#34d399',
            }}
          >
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div
            dangerouslySetInnerHTML={{
              __html:
                survey?.success_content ||
                '<h3>¡Muchas gracias por su valoración!</h3><p>Su respuesta ha sido registrada exitosamente y nos ayuda a brindar un mejor servicio.</p>',
            }}
          />

          <div
            style={{
              marginTop: '2rem',
              padding: '1rem',
              background: '#141210',
              borderRadius: '8px',
              fontSize: '0.8rem',
              color: '#7c7269',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Respuesta verificada y transmitida de forma segura a ITILSuite</span>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="public-survey-viewport">
      <div className="public-survey-card">
        {/* Brand & Context Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(247, 242, 236, 0.08)',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #eb4d3d, #f06455)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: '#fff',
                fontSize: '0.9rem',
              }}
            >
              IT
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>ITILSuite Helpdesk</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#b8aca0' }}>
                Encuesta de Satisfacción del Cliente
              </span>
            </div>
          </div>

          {/* Autosave status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {autosaving ? (
              <span className="autosave-pill" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                <Clock className="w-3 h-3 animate-spin" /> Guardando...
              </span>
            ) : lastSaved ? (
              <span className="autosave-pill">
                <CheckCircle2 className="w-3 h-3" /> Borrador guardado
              </span>
            ) : null}
          </div>
        </div>

        {/* Ticket Reference Badge */}
        {survey.ticket_number && (
          <div
            style={{
              background: '#141210',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(247, 242, 236, 0.06)',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div>
              <span style={{ color: '#b8aca0' }}>Ticket: </span>
              <strong style={{ color: '#f6f0ea' }}>#{survey.ticket_number}</strong>
              {survey.ticket_title && <span style={{ color: '#7c7269' }}> - {survey.ticket_title}</span>}
            </div>
            {survey.technician_name && (
              <div style={{ color: '#b8aca0', fontSize: '0.8rem' }}>
                Atendido por: <strong style={{ color: '#f6f0ea' }}>{survey.technician_name}</strong>
              </div>
            )}
          </div>
        )}

        {/* Header Content */}
        {survey.header_content && (
          <div
            style={{ marginBottom: '1.75rem', lineHeight: 1.5, color: '#f6f0ea' }}
            dangerouslySetInnerHTML={{ __html: survey.header_content }}
          />
        )}

        {/* Form Questions */}
        <form onSubmit={handleSubmit}>
          {survey.questions.map((q, index) => {
            const visible = isQuestionVisible(q);
            if (!visible) return null;

            const currentVal = answers[q.id] || '';

            return (
              <div key={q.id} className="public-question-card">
                <div className="public-question-title">
                  <span style={{ color: '#eb4d3d', fontSize: '0.9rem' }}>{index + 1}.</span>
                  <span>{q.name}</span>
                  {q.is_mandatory && <span style={{ color: '#fb7185', fontSize: '0.85rem' }}>*</span>}
                </div>

                {/* 1. Rating 1-5 Stars */}
                {q.question_type === 'rating5' && (
                  <div className="star-rating-row">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const currentNum = parseInt(currentVal, 10) || 0;
                      const hovered = hoveredStars[q.id] || 0;
                      const isActive = (hovered || currentNum) >= star;

                      return (
                        <button
                          key={star}
                          type="button"
                          className={`star-btn ${isActive ? 'active' : ''}`}
                          onMouseEnter={() =>
                            setHoveredStars((prev) => ({ ...prev, [q.id]: star }))
                          }
                          onMouseLeave={() =>
                            setHoveredStars((prev) => ({ ...prev, [q.id]: 0 }))
                          }
                          onClick={() => handleAnswerChange(q.id, String(star))}
                          title={`${star} estrellas`}
                        >
                          <Star
                            className="w-8 h-8"
                            fill={isActive ? '#fbbf24' : 'none'}
                            stroke={isActive ? '#fbbf24' : 'currentColor'}
                          />
                        </button>
                      );
                    })}
                    {currentVal && (
                      <span style={{ fontSize: '0.85rem', color: '#fbbf24', marginLeft: '0.5rem', fontWeight: 600 }}>
                        {currentVal} / 5
                      </span>
                    )}
                  </div>
                )}

                {/* 2. NPS 0-10 Scale */}
                {q.question_type === 'nps' && (
                  <div>
                    <div className="nps-scale-row">
                      {Array.from({ length: 11 }, (_, i) => i).map((num) => {
                        const isSelected = currentVal === String(num);
                        const category = num <= 6 ? 'detractor' : num <= 8 ? 'passive' : 'promoter';

                        return (
                          <button
                            key={num}
                            type="button"
                            className={`nps-btn ${category} ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleAnswerChange(q.id, String(num))}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                    <div className="nps-labels">
                      <span>0 - Nada probable</span>
                      <span>10 - Sumamente probable</span>
                    </div>
                  </div>
                )}

                {/* 3. Yes / No */}
                {q.question_type === 'yesno' && (
                  <div className="yesno-row">
                    <button
                      type="button"
                      className={`yesno-btn ${currentVal === 'yes' ? 'selected-yes' : ''}`}
                      onClick={() => handleAnswerChange(q.id, 'yes')}
                    >
                      <ThumbsUp className="w-5 h-5" />
                      <span>Sí</span>
                    </button>
                    <button
                      type="button"
                      className={`yesno-btn ${currentVal === 'no' ? 'selected-no' : ''}`}
                      onClick={() => handleAnswerChange(q.id, 'no')}
                    >
                      <ThumbsDown className="w-5 h-5" />
                      <span>No</span>
                    </button>
                  </div>
                )}

                {/* 4. Choice Single */}
                {q.question_type === 'choice_single' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((opt) => (
                      <label
                        key={opt.value}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          cursor: 'pointer',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          background: currentVal === opt.value ? 'rgba(235, 77, 61, 0.15)' : 'transparent',
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.value}
                          checked={currentVal === opt.value}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        />
                        <span style={{ fontSize: '0.9rem' }}>{opt.value}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* 5. Choice Multiple */}
                {q.question_type === 'choice_multiple' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((opt) => {
                      const selectedVals = currentVal.split(',').filter(Boolean);
                      const isChecked = selectedVals.includes(opt.value);

                      return (
                        <label
                          key={opt.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            background: isChecked ? 'rgba(235, 77, 61, 0.15)' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            value={opt.value}
                            checked={isChecked}
                            onChange={() => handleMultipleChoiceToggle(q.id, opt.value)}
                          />
                          <span style={{ fontSize: '0.9rem' }}>{opt.value}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* 6. Dropdown */}
                {q.question_type === 'dropdown' && (
                  <select
                    className="styled-input"
                    value={currentVal}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      background: '#141210',
                      border: '1px solid rgba(247, 242, 236, 0.1)',
                      color: '#f6f0ea',
                      borderRadius: '8px',
                    }}
                  >
                    <option value="">-- Seleccione una opción --</option>
                    {q.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </select>
                )}

                {/* 7. Short Text */}
                {q.question_type === 'text' && (
                  <input
                    type="text"
                    className="styled-input"
                    placeholder="Su respuesta..."
                    value={currentVal}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#141210',
                      border: '1px solid rgba(247, 242, 236, 0.1)',
                      color: '#f6f0ea',
                      borderRadius: '8px',
                    }}
                  />
                )}

                {/* 8. Textarea */}
                {q.question_type === 'textarea' && (
                  <textarea
                    rows={3}
                    className="styled-input"
                    placeholder="Escriba sus comentarios o sugerencias detalladas aquí..."
                    value={currentVal}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      background: '#141210',
                      border: '1px solid rgba(247, 242, 236, 0.1)',
                      color: '#f6f0ea',
                      borderRadius: '8px',
                      resize: 'vertical',
                    }}
                  />
                )}

                {/* 9. Date */}
                {q.question_type === 'date' && (
                  <input
                    type="date"
                    className="styled-input"
                    value={currentVal}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: '#141210',
                      border: '1px solid rgba(247, 242, 236, 0.1)',
                      color: '#f6f0ea',
                      borderRadius: '8px',
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Footer Content */}
          {survey.footer_content && (
            <div
              style={{ margin: '1.5rem 0', fontSize: '0.85rem', color: '#b8aca0', lineHeight: 1.4 }}
              dangerouslySetInnerHTML={{ __html: survey.footer_content }}
            />
          )}

          {/* Submit Button */}
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 2rem',
                background: '#eb4d3d',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(235, 77, 61, 0.4)',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <>
                  <Clock className="w-5 h-5 animate-spin" />
                  <span>Enviando respuestas...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Enviar Encuesta de Satisfacción</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
