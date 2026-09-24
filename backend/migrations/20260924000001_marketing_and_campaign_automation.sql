-- Migration: 20260924000001_marketing_and_campaign_automation.sql
-- Description: Mautic-inspired Marketing, Audience Segmentation, and Campaign Automation subsystem for ITILSuite

-- 1. Marketing Contacts & Leads Directory
CREATE TABLE IF NOT EXISTS marketing_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional bridge to internal ITSM users
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    company VARCHAR(150) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL DEFAULT '',
    stage VARCHAR(50) NOT NULL DEFAULT 'lead', -- 'lead', 'prospect', 'customer', 'champion', 'inactive'
    points INTEGER NOT NULL DEFAULT 0, -- Lead scoring
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
    unsubscribed_at TIMESTAMPTZ,
    custom_attributes JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_contacts_entity ON marketing_contacts(entity_id);
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_email ON marketing_contacts(email);
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_stage ON marketing_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_points ON marketing_contacts(points);
CREATE INDEX IF NOT EXISTS idx_marketing_contacts_tags ON marketing_contacts USING GIN (tags);

-- 2. Audience Segments (Dynamic and Static Lists)
CREATE TABLE IF NOT EXISTS marketing_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_dynamic BOOLEAN NOT NULL DEFAULT TRUE,
    filter_criteria JSONB NOT NULL DEFAULT '[]', -- Array of rule objects: [{"field": "points", "operator": "gte", "value": "10"}, ...]
    cached_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_segments_entity ON marketing_segments(entity_id);

-- 3. Segment Contacts Join Table (for static membership or snapshot caching)
CREATE TABLE IF NOT EXISTS marketing_segment_contacts (
    segment_id UUID NOT NULL REFERENCES marketing_segments(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES marketing_contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (segment_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_contacts_contact ON marketing_segment_contacts(contact_id);

-- 4. Marketing Email Templates (Gabarits de Campagne)
CREATE TABLE IF NOT EXISTS marketing_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT NOT NULL DEFAULT '',
    from_name VARCHAR(100) NOT NULL DEFAULT 'ITILSuite Communications',
    from_email VARCHAR(255) NOT NULL DEFAULT 'no-reply@itilsuite.local',
    reply_to VARCHAR(255) NOT NULL DEFAULT 'soporte@itilsuite.local',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_emails_entity ON marketing_emails(entity_id);

-- 5. Marketing Campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    segment_id UUID REFERENCES marketing_segments(id) ON DELETE SET NULL,
    email_id UUID REFERENCES marketing_emails(id) ON DELETE SET NULL,
    campaign_type VARCHAR(50) NOT NULL DEFAULT 'broadcast', -- 'broadcast', 'drip_sequence', 'event_triggered'
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'paused', 'completed'
    workflow_graph JSONB NOT NULL DEFAULT '[]', -- Sequential steps: [{"step": 1, "type": "send_email", "email_id": "..."}, {"step": 2, "type": "delay", "hours": 48}, {"step": 3, "type": "condition", "check": "opened", "on_true": "add_points:10", "on_false": "send_reminder"}]
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER NOT NULL DEFAULT 0,
    total_delivered INTEGER NOT NULL DEFAULT 0,
    total_opened INTEGER NOT NULL DEFAULT 0,
    total_clicked INTEGER NOT NULL DEFAULT 0,
    total_bounced INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_entity ON marketing_campaigns(entity_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);

-- 6. Individual Campaign Deliveries with Tracking Tokens
CREATE TABLE IF NOT EXISTS marketing_campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES marketing_contacts(id) ON DELETE CASCADE,
    tracking_token VARCHAR(64) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'opened', 'clicked', 'bounced', 'unsubscribed'
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    open_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_campaign ON marketing_campaign_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_contact ON marketing_campaign_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_token ON marketing_campaign_deliveries(tracking_token);
CREATE INDEX IF NOT EXISTS idx_campaign_deliveries_status ON marketing_campaign_deliveries(status);

-- 7. Link Clicks Audit Log
CREATE TABLE IF NOT EXISTS marketing_link_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES marketing_campaign_deliveries(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_delivery ON marketing_link_clicks(delivery_id);

-- 8. Seed Initial Data for Ready-to-Use Experience
DO $$
DECLARE
    root_ent_id UUID;
    seg_all_id UUID;
    seg_vip_id UUID;
    email_maintenance_id UUID;
    email_welcome_id UUID;
    campaign_sample_id UUID;
    contact_1_id UUID;
    contact_2_id UUID;
    contact_3_id UUID;
BEGIN
    SELECT id INTO root_ent_id FROM entities WHERE parent_id IS NULL LIMIT 1;
    IF root_ent_id IS NULL THEN
        root_ent_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;

    -- Seed Initial Contacts
    INSERT INTO marketing_contacts (id, entity_id, email, first_name, last_name, company, stage, points, tags)
    VALUES
        ('11111111-0000-0000-0000-000000000001'::uuid, root_ent_id, 'carlos.mendoza@empresa.com', 'Carlos', 'Mendoza', 'Finanzas Global S.A.', 'customer', 45, ARRAY['vip', 'finanzas', 'decision-maker']),
        ('11111111-0000-0000-0000-000000000002'::uuid, root_ent_id, 'lucia.valdez@tecnologia.io', 'Lucía', 'Valdez', 'Cloud Innovations', 'prospect', 20, ARRAY['it', 'tecnologia']),
        ('11111111-0000-0000-0000-000000000003'::uuid, root_ent_id, 'martin.ramos@logistica.net', 'Martín', 'Ramos', 'Logística Express', 'lead', 10, ARRAY['operaciones'])
    ON CONFLICT (id) DO NOTHING;

    -- Seed Audience Segments
    INSERT INTO marketing_segments (id, entity_id, name, description, is_dynamic, filter_criteria, cached_count)
    VALUES
        ('22222222-0000-0000-0000-000000000001'::uuid, root_ent_id, 'Todos los Contactos Activos', 'Audiencia global de todos los contactos suscritos a boletines de servicio', TRUE, '[{"field": "is_unsubscribed", "operator": "equals", "value": "false"}]'::jsonb, 3),
        ('22222222-0000-0000-0000-000000000002'::uuid, root_ent_id, 'Clientes VIP & Alta Prioridad', 'Usuarios con puntuación >= 20 o tag VIP', TRUE, '[{"field": "points", "operator": "gte", "value": "20"}]'::jsonb, 2)
    ON CONFLICT (id) DO NOTHING;

    -- Seed Email Templates
    INSERT INTO marketing_emails (id, entity_id, name, subject, body_html, body_text)
    VALUES
        (
            '33333333-0000-0000-0000-000000000001'::uuid,
            root_ent_id,
            'Aviso de Mantenimiento de Infraestructura',
            '📢 [Aviso ITIL] Ventana de Mantenimiento Programado en Servidores Centrales',
            '<h2>Estimado/a {{contact.first_name}},</h2><p>Le informamos que el próximo fin de semana se realizará una <strong>ventana de mantenimiento preventivo</strong> en nuestros centros de datos centrales.</p><p>Servicios afectados temporalmente: <em>Acceso VPN y Sistemas ERP</em>.</p><p><a href="https://itilsuite.local/status" style="background-color: #f59e0b; color: #111; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Estado de Servicios en Vivo</a></p><p>Para dudas, puede comunicarse directamente con la mesa de servicio.</p><hr><p style="font-size: 12px; color: #888;">Si no desea recibir estos boletines informativos, puede <a href="{{unsubscribe_url}}">darse de baja aquí</a>.</p>{{tracking_pixel}}',
            'Estimado/a {{contact.first_name}}, le informamos que el próximo fin de semana se realizará una ventana de mantenimiento preventivo. Ver estado: https://itilsuite.local/status'
        ),
        (
            '33333333-0000-0000-0000-000000000002'::uuid,
            root_ent_id,
            'Bienvenida y Guía de Autoservicio TI',
            '👋 Bienvenido a ITILSuite: Guía rápida para gestionar tus solicitudes de TI',
            '<h2>¡Hola {{contact.first_name}}!</h2><p>Bienvenido al nuevo portal unificado de <strong>ITILSuite</strong> de {{contact.company}}.</p><p>Ahora puedes solicitar equipos, reportar incidentes y realizar seguimiento en tiempo real con un solo clic.</p><p><a href="https://itilsuite.local/portal" style="background-color: #3b82f6; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold;">Acceder al Portal de Autoservicio</a></p><hr><p style="font-size: 12px; color: #888;">Para cancelar la suscripción, haga <a href="{{unsubscribe_url}}">clic aquí</a>.</p>{{tracking_pixel}}',
            'Hola {{contact.first_name}}, bienvenido al nuevo portal unificado de ITILSuite. Accede en: https://itilsuite.local/portal'
        )
    ON CONFLICT (id) DO NOTHING;

    -- Seed Sample Campaign
    INSERT INTO marketing_campaigns (id, entity_id, name, description, segment_id, email_id, campaign_type, status, total_recipients, total_delivered, total_opened, total_clicked)
    VALUES
        (
            '44444444-0000-0000-0000-000000000001'::uuid,
            root_ent_id,
            'Campaña: Notificación Ventana Mantenimiento Q3',
            'Comunicado masivo a todos los usuarios activos sobre la actualización de clusters de virtualización',
            '22222222-0000-0000-0000-000000000001'::uuid,
            '33333333-0000-0000-0000-000000000001'::uuid,
            'broadcast',
            'completed',
            3,
            3,
            2,
            1
        )
    ON CONFLICT (id) DO NOTHING;

    -- Seed sample deliveries for statistics demo
    INSERT INTO marketing_campaign_deliveries (id, campaign_id, contact_id, tracking_token, status, sent_at, opened_at, clicked_at, open_count, click_count)
    VALUES
        ('55555555-0000-0000-0000-000000000001'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000001'::uuid, 'tok_demo_carlos_mendoza_q3_open_click', 'clicked', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '80 minutes', 3, 1),
        ('55555555-0000-0000-0000-000000000002'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000002'::uuid, 'tok_demo_lucia_valdez_q3_opened_only', 'opened', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '45 minutes', NULL, 1, 0),
        ('55555555-0000-0000-0000-000000000003'::uuid, '44444444-0000-0000-0000-000000000001'::uuid, '11111111-0000-0000-0000-000000000003'::uuid, 'tok_demo_martin_ramos_q3_delivered_pending', 'sent', NOW() - INTERVAL '2 hours', NULL, NULL, 0, 0)
    ON CONFLICT (id) DO NOTHING;

    -- Seed sample click
    INSERT INTO marketing_link_clicks (id, delivery_id, target_url, ip_address, user_agent, clicked_at)
    VALUES
        ('66666666-0000-0000-0000-000000000001'::uuid, '55555555-0000-0000-0000-000000000001'::uuid, 'https://itilsuite.local/status', '192.168.1.105', 'Mozilla/5.0 (X11; Linux x86_64)', NOW() - INTERVAL '80 minutes')
    ON CONFLICT (id) DO NOTHING;

END $$;
