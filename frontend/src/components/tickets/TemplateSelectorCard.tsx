import React from 'react';
import {
  FileText,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  Tag,
  Check,
} from 'lucide-react';
import type { TicketTemplate } from '../../types';

interface TemplateSelectorCardProps {
  templates: TicketTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (template: TicketTemplate | null) => void;
}

export const TemplateSelectorCard: React.FC<TemplateSelectorCardProps> = ({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}) => {
  return (
    <div className="template-selector-card">
      <div className="template-selector-header">
        <div className="template-header-icon-wrap">
          <Sparkles size={16} />
        </div>
        <div>
          <h4 className="template-selector-title">Plantillas de Servicio (GLPI Inspired)</h4>
          <span className="template-selector-subtitle">
            Aplica un formato estandarizado con cuestionario técnico, prioridad y técnico predeterminado
          </span>
        </div>
      </div>

      <div className="template-chips-grid">
        {/* Option: Blank / Custom */}
        <button
          type="button"
          className={`template-chip-btn ${!selectedTemplateId ? 'active' : ''}`}
          onClick={() => onSelectTemplate(null)}
        >
          <div className="chip-left">
            <FileText size={15} />
            <span className="chip-name">Personalizado / Sin Plantilla</span>
          </div>
          {!selectedTemplateId && <Check size={14} className="chip-check" />}
        </button>

        {/* Available Templates */}
        {templates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          const isIncident = tpl.ticket_type === 'incident';

          return (
            <button
              key={tpl.id}
              type="button"
              className={`template-chip-btn ${isSelected ? 'active' : ''} ${
                isIncident ? 'chip-incident' : 'chip-request'
              }`}
              onClick={() => onSelectTemplate(tpl)}
              title={tpl.description || tpl.name}
            >
              <div className="chip-left">
                {isIncident ? (
                  <AlertTriangle size={15} className="chip-icon-incident" />
                ) : (
                  <Layers size={15} className="chip-icon-request" />
                )}
                <div className="chip-text-wrap">
                  <span className="chip-name">{tpl.name}</span>
                  {tpl.category && (
                    <span className="chip-category-text">
                      <Tag size={10} style={{ marginRight: 2 }} />
                      {tpl.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="chip-right">
                {isSelected ? (
                  <Check size={14} className="chip-check" />
                ) : (
                  <ArrowRight size={13} className="chip-arrow" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
