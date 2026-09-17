-- 20260916000001_service_desk_tickets.sql: ITIL Service Desk (Tickets, Follow-ups, Priority Matrix)

-- 1. Create Tickets Table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    ticket_type VARCHAR(20) NOT NULL DEFAULT 'incident' CHECK (ticket_type IN ('incident', 'request')),
    status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'planned', 'pending', 'solved', 'closed')),
    urgency INTEGER NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
    impact INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(100),
    time_to_resolve TIMESTAMPTZ,
    solved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Ticket Follow-ups / Timeline / Solutions Table
CREATE TABLE IF NOT EXISTS ticket_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    item_type VARCHAR(30) NOT NULL DEFAULT 'followup' CHECK (item_type IN ('followup', 'task', 'solution')),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_tickets_entity_id ON tickets(entity_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_tech ON tickets(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_ticket_followups_ticket_id ON ticket_followups(ticket_id);

-- 4. Seed Additional Realistic Users for Dispatching (Technicians and Requester)
-- Passwords are all hashed with Argon2id for 'admin'
INSERT INTO users (id, username, password_hash, email, realname, firstname, is_active)
VALUES 
(
    '00000000-0000-0000-0000-000000000101',
    'juan_tech',
    '$argon2id$v=19$m=19456,t=2,p=1$4bosHLLSif2zntA3ANAT+A$fiXYewqCu7tLESEzQweUJ8zboBa/MA7dvon/czJooiQ',
    'juan.perez@itilsuite.local',
    'Pérez',
    'Juan',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000102',
    'maria_tech',
    '$argon2id$v=19$m=19456,t=2,p=1$4bosHLLSif2zntA3ANAT+A$fiXYewqCu7tLESEzQweUJ8zboBa/MA7dvon/czJooiQ',
    'maria.rodriguez@itilsuite.local',
    'Rodríguez',
    'María',
    TRUE
),
(
    '00000000-0000-0000-0000-000000000103',
    'carlos_user',
    '$argon2id$v=19$m=19456,t=2,p=1$4bosHLLSif2zntA3ANAT+A$fiXYewqCu7tLESEzQweUJ8zboBa/MA7dvon/czJooiQ',
    'carlos.mendez@itilsuite.local',
    'Méndez',
    'Carlos',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Link Profiles to Entities
-- Juan: Technician profile on Root Entity
INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
VALUES (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    TRUE
) ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING;

-- Maria: Technician profile on Root Entity
INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
VALUES (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000001',
    TRUE
) ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING;

-- Carlos: Self-Service profile on Root Entity
INSERT INTO user_profiles_entities (user_id, profile_id, entity_id, is_recursive)
VALUES (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000001',
    TRUE
) ON CONFLICT (user_id, profile_id, entity_id) DO NOTHING;

-- 5. Seed Realistic Sample ITIL Tickets & Followups
INSERT INTO tickets (
    id, ticket_number, entity_id, name, content, ticket_type, status,
    urgency, impact, priority, requester_id, assigned_technician_id,
    category, time_to_resolve, created_at, updated_at
) VALUES
(
    '00000000-0000-0000-0000-000000000201',
    'INC-2026-0001',
    '00000000-0000-0000-0000-000000000001',
    'Caída total del enlace troncal de fibra óptica principal',
    'Se detecta pérdida del 100% de paquetes hacia el Gateway de salida de la sede central. Servicios críticos incomunicados.',
    'incident',
    'assigned',
    5, 5, 5,
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    'Redes / Telecomunicaciones',
    NOW() + INTERVAL '2 hours',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour'
),
(
    '00000000-0000-0000-0000-000000000202',
    'INC-2026-0002',
    '00000000-0000-0000-0000-000000000001',
    'Alerta de degradación en almacenamiento SAN y fallos en snapshot',
    'La controladora B del enclosure SAN reporta latencias de I/O superiores a 250ms afectando las bases de datos de producción.',
    'incident',
    'planned',
    4, 4, 4,
    '00000000-0000-0000-0000-000000000100',
    '00000000-0000-0000-0000-000000000102',
    'Servidores & Storage',
    NOW() + INTERVAL '6 hours',
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '2 hours'
),
(
    '00000000-0000-0000-0000-000000000203',
    'REQ-2026-0003',
    '00000000-0000-0000-0000-000000000001',
    'Solicitud de aprovisionamiento de Laptop Corporativa para nuevo ingreso',
    'Se requiere una estación de trabajo móvil con Linux/Rust y doble monitor para incorporación de desarrollador el próximo lunes.',
    'request',
    'new',
    3, 2, 2,
    '00000000-0000-0000-0000-000000000103',
    NULL,
    'Hardware / Equipos',
    NOW() + INTERVAL '48 hours',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),
(
    '00000000-0000-0000-0000-000000000204',
    'REQ-2026-0004',
    '00000000-0000-0000-0000-000000000001',
    'Renovación y asignación de licencia JetBrains All Products Pack',
    'La suscripción anual expiró ayer. Requiere activación en el panel corporativo para continuar labores de backend.',
    'request',
    'solved',
    2, 2, 2,
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    'Software / Licencias',
    NOW() + INTERVAL '24 hours',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '4 hours'
),
(
    '00000000-0000-0000-0000-000000000205',
    'INC-2026-0005',
    '00000000-0000-0000-0000-000000000001',
    'Impresora de etiquetas térmica no responde en Bodega y Logística',
    'El equipo Zebra ZT410 reporta error de cabezal y atasco persistente impidiendo el despacho de pedidos.',
    'incident',
    'pending',
    3, 3, 3,
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000102',
    'Hardware / Periféricos',
    NOW() + INTERVAL '12 hours',
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '30 minutes'
),
(
    '00000000-0000-0000-0000-000000000206',
    'INC-2026-0006',
    '00000000-0000-0000-0000-000000000001',
    'Bloqueo de credenciales de usuario por intentos fallidos en VPN',
    'El colaborador intentó ingresar 5 veces con token caducado, causando el bloqueo de seguridad en el Directorio Activo.',
    'incident',
    'closed',
    4, 2, 3,
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000101',
    'Acceso & Seguridad',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- Update solved_at and closed_at for the solved and closed tickets
UPDATE tickets SET solved_at = NOW() - INTERVAL '4 hours' WHERE id = '00000000-0000-0000-0000-000000000204';
UPDATE tickets SET solved_at = NOW() - INTERVAL '2 days', closed_at = NOW() - INTERVAL '2 days' WHERE id = '00000000-0000-0000-0000-000000000206';

-- 6. Seed Timeline Follow-ups and Solutions
INSERT INTO ticket_followups (id, ticket_id, author_id, content, item_type, is_private, created_at)
VALUES
(
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Se contactó al NOC del proveedor de telecomunicaciones. Informan de un corte de fibra en la vía pública por obras civiles. Cuadrilla en sitio con tiempo estimado de empalme de 90 minutos.',
    'followup',
    FALSE,
    NOW() - INTERVAL '1 hour'
),
(
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Nota interna: Se activó contingencia de datos celulares 5G para los servicios de emergencia de la portería y datacenter.',
    'task',
    TRUE,
    NOW() - INTERVAL '45 minutes'
),
(
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000101',
    'Solución aplicada: Se asignó invitación al correo corporativo desde la consola central de JetBrains con licencia renovada por 365 días.',
    'solution',
    FALSE,
    NOW() - INTERVAL '4 hours'
),
(
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000205',
    '00000000-0000-0000-0000-000000000102',
    'En espera: Se probó reemplazo de cableado pero el sensor óptico del cabezal térmico está dañado. Se solicitó repuesto número de parte ZBR-410-OPT al proveedor.',
    'followup',
    FALSE,
    NOW() - INTERVAL '30 minutes'
),
(
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0000-000000000206',
    '00000000-0000-0000-0000-000000000101',
    'Solución validada: Desbloqueo de cuenta ejecutado en AD y reseteo de MFA mediante código temporal telefónico verificado.',
    'solution',
    FALSE,
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;
