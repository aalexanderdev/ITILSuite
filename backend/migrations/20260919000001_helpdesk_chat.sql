-- Migration: 20260919000001_helpdesk_chat.sql
-- Subsystem: Native HelpdeskChat Core Integration (inspired by @aalexanderdev/helpdesk-chat)

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255),
    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    is_self BOOLEAN NOT NULL DEFAULT FALSE,
    self_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_entity ON chat_conversations(entity_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_self ON chat_conversations(self_user_id) WHERE is_self = TRUE;

-- 2. Conversation Participants & Unread tracking
CREATE TABLE IF NOT EXISTS chat_conversation_users (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ,
    last_typing_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_users_user ON chat_conversation_users(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conv_users_featured ON chat_conversation_users(user_id, is_featured) WHERE is_featured = TRUE;

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    link_url VARCHAR(500),
    attachment_name VARCHAR(255),
    attachment_url TEXT,
    attachment_size BIGINT,
    attachment_mime VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- 4. Message to Ticket Bi-directional Link
CREATE TABLE IF NOT EXISTS chat_message_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL UNIQUE REFERENCES chat_messages(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    converted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_tickets_ticket ON chat_message_tickets(ticket_id);

-- 5. Message Reactions Table
CREATE TABLE IF NOT EXISTS chat_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_chat_message_user_emoji UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_message_reactions(message_id);

-- 6. User Presences & Active Session Tracking
CREATE TABLE IF NOT EXISTS chat_presences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_seconds INT NOT NULL DEFAULT 0
);

-- 7. Connected Time Intervals (For Gantt / Connected Hours Report)
CREATE TABLE IF NOT EXISTS chat_session_intervals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_seconds INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_session_intervals_user_date ON chat_session_intervals(user_id, session_date);

-- 8. Shortcut Floating Buttons
CREATE TABLE IF NOT EXISTS chat_shortcut_buttons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ranking INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Chat Global and Entity Settings
CREATE TABLE IF NOT EXISTS chat_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    launcher_color VARCHAR(20) NOT NULL DEFAULT '#EB4D3D',
    bubble_color VARCHAR(20) NOT NULL DEFAULT '#EB4D3D',
    panel_width_px INT NOT NULL DEFAULT 380,
    max_message_length INT NOT NULL DEFAULT 2000,
    ticket_conversion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allow_attachments BOOLEAN NOT NULL DEFAULT TRUE,
    max_attachment_size_mb INT NOT NULL DEFAULT 10,
    auto_notify_ticket_events BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Seed Initial Data
DO $$
DECLARE
    root_ent_id UUID;
    admin_usr_id UUID;
    tech_usr_id UUID;
    ti_conv_id UUID;
    soporte_conv_id UUID;
    admin_self_conv_id UUID;
    msg_1_id UUID;
    msg_2_id UUID;
    msg_3_id UUID;
BEGIN
    SELECT id INTO root_ent_id FROM entities WHERE parent_id IS NULL LIMIT 1;
    SELECT id INTO admin_usr_id FROM users WHERE username = 'admin' LIMIT 1;

    -- Find existing technician (juan_tech)
    SELECT id INTO tech_usr_id FROM users WHERE username = 'juan_tech' OR email = 'juan.perez@itilsuite.local' LIMIT 1;
    IF tech_usr_id IS NULL THEN
        INSERT INTO users (username, password_hash, email, firstname, realname, is_active)
        VALUES ('juan_tech', '$argon2id$v=19$m=19456,t=2,p=1$fake$fake', 'juan.perez@itilsuite.local', 'Juan', 'Pérez', TRUE)
        RETURNING id INTO tech_usr_id;
    END IF;

    IF root_ent_id IS NOT NULL AND admin_usr_id IS NOT NULL THEN
        -- Insert Default Chat Settings
        INSERT INTO chat_settings (entity_id, launcher_color, bubble_color, panel_width_px, max_message_length, ticket_conversion_enabled, allow_attachments, max_attachment_size_mb, auto_notify_ticket_events)
        VALUES (root_ent_id, '#EB4D3D', '#EB4D3D', 380, 2000, TRUE, TRUE, 10, TRUE)
        ON CONFLICT DO NOTHING;

        -- Insert Shortcut Buttons
        INSERT INTO chat_shortcut_buttons (entity_id, label, url, is_active, ranking)
        VALUES 
            (root_ent_id, 'Portal de Autoservicio', 'http://localhost:5173', TRUE, 1),
            (root_ent_id, 'Base de Conocimiento ITIL', 'https://itil.wiki', TRUE, 2)
        ON CONFLICT DO NOTHING;

        -- Group Channel 1: Tecnología e Infraestructura (TI)
        INSERT INTO chat_conversations (entity_id, name, is_group, is_self)
        VALUES (root_ent_id, 'Tecnología e Infraestructura (TI)', TRUE, FALSE)
        RETURNING id INTO ti_conv_id;

        INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
        VALUES (ti_conv_id, admin_usr_id, TRUE);
        IF tech_usr_id IS NOT NULL THEN
            INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
            VALUES (ti_conv_id, tech_usr_id, FALSE);
        END IF;

        -- Group Channel 2: Soporte & Mesa de Ayuda N1
        INSERT INTO chat_conversations (entity_id, name, is_group, is_self)
        VALUES (root_ent_id, 'Mesa de Ayuda N1', TRUE, FALSE)
        RETURNING id INTO soporte_conv_id;

        INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
        VALUES (soporte_conv_id, admin_usr_id, FALSE);
        IF tech_usr_id IS NOT NULL THEN
            INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
            VALUES (soporte_conv_id, tech_usr_id, TRUE);
        END IF;

        -- Admin Personal System Notifications stream (is_self = true)
        INSERT INTO chat_conversations (entity_id, name, is_group, is_self, self_user_id)
        VALUES (root_ent_id, 'Notificaciones del Sistema', FALSE, TRUE, admin_usr_id)
        RETURNING id INTO admin_self_conv_id;

        INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
        VALUES (admin_self_conv_id, admin_usr_id, FALSE);

        -- Seed initial messages in TI channel
        INSERT INTO chat_messages (conversation_id, user_id, content, created_at)
        VALUES (ti_conv_id, admin_usr_id, 'Bienvenidos al nuevo subsistema HelpdeskChat nativo de ITILSuite en Rust + WebSockets.', NOW() - INTERVAL '15 minutes')
        RETURNING id INTO msg_1_id;

        IF tech_usr_id IS NOT NULL THEN
            INSERT INTO chat_messages (conversation_id, user_id, content, created_at)
            VALUES (ti_conv_id, tech_usr_id, 'Excelente! El tiempo de respuesta es instantáneo gracias a Axum y Tokio.', NOW() - INTERVAL '10 minutes')
            RETURNING id INTO msg_2_id;

            -- Reaction on message
            INSERT INTO chat_message_reactions (message_id, user_id, emoji)
            VALUES (msg_1_id, tech_usr_id, '👍');
            INSERT INTO chat_message_reactions (message_id, user_id, emoji)
            VALUES (msg_2_id, admin_usr_id, '🚀');
        END IF;

        -- Seed initial notification message
        INSERT INTO chat_messages (conversation_id, user_id, content, link_url, created_at)
        VALUES (admin_self_conv_id, NULL, 'Sistema ITILSuite v0.0.4 iniciado con éxito. Módulo HelpdeskChat conectado.', 'http://localhost:5173', NOW() - INTERVAL '25 minutes')
        RETURNING id INTO msg_3_id;

        -- Seed initial presence
        INSERT INTO chat_presences (user_id, status, last_seen, active_seconds)
        VALUES 
            (admin_usr_id, 'online', NOW(), 1800)
        ON CONFLICT (user_id) DO UPDATE SET status = 'online', last_seen = NOW();

        IF tech_usr_id IS NOT NULL THEN
            INSERT INTO chat_presences (user_id, status, last_seen, active_seconds)
            VALUES (tech_usr_id, 'online', NOW(), 1240)
            ON CONFLICT (user_id) DO UPDATE SET status = 'online', last_seen = NOW();

            -- Seed sample session interval
            INSERT INTO chat_session_intervals (user_id, session_date, start_time, end_time, duration_seconds)
            VALUES 
                (admin_usr_id, CURRENT_DATE, NOW() - INTERVAL '2 hours', NOW(), 7200),
                (tech_usr_id, CURRENT_DATE, NOW() - INTERVAL '1 hour', NOW(), 3600);
        END IF;
    END IF;
END $$;
