-- 20260917000001_notifications_and_receivers.sql
-- Subsystem: Mail Receivers (Collectors), Notifications Engine, and Queued Delivery (Inspired by GLPI 11)

-- 1. Create Mail Settings (Global and Per-Entity Overrides)
CREATE TABLE IF NOT EXISTS mail_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_followups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    admin_email VARCHAR(255) NOT NULL DEFAULT 'admin@itilsuite.local',
    admin_name VARCHAR(150) NOT NULL DEFAULT 'Administrador ITILSuite',
    from_email VARCHAR(255) NOT NULL DEFAULT 'helpdesk@itilsuite.local',
    from_name VARCHAR(150) NOT NULL DEFAULT 'Mesa de Ayuda ITILSuite',
    reply_to_email VARCHAR(255) NOT NULL DEFAULT 'soporte@itilsuite.local',
    smtp_host VARCHAR(255) NOT NULL DEFAULT 'localhost',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_encryption VARCHAR(20) NOT NULL DEFAULT 'tls' CHECK (smtp_encryption IN ('none', 'ssl', 'tls')),
    smtp_username VARCHAR(150) NOT NULL DEFAULT '',
    smtp_password VARCHAR(255) NOT NULL DEFAULT '',
    subject_prefix VARCHAR(50) NOT NULL DEFAULT '[ITILSuite]',
    email_signature TEXT NOT NULL DEFAULT E'--\nMesa de Servicios TI | ITILSuite\nSistema de Gestión de Servicios e Incidentes',
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_interval_minutes INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Notification Templates (Gabarits de notification)
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL UNIQUE,
    item_type VARCHAR(50) NOT NULL DEFAULT 'Ticket',
    subject_template VARCHAR(255) NOT NULL,
    html_template TEXT NOT NULL,
    text_template TEXT NOT NULL,
    css_styles TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Notification Events (Notification Definitions)
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    template_id UUID NOT NULL REFERENCES notification_templates(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    recipients JSONB NOT NULL DEFAULT '["requester", "technician"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Queued Notifications (queuednotification)
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(50) NOT NULL,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(150),
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create Mail Receivers (Collecteurs IMAP/POP3)
CREATE TABLE IF NOT EXISTS mail_receivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    protocol VARCHAR(20) NOT NULL DEFAULT 'imap' CHECK (protocol IN ('imap', 'pop3')),
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 993,
    ssl_mode VARCHAR(20) NOT NULL DEFAULT 'ssl' CHECK (ssl_mode IN ('none', 'ssl', 'tls')),
    username VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    mail_folder VARCHAR(100) NOT NULL DEFAULT 'INBOX',
    archive_folder VARCHAR(100) DEFAULT 'INBOX.Archive',
    refused_folder VARCHAR(100) DEFAULT 'INBOX.Refused',
    max_attachment_mb INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sync_interval_seconds INTEGER NOT NULL DEFAULT 300,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create Mail Blacklists (Filtres anti-spam / no-reply)
CREATE TABLE IF NOT EXISTS mail_blacklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(30) NOT NULL DEFAULT 'sender_email' CHECK (rule_type IN ('sender_email', 'domain', 'subject_regex')),
    pattern VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created ON notification_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_mail_receivers_entity ON mail_receivers(entity_id);
CREATE INDEX IF NOT EXISTS idx_mail_receivers_is_active ON mail_receivers(is_active);
CREATE INDEX IF NOT EXISTS idx_mail_settings_entity ON mail_settings(entity_id);

-- 8. Seed Default Global Mail Settings
INSERT INTO mail_settings (
    id,
    entity_id,
    notifications_enabled,
    email_followups_enabled,
    admin_email,
    admin_name,
    from_email,
    from_name,
    reply_to_email,
    smtp_host,
    smtp_port,
    smtp_encryption,
    subject_prefix,
    email_signature
) VALUES (
    '00000000-0000-0000-0000-000000000301',
    NULL, -- Global default
    TRUE,
    TRUE,
    'admin@itilsuite.local',
    'Administrador ITILSuite',
    'helpdesk@itilsuite.local',
    'Mesa de Ayuda ITILSuite',
    'soporte@itilsuite.local',
    'smtp.itilsuite.local',
    587,
    'tls',
    '[ITILSuite]',
    E'--\nMesa de Servicios TI | ITILSuite\nSistema de Gestión de Servicios e Incidentes Corporativo'
) ON CONFLICT DO NOTHING;

-- 9. Seed Standard GLPI Notification Templates
INSERT INTO notification_templates (
    id,
    name,
    item_type,
    subject_template,
    html_template,
    text_template
) VALUES 
(
    '00000000-0000-0000-0000-000000000311',
    'Tickets: Nuevo Ticket Creado',
    'Ticket',
    '##ticket.number## - ##ticket.name##',
    E'<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">\n  <h2 style="color:#2563eb; margin-top:0;">Nuevo Ticket Registrado en la Mesa de Ayuda</h2>\n  <p>Hola <strong>##ticket.requester_name##</strong>,</p>\n  <p>Tu solicitud ha sido registrada exitosamente con el código <strong>##ticket.number##</strong>.</p>\n  <table style="width:100%; border-collapse:collapse; margin:15px 0;">\n    <tr><td style="padding:6px; color:#64748b;">Título:</td><td style="padding:6px; font-weight:600;">##ticket.name##</td></tr>\n    <tr><td style="padding:6px; color:#64748b;">Tipo:</td><td style="padding:6px;">##ticket.type##</td></tr>\n    <tr><td style="padding:6px; color:#64748b;">Prioridad:</td><td style="padding:6px; font-weight:600;">P##ticket.priority##</td></tr>\n    <tr><td style="padding:6px; color:#64748b;">Categoría:</td><td style="padding:6px;">##ticket.category##</td></tr>\n  </table>\n  <div style="background:#f8fafc; padding:12px; border-radius:6px; border-left:3px solid #2563eb; margin-bottom:15px;">\n    <strong>Descripción:</strong>\n    <p style="margin:5px 0 0 0; white-space:pre-wrap;">##ticket.content##</p>\n  </div>\n  <p style="font-size:12px; color:#94a3b8;">Puedes responder directamente a este correo para agregar más detalles al ticket.</p>\n</div>',
    E'Nuevo Ticket Registrado: ##ticket.number##\n\nHola ##ticket.requester_name##,\nTu solicitud ha sido registrada con el código ##ticket.number##.\n\nTítulo: ##ticket.name##\nTipo: ##ticket.type##\nPrioridad: P##ticket.priority##\nCategoría: ##ticket.category##\n\nDescripción:\n##ticket.content##\n\nPuedes responder directamente a este mensaje para agregar seguimiento.'
),
(
    '00000000-0000-0000-0000-000000000312',
    'Tickets: Seguimiento o Tarea Añadida',
    'Ticket',
    'Re: [##ticket.number##] ##ticket.name##',
    E'<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">\n  <h2 style="color:#0891b2; margin-top:0;">Nueva Actualización en Ticket ##ticket.number##</h2>\n  <p>Se ha registrado un nuevo seguimiento de parte de <strong>##author.name##</strong>:</p>\n  <div style="background:#f0f9ff; padding:12px; border-radius:6px; border-left:3px solid #0891b2; margin:15px 0;">\n    <p style="margin:0; white-space:pre-wrap;">##followup.content##</p>\n  </div>\n  <p style="font-size:12px; color:#94a3b8;">Estado actual del ticket: <strong>##ticket.status##</strong> | Técnico asignado: <strong>##ticket.technician_name##</strong></p>\n</div>',
    E'Nueva actualización en Ticket ##ticket.number##\n\nAutor: ##author.name##\n\nSeguimiento:\n##followup.content##\n\nEstado actual: ##ticket.status##\nTécnico asignado: ##ticket.technician_name##'
),
(
    '00000000-0000-0000-0000-000000000313',
    'Tickets: Asignación de Técnico',
    'Ticket',
    '[Asignado] ##ticket.number## a ##ticket.technician_name##',
    E'<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">\n  <h2 style="color:#6366f1; margin-top:0;">Ticket Asignado a Especialista</h2>\n  <p>El ticket <strong>##ticket.number##</strong> ha sido despachado a <strong>##ticket.technician_name##</strong> para su resolución técnica.</p>\n  <p><strong>Título:</strong> ##ticket.name##</p>\n  <p><strong>Prioridad:</strong> P##ticket.priority##</p>\n</div>',
    E'Ticket ##ticket.number## Asignado a Técnico: ##ticket.technician_name##\n\nTítulo: ##ticket.name##\nPrioridad: P##ticket.priority##'
),
(
    '00000000-0000-0000-0000-000000000314',
    'Tickets: Solución Propuesta',
    'Ticket',
    '[Solución] ##ticket.number##: ##ticket.name##',
    E'<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">\n  <h2 style="color:#059669; margin-top:0;">Solución Aplicada a tu Requerimiento</h2>\n  <p>Hola <strong>##ticket.requester_name##</strong>,</p>\n  <p>El técnico <strong>##ticket.technician_name##</strong> ha propuesto la siguiente solución para el ticket <strong>##ticket.number##</strong>:</p>\n  <div style="background:#ecfdf5; padding:12px; border-radius:6px; border-left:3px solid #059669; margin:15px 0;">\n    <p style="margin:0; white-space:pre-wrap;">##followup.content##</p>\n  </div>\n  <p>Por favor confirma si el inconveniente ha quedado solventado a tu satisfacción.</p>\n</div>',
    E'Solución aplicada al ticket ##ticket.number##\n\nHola ##ticket.requester_name##,\nEl técnico ##ticket.technician_name## ha aplicado la solución:\n\n##followup.content##\n\nPor favor confirma si el caso ha sido resuelto satisfactoriamente.'
),
(
    '00000000-0000-0000-0000-000000000315',
    'Tickets: Cierre Administrativo',
    'Ticket',
    '[Cerrado] ##ticket.number##: ##ticket.name##',
    E'<div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #e2e8f0; border-radius:8px;">\n  <h2 style="color:#64748b; margin-top:0;">Ticket Cerrado y Archivado</h2>\n  <p>El ticket <strong>##ticket.number##</strong> ha sido cerrado definitivamente en la Mesa de Ayuda ITILSuite.</p>\n  <p>Gracias por contactar con nuestro soporte técnico.</p>\n</div>',
    E'Ticket ##ticket.number## cerrado definitivamente.\nGracias por comunicarte con el soporte de ITILSuite.'
) ON CONFLICT (name) DO NOTHING;

-- 10. Seed Notification Events (Mapping)
INSERT INTO notification_events (
    id,
    event_key,
    name,
    template_id,
    recipients
) VALUES
(
    '00000000-0000-0000-0000-000000000321',
    'ticket_created',
    'Creación de Nuevo Ticket',
    '00000000-0000-0000-0000-000000000311',
    '["requester", "technician"]'::jsonb
),
(
    '00000000-0000-0000-0000-000000000322',
    'ticket_followup_added',
    'Nuevo Seguimiento en Ticket',
    '00000000-0000-0000-0000-000000000312',
    '["requester", "technician"]'::jsonb
),
(
    '00000000-0000-0000-0000-000000000323',
    'ticket_assigned',
    'Asignación o Despacho de Técnico',
    '00000000-0000-0000-0000-000000000313',
    '["technician"]'::jsonb
),
(
    '00000000-0000-0000-0000-000000000324',
    'ticket_solved',
    'Solución de Ticket Registrada',
    '00000000-0000-0000-0000-000000000314',
    '["requester"]'::jsonb
),
(
    '00000000-0000-0000-0000-000000000325',
    'ticket_closed',
    'Cierre Definitivo de Ticket',
    '00000000-0000-0000-0000-000000000315',
    '["requester"]'::jsonb
) ON CONFLICT (event_key) DO NOTHING;

-- 11. Seed Sample Mail Receivers (Collectors)
INSERT INTO mail_receivers (
    id,
    entity_id,
    name,
    protocol,
    host,
    port,
    ssl_mode,
    username,
    password,
    mail_folder,
    archive_folder,
    refused_folder,
    is_active,
    sync_interval_seconds
) VALUES
(
    '00000000-0000-0000-0000-000000000331',
    '00000000-0000-0000-0000-000000000001', -- Root Entity
    'Colector Central de Mesa de Ayuda (IMAP)',
    'imap',
    'mail.itilsuite.local',
    993,
    'ssl',
    'soporte@itilsuite.local',
    'secret_token_imap',
    'INBOX',
    'INBOX.Processed',
    'INBOX.Spam',
    TRUE,
    180
),
(
    '00000000-0000-0000-0000-000000000332',
    'b9097d11-7267-4fa7-84b4-24b86d0446f2', -- North America Region
    'Colector Sede Norte (POP3)',
    'pop3',
    'mail-na.itilsuite.local',
    995,
    'ssl',
    'helpdesk-na@itilsuite.local',
    'secret_token_pop3',
    'INBOX',
    'INBOX.Archive',
    'INBOX.Refused',
    FALSE,
    300
) ON CONFLICT DO NOTHING;

-- 12. Seed Blacklists (Anti-spam / No-reply rules)
INSERT INTO mail_blacklists (
    id,
    rule_type,
    pattern,
    reason,
    is_active
) VALUES
(
    '00000000-0000-0000-0000-000000000341',
    'sender_email',
    'no-reply@*',
    'Descartar respuestas automáticas de sistemas no interactivos',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000342',
    'sender_email',
    'mailer-daemon@*',
    'Rebote de entrega de correo',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000343',
    'domain',
    '*@spammer.org',
    'Dominio bloqueado por políticas de seguridad',
    TRUE
) ON CONFLICT DO NOTHING;
