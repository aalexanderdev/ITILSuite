-- 20260922000001_advanced_slas_and_escalations.sql
-- Subsystem: Real-Time SLA Engine, Business Calendars & Automated Escalation Matrices

-- 1. Calendars Table (Working schedules and business hours)
CREATE TABLE IF NOT EXISTS calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = global/transversal calendar
    name VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_entity_id ON calendars(entity_id);

-- 2. Calendar Segments (Weekly working intervals, e.g., Mon-Fri 08:00 - 18:00)
CREATE TABLE IF NOT EXISTS calendar_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Monday, 7 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_calendar_segment_times CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_calendar_segments_calendar ON calendar_segments(calendar_id, day_of_week);

-- 3. Calendar Holidays (Non-working dates / public holidays)
CREATE TABLE IF NOT EXISTS calendar_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    holiday_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (calendar_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_holidays_calendar ON calendar_holidays(calendar_id, holiday_date);

-- 4. Service Level Agreements (SLAs) Table
CREATE TABLE IF NOT EXISTS slas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = global
    name VARCHAR(100) NOT NULL,
    description TEXT,
    calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
    tto_duration_minutes INTEGER NOT NULL DEFAULT 60,  -- Time to Own target duration
    ttr_duration_minutes INTEGER NOT NULL DEFAULT 480, -- Time to Resolve target duration
    priority_override INTEGER CHECK (priority_override BETWEEN 1 AND 5), -- Default priority association
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slas_entity_id ON slas(entity_id);
CREATE INDEX IF NOT EXISTS idx_slas_priority_override ON slas(priority_override);

-- 5. SLA Escalation Levels (Rules triggered before, at, or after deadline breach)
CREATE TABLE IF NOT EXISTS sla_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sla_id UUID NOT NULL REFERENCES slas(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('tto', 'ttr')),
    execution_offset_minutes INTEGER NOT NULL, -- -30: 30m before breach, 0: on breach, +60: 60m after breach
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('escalate_priority', 'reassign_group', 'reassign_technician', 'send_alert')),
    action_value TEXT NOT NULL, -- Target priority ('5'), Group UUID, Technician UUID, or recipient ('supervisor' / 'assigned_tech')
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_levels_sla_id ON sla_levels(sla_id);

-- 6. Ticket SLA Escalations Log (Strict single-execution idempotency tracking)
CREATE TABLE IF NOT EXISTS ticket_sla_escalations_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sla_level_id UUID NOT NULL REFERENCES sla_levels(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type VARCHAR(30) NOT NULL,
    action_details TEXT,
    UNIQUE (ticket_id, sla_level_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_sla_log_ticket ON ticket_sla_escalations_log(ticket_id);

-- 7. Cross-Cutting Integration: Tickets (Service Desk)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_id UUID REFERENCES slas(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS time_to_own TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_tto_status VARCHAR(25) NOT NULL DEFAULT 'pending' CHECK (sla_tto_status IN ('pending', 'within_sla', 'breached'));
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_ttr_status VARCHAR(25) NOT NULL DEFAULT 'within_sla' CHECK (sla_ttr_status IN ('within_sla', 'at_risk', 'breached', 'solved_in_sla'));

CREATE INDEX IF NOT EXISTS idx_tickets_sla_id ON tickets(sla_id);
CREATE INDEX IF NOT EXISTS idx_tickets_time_to_own ON tickets(time_to_own);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_tto_status ON tickets(sla_tto_status);
CREATE INDEX IF NOT EXISTS idx_tickets_sla_ttr_status ON tickets(sla_ttr_status);

-- 8. Seed Realistic Default Calendars
INSERT INTO calendars (id, entity_id, name, timezone, is_default)
VALUES 
(
    '00000000-0000-0000-0000-000000000401',
    NULL,
    'Horario Laboral Estándar 9x5',
    'UTC',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000402',
    NULL,
    'Soporte Continuo 24x7',
    'UTC',
    FALSE
)
ON CONFLICT (id) DO NOTHING;

-- Seed Segments for 9x5 Calendar (Mon-Fri 08:00 - 18:00 = 10h/day)
INSERT INTO calendar_segments (calendar_id, day_of_week, start_time, end_time)
VALUES
('00000000-0000-0000-0000-000000000401', 1, '08:00:00', '18:00:00'),
('00000000-0000-0000-0000-000000000401', 2, '08:00:00', '18:00:00'),
('00000000-0000-0000-0000-000000000401', 3, '08:00:00', '18:00:00'),
('00000000-0000-0000-0000-000000000401', 4, '08:00:00', '18:00:00'),
('00000000-0000-0000-0000-000000000401', 5, '08:00:00', '18:00:00');

-- Seed Segments for 24x7 Calendar (Mon-Sun 00:00 - 23:59:59)
INSERT INTO calendar_segments (calendar_id, day_of_week, start_time, end_time)
VALUES
('00000000-0000-0000-0000-000000000402', 1, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 2, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 3, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 4, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 5, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 6, '00:00:00', '23:59:59'),
('00000000-0000-0000-0000-000000000402', 7, '00:00:00', '23:59:59');

-- 9. Seed Realistic Default SLAs
INSERT INTO slas (id, entity_id, name, description, calendar_id, tto_duration_minutes, ttr_duration_minutes, priority_override, is_active)
VALUES
(
    '00000000-0000-0000-0000-000000000411',
    NULL,
    'SLA Platino - Crítico 24x7',
    'Atención inmediata 24x7 para incidentes críticos con afectación de servicios esenciales',
    '00000000-0000-0000-0000-000000000402',
    15,   -- TTO: 15 minutos
    120,  -- TTR: 2 horas
    5,    -- Prioridad P5
    TRUE
),
(
    '00000000-0000-0000-0000-000000000412',
    NULL,
    'SLA Oro - Alta Prioridad',
    'Respuesta prioritaria en horario laboral para incidentes y solicitudes de impacto mayor',
    '00000000-0000-0000-0000-000000000401',
    30,   -- TTO: 30 minutos
    240,  -- TTR: 4 horas laborales
    4,    -- Prioridad P4
    TRUE
),
(
    '00000000-0000-0000-0000-000000000413',
    NULL,
    'SLA Estándar - Operaciones',
    'Nivel de servicio estándar para incidentes cotidianos y solicitudes de servicio regulares',
    '00000000-0000-0000-0000-000000000401',
    120,  -- TTO: 2 horas
    1440, -- TTR: 24 horas laborales (aprox 2.4 días hábiles de 10h)
    3,    -- Prioridad P3
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 10. Seed Realistic Escalation Levels
INSERT INTO sla_levels (id, sla_id, name, target_type, execution_offset_minutes, action_type, action_value)
VALUES
(
    '00000000-0000-0000-0000-000000000421',
    '00000000-0000-0000-0000-000000000411',
    'Alerta Temprana TTR (30m antes)',
    'ttr',
    -30,
    'send_alert',
    'supervisor'
),
(
    '00000000-0000-0000-0000-000000000422',
    '00000000-0000-0000-0000-000000000411',
    'Vencimiento Crítico TTR - Reasignación a Infraestructura & Redes',
    'ttr',
    0,
    'reassign_group',
    '00000000-0000-0000-0000-000000000202' -- Infraestructura & Redes
),
(
    '00000000-0000-0000-0000-000000000423',
    '00000000-0000-0000-0000-000000000412',
    'Alerta Previa TTR Oro (60m antes)',
    'ttr',
    -60,
    'send_alert',
    'supervisor'
),
(
    '00000000-0000-0000-0000-000000000424',
    '00000000-0000-0000-0000-000000000412',
    'Vencimiento TTR Oro - Escalamiento a Prioridad 5 (Crítica)',
    'ttr',
    0,
    'escalate_priority',
    '5'
)
ON CONFLICT (id) DO NOTHING;

-- 11. Seed Notification Templates and Events for SLAs
INSERT INTO notification_templates (id, name, item_type, subject_template, html_template, text_template, css_styles, is_active)
VALUES
(
    '00000000-0000-0000-0000-000000000316',
    'Plantilla Alerta Riesgo SLA (Pre-aviso)',
    'ticket',
    '[ALERTA SLA] Plazo de resolución próximo a vencer en Ticket ###TICKET.ID##: ##TICKET.NAME##',
    '<div class="header"><h3>Alerta de Riesgo SLA</h3><p>El ticket ##TICKET.ID## está por superar el tiempo objetivo comprometido.</p></div><div class="content"><p><strong>Título:</strong> ##TICKET.NAME##</p><p><strong>Prioridad:</strong> P##TICKET.PRIORITY##</p><p><strong>Límite SLA:</strong> ##TICKET.TIME_TO_RESOLVE##</p><p>Por favor revise y priorice la atención inmediatamente.</p></div>',
    'ALERTA DE RIESGO SLA: Ticket ##TICKET.ID## - ##TICKET.NAME## próximo a vencer plazo comprometido.',
    'body { font-family: sans-serif; } .header { background: #d97706; color: white; padding: 10px; }',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000317',
    'Plantilla Vencimiento e Incumplimiento SLA',
    'ticket',
    '[SLA VENCIDO] Incumplimiento de Acuerdo de Nivel en Ticket ###TICKET.ID##: ##TICKET.NAME##',
    '<div class="header" style="background: #dc2626;"><h3>Incumplimiento de SLA</h3><p>El ticket ##TICKET.ID## ha superado su plazo máximo de atención o resolución.</p></div><div class="content"><p><strong>Título:</strong> ##TICKET.NAME##</p><p><strong>Prioridad:</strong> P##TICKET.PRIORITY##</p><p>Se han activado las acciones de escalamiento automático correspondientes.</p></div>',
    'SLA VENCIDO: Ticket ##TICKET.ID## - ##TICKET.NAME## ha superado su plazo permitido.',
    'body { font-family: sans-serif; } .header { background: #dc2626; color: white; padding: 10px; }',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_events (id, event_key, name, template_id, recipients)
VALUES
(
    '00000000-0000-0000-0000-000000000326',
    'sla_warning_ttr',
    'Alerta Pre-Vencimiento de SLA',
    '00000000-0000-0000-0000-000000000316',
    '["technician"]'::jsonb
),
(
    '00000000-0000-0000-0000-000000000327',
    'sla_breached_ttr',
    'Vencimiento e Incumplimiento de SLA',
    '00000000-0000-0000-0000-000000000317',
    '["technician"]'::jsonb
)
ON CONFLICT (event_key) DO NOTHING;

-- 12. Retroactively Associate Existing Tickets with Appropriate Default SLA
UPDATE tickets
SET 
    sla_id = CASE 
        WHEN priority >= 5 THEN '00000000-0000-0000-0000-000000000411'::uuid
        WHEN priority = 4 THEN '00000000-0000-0000-0000-000000000412'::uuid
        ELSE '00000000-0000-0000-0000-000000000413'::uuid
    END,
    time_to_own = COALESCE(time_to_own, created_at + INTERVAL '30 minutes'),
    acknowledged_at = CASE 
        WHEN assigned_technician_id IS NOT NULL OR assigned_group_id IS NOT NULL THEN created_at + INTERVAL '5 minutes'
        ELSE NULL
    END,
    sla_tto_status = CASE
        WHEN assigned_technician_id IS NOT NULL OR assigned_group_id IS NOT NULL THEN 'within_sla'
        WHEN created_at + INTERVAL '30 minutes' < NOW() THEN 'breached'
        ELSE 'pending'
    END,
    sla_ttr_status = CASE
        WHEN status IN ('solved', 'closed') THEN 'solved_in_sla'
        WHEN time_to_resolve < NOW() THEN 'breached'
        WHEN time_to_resolve - NOW() < INTERVAL '2 hours' THEN 'at_risk'
        ELSE 'within_sla'
    END
WHERE sla_id IS NULL;
