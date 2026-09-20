-- 20260923000001_native_surveys_and_satisfaction.sql
-- Subsystem: Native Survey & Satisfaction Management (CSAT & NPS Engine)

-- 1. Surveys Definitions Table
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = global / transversal
    is_recursive BOOLEAN NOT NULL DEFAULT FALSE,
    name VARCHAR(255) NOT NULL,
    comment TEXT,
    header_content TEXT,
    footer_content TEXT,
    success_content TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    ttl_days_override INTEGER NOT NULL DEFAULT 7,
    allow_reentry_override INTEGER NOT NULL DEFAULT 1, -- 1=Yes (autosave & re-entry), 0=No (single session)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_entity_id ON surveys(entity_id);
CREATE INDEX IF NOT EXISTS idx_surveys_is_active ON surveys(is_active);
CREATE INDEX IF NOT EXISTS idx_surveys_is_default ON surveys(is_default);

-- 2. Survey Questions Table
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    question_type VARCHAR(30) NOT NULL CHECK (
        question_type IN (
            'rating5',
            'nps',
            'yesno',
            'choice_single',
            'choice_multiple',
            'dropdown',
            'text',
            'textarea',
            'date'
        )
    ),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    ranking INTEGER NOT NULL DEFAULT 0,
    condition_question_id UUID REFERENCES survey_questions(id) ON DELETE SET NULL,
    condition_value VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id, ranking);
CREATE INDEX IF NOT EXISTS idx_survey_questions_condition ON survey_questions(condition_question_id);

-- 3. Survey Question Options (Choice items for single, multiple, or dropdown)
CREATE TABLE IF NOT EXISTS survey_question_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    value VARCHAR(255) NOT NULL,
    ranking INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_question_options_q ON survey_question_options(question_id, ranking);

-- 4. Cryptographic Survey Tokens (Zero-login stateless access)
CREATE TABLE IF NOT EXISTS survey_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    item_type VARCHAR(100),
    item_id UUID,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    token CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'completed', 'expired')
    ),
    requester_email VARCHAR(255),
    ip_answered VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    answered_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_survey_tokens_token ON survey_tokens(token);
CREATE INDEX IF NOT EXISTS idx_survey_tokens_ticket ON survey_tokens(ticket_id);
CREATE INDEX IF NOT EXISTS idx_survey_tokens_survey ON survey_tokens(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_tokens_status ON survey_tokens(status);
CREATE INDEX IF NOT EXISTS idx_survey_tokens_expires ON survey_tokens(expires_at);

-- 5. Survey Answers (Drafts & Final Submissions)
CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES survey_tokens(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
    answer TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'final' CHECK (status IN ('draft', 'final')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_survey_token_question UNIQUE (token_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_answers_token ON survey_answers(token_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_question ON survey_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_survey_answers_status ON survey_answers(status);

-- 6. Seed Default Helpdesk Satisfaction Survey
INSERT INTO surveys (
    id, entity_id, is_recursive, name, comment,
    header_content, footer_content, success_content,
    is_active, is_default, ttl_days_override, allow_reentry_override,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000501',
    NULL,
    TRUE,
    'Encuesta Estándar de Satisfacción - Helpdesk',
    'Encuesta predeterminada de satisfacción para tickets resueltos o cerrados en la mesa de ayuda.',
    '<h3>Tu opinión nos ayuda a mejorar continuamente</h3><p>Por favor, tómate menos de 1 minuto para evaluar la atención y resolución del ticket <strong>##ticket.title##</strong> atendido por <strong>##ticket.technician##</strong>.</p>',
    '<p style="color: #64748b; font-size: 0.85rem;">ITILSuite Service Desk • Gestión de Calidad y Mejora Continua de Servicios TI</p>',
    '<h3>¡Muchas gracias por tu valoración!</h3><p>Tus respuestas han sido registradas exitosamente y nos permiten seguir elevando el nivel de nuestros servicios técnicos.</p>',
    TRUE,
    TRUE,
    7,
    1,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Seed Default Questions
INSERT INTO survey_questions (
    id, survey_id, name, question_type, is_mandatory, ranking,
    condition_question_id, condition_value, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000511',
    '00000000-0000-0000-0000-000000000501',
    '¿Cómo califica el servicio y la atención recibida por nuestro equipo?',
    'rating5',
    TRUE,
    10,
    NULL,
    NULL,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (
    id, survey_id, name, question_type, is_mandatory, ranking,
    condition_question_id, condition_value, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000512',
    '00000000-0000-0000-0000-000000000501',
    '¿Qué aspectos considera que podríamos mejorar en la atención técnica?',
    'textarea',
    FALSE,
    20,
    '00000000-0000-0000-0000-000000000511',
    '<=3',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (
    id, survey_id, name, question_type, is_mandatory, ranking,
    condition_question_id, condition_value, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000513',
    '00000000-0000-0000-0000-000000000501',
    '¿Su incidente o requerimiento fue resuelto satisfactoriamente?',
    'yesno',
    TRUE,
    30,
    NULL,
    NULL,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO survey_questions (
    id, survey_id, name, question_type, is_mandatory, ranking,
    condition_question_id, condition_value, created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000514',
    '00000000-0000-0000-0000-000000000501',
    'Comentarios o sugerencias adicionales para el Service Desk',
    'textarea',
    FALSE,
    40,
    NULL,
    NULL,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 7. Seed Notification Template & Event for Survey Invitations
INSERT INTO notification_templates (id, name, item_type, subject_template, html_template, text_template)
VALUES (
    '00000000-0000-0000-0000-000000000522',
    'Invitación a Encuesta de Satisfacción',
    'Ticket',
    'Tu opinión nos importa: Valoración del Ticket ##ticket.number##',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
        <div style="background-color: #3b82f6; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">Valoración del Servicio TI</h2>
        </div>
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #ffffff;">
            <p>Hola <strong>##author.name##</strong>,</p>
            <p>El ticket <strong>##ticket.number## - "##ticket.title##"</strong> ha sido resuelto por nuestro equipo técnico.</p>
            <p>Nos gustaría conocer tu experiencia para continuar mejorando la calidad de nuestro soporte.</p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="##ticket.surveylink.url##" style="background-color: #3b82f6; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Completar Encuesta de Satisfacción
                </a>
            </div>
            <p style="font-size: 0.85rem; color: #64748b;">
                Este enlace estará disponible hasta el <strong>##ticket.surveylink.expiration##</strong> y no requiere contraseña.
            </p>
        </div>
    </div>',
    'Hola ##author.name##,

El ticket ##ticket.number## - "##ticket.title##" ha sido resuelto.
Te invitamos a responder nuestra breve encuesta de satisfacción ingresando al siguiente enlace:
##ticket.surveylink.url##

(Disponible hasta: ##ticket.surveylink.expiration##)

Atentamente,
El equipo de Soporte TI'
) ON CONFLICT (name) DO NOTHING;

INSERT INTO notification_events (id, event_key, name, template_id, is_active, recipients)
VALUES (
    '00000000-0000-0000-0000-000000000521',
    'survey_invitation',
    'Invitación a encuesta de satisfacción al resolver un ticket',
    '00000000-0000-0000-0000-000000000522',
    TRUE,
    '["requester"]'::jsonb
) ON CONFLICT (event_key) DO NOTHING;

