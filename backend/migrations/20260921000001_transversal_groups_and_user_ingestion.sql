-- 20260921000001_transversal_groups_and_user_ingestion.sql
-- Subsystem: Transversal Groups Architecture & User Batch Ingestion (Inspired by GLPI 11)

-- 1. Transversal Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL indicates global transversal group
    name VARCHAR(100) NOT NULL,
    comment TEXT,
    is_recursive BOOLEAN NOT NULL DEFAULT TRUE,
    is_task BOOLEAN NOT NULL DEFAULT TRUE,        -- GLPI is_assign: can be assigned tickets / tasks
    is_requester BOOLEAN NOT NULL DEFAULT TRUE,   -- GLPI is_requester: can request tickets
    is_user_group BOOLEAN NOT NULL DEFAULT TRUE,   -- GLPI is_usergroup: can contain members
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_entity_id ON groups(entity_id);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);

-- 2. Group Membership Table (M:N with supervisor/manager role)
CREATE TABLE IF NOT EXISTS group_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_manager BOOLEAN NOT NULL DEFAULT FALSE,     -- GLPI is_manager: supervisor/leader role
    is_user BOOLEAN NOT NULL DEFAULT TRUE,        -- regular member
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_users_group ON group_users(group_id);
CREATE INDEX IF NOT EXISTS idx_group_users_user ON group_users(user_id);
CREATE INDEX IF NOT EXISTS idx_group_users_manager ON group_users(group_id, is_manager) WHERE is_manager = TRUE;

-- 3. Cross-Cutting Integration: Tickets (Service Desk)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assigned_group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_group ON tickets(assigned_group_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester_group ON tickets(requester_group_id);

-- 4. Cross-Cutting Integration: Assets (CMDB)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_assets_group_id ON assets(group_id);

-- 5. Cross-Cutting Integration: HelpdeskChat (Dynamic Group Team Rooms)
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_chat_conversations_group ON chat_conversations(group_id);

-- 6. Seed Realistic Transversal Groups
INSERT INTO groups (id, entity_id, name, comment, is_recursive, is_task, is_requester, is_user_group)
VALUES
(
    '00000000-0000-0000-0000-000000000201',
    NULL,
    'Soporte Nivel 1',
    'Equipo de primera línea para atención de incidentes y solicitudes de usuarios',
    TRUE,
    TRUE,
    FALSE,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000202',
    NULL,
    'Infraestructura & Redes',
    'Especialistas en conectividad, enlaces de fibra, routers, conmutadores y servidores físicos',
    TRUE,
    TRUE,
    FALSE,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000203',
    NULL,
    'Desarrollo & Sistemas',
    'Ingeniería de software, bases de datos corporativas e integraciones API',
    TRUE,
    TRUE,
    TRUE,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000204',
    NULL,
    'Recursos Humanos',
    'Departamento de personas y cultura organizacional (grupo solicitante)',
    TRUE,
    FALSE,
    TRUE,
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 7. Seed Group Memberships
-- Juan Tech -> Soporte Nivel 1 (Manager), Infraestructura & Redes (Member)
INSERT INTO group_users (group_id, user_id, is_manager, is_user)
VALUES
(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    TRUE,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    FALSE,
    TRUE
)
ON CONFLICT (group_id, user_id) DO NOTHING;

-- María Admin -> Infraestructura & Redes (Manager), Desarrollo & Sistemas (Manager)
INSERT INTO group_users (group_id, user_id, is_manager, is_user)
VALUES
(
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000102',
    TRUE,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000102',
    TRUE,
    TRUE
)
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Carlos User -> Recursos Humanos (Manager)
INSERT INTO group_users (group_id, user_id, is_manager, is_user)
VALUES
(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000103',
    TRUE,
    TRUE
)
ON CONFLICT (group_id, user_id) DO NOTHING;

-- 8. Synchronize Group Chat Conversations in HelpdeskChat
INSERT INTO chat_conversations (id, entity_id, name, is_group, is_self, group_id)
VALUES
(
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    '#soporte-nivel-1',
    TRUE,
    FALSE,
    '00000000-0000-0000-0000-000000000201'
),
(
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    '#infraestructura-redes',
    TRUE,
    FALSE,
    '00000000-0000-0000-0000-000000000202'
),
(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000001',
    '#desarrollo-sistemas',
    TRUE,
    FALSE,
    '00000000-0000-0000-0000-000000000203'
)
ON CONFLICT (id) DO NOTHING;

-- Enroll group members into the chat conversations
INSERT INTO chat_conversation_users (conversation_id, user_id, is_featured)
VALUES
('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', TRUE),
('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000101', FALSE),
('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', TRUE),
('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000102', TRUE)
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- 9. Update initial sample tickets with assigned groups
UPDATE tickets 
SET assigned_group_id = '00000000-0000-0000-0000-000000000201'
WHERE ticket_number = 'INC-2026-0001' AND assigned_group_id IS NULL;

UPDATE tickets 
SET assigned_group_id = '00000000-0000-0000-0000-000000000202'
WHERE ticket_number = 'REQ-2026-0002' AND assigned_group_id IS NULL;
