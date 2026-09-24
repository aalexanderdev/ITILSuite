-- 20260925000001_itil_problems_changes_and_kedb.sql: ITIL Problem & Change Management, CAB & KEDB

-- ============================================================================
-- 1. ITIL Problem Management (Problems & Follow-ups)
-- ============================================================================

CREATE TABLE IF NOT EXISTS problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_number VARCHAR(50) NOT NULL UNIQUE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'investigation', 'workaround_found', 'known_error', 'resolved', 'closed')),
    urgency INTEGER NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
    impact INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    category VARCHAR(100),
    symptoms TEXT,
    root_cause TEXT,
    workaround TEXT,
    permanent_solution TEXT,
    solved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS problem_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    item_type VARCHAR(30) NOT NULL DEFAULT 'followup' CHECK (item_type IN ('followup', 'rca_note', 'workaround', 'solution')),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Problem <-> Ticket Link (N:N)
CREATE TABLE IF NOT EXISTS problem_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(problem_id, ticket_id)
);

-- Problem <-> Asset Link (N:N)
CREATE TABLE IF NOT EXISTS problem_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(problem_id, asset_id)
);

-- ============================================================================
-- 2. Known Error Database (KEDB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kedb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kedb_number VARCHAR(50) NOT NULL UNIQUE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    error_symptoms TEXT NOT NULL,
    root_cause TEXT NOT NULL,
    workaround TEXT NOT NULL,
    permanent_solution TEXT,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    view_count INTEGER NOT NULL DEFAULT 0,
    is_public_kb BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. ITIL Change Enablement (Requests for Change - RFC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_number VARCHAR(50) NOT NULL UNIQUE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    change_type VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (change_type IN ('standard', 'normal', 'emergency')),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'evaluation', 'cab_review', 'scheduled', 'implementing', 'review', 'closed', 'rejected')),
    urgency INTEGER NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
    impact INTEGER NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'critical')),
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    category VARCHAR(100),
    impact_assessment TEXT,
    implementation_plan TEXT,
    test_plan TEXT,
    rollback_plan TEXT,
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    pir_notes TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CAB Approvals (Votación y Dictamen del Comité Asesor de Cambios)
CREATE TABLE IF NOT EXISTS change_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'more_info_needed')),
    comments TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(change_id, approver_id)
);

-- Change <-> Ticket Link (N:N)
CREATE TABLE IF NOT EXISTS change_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(change_id, ticket_id)
);

-- Change <-> Problem Link (N:N)
CREATE TABLE IF NOT EXISTS change_problems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(change_id, problem_id)
);

-- Change <-> Asset Link (N:N)
CREATE TABLE IF NOT EXISTS change_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(change_id, asset_id)
);

-- Change Follow-ups & Minutes (Actas de CAB, Notas de Ejecución, etc.)
CREATE TABLE IF NOT EXISTS change_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    item_type VARCHAR(30) NOT NULL DEFAULT 'followup' CHECK (item_type IN ('followup', 'cab_minute', 'execution_log', 'pir_note')),
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. High-Performance Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_problems_entity_id ON problems(entity_id);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_priority ON problems(priority);
CREATE INDEX IF NOT EXISTS idx_problems_assigned_tech ON problems(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_problems_assigned_group ON problems(assigned_group_id);
CREATE INDEX IF NOT EXISTS idx_problem_followups_problem_id ON problem_followups(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_tickets_problem_id ON problem_tickets(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_tickets_ticket_id ON problem_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_problem_assets_problem_id ON problem_assets(problem_id);
CREATE INDEX IF NOT EXISTS idx_problem_assets_asset_id ON problem_assets(asset_id);

CREATE INDEX IF NOT EXISTS idx_kedb_entity_id ON kedb_articles(entity_id);
CREATE INDEX IF NOT EXISTS idx_kedb_problem_id ON kedb_articles(problem_id);
CREATE INDEX IF NOT EXISTS idx_kedb_status ON kedb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kedb_category ON kedb_articles(category);

CREATE INDEX IF NOT EXISTS idx_changes_entity_id ON changes(entity_id);
CREATE INDEX IF NOT EXISTS idx_changes_status ON changes(status);
CREATE INDEX IF NOT EXISTS idx_changes_type ON changes(change_type);
CREATE INDEX IF NOT EXISTS idx_changes_priority ON changes(priority);
CREATE INDEX IF NOT EXISTS idx_changes_assigned_tech ON changes(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_changes_assigned_group ON changes(assigned_group_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_change_id ON change_approvals(change_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_approver ON change_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_change_tickets_change_id ON change_tickets(change_id);
CREATE INDEX IF NOT EXISTS idx_change_tickets_ticket_id ON change_tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_change_problems_change_id ON change_problems(change_id);
CREATE INDEX IF NOT EXISTS idx_change_problems_problem_id ON change_problems(problem_id);
CREATE INDEX IF NOT EXISTS idx_change_assets_change_id ON change_assets(change_id);
CREATE INDEX IF NOT EXISTS idx_change_assets_asset_id ON change_assets(asset_id);
CREATE INDEX IF NOT EXISTS idx_change_followups_change_id ON change_followups(change_id);

-- ============================================================================
-- 5. Seed Realistic ITIL Demonstration Data
-- ============================================================================

-- 5.1 Seed Problem: Degradación recurrente de Base de Datos PostgreSQL
INSERT INTO problems (
    id,
    problem_number,
    entity_id,
    name,
    content,
    status,
    urgency,
    impact,
    priority,
    requester_id,
    assigned_technician_id,
    category,
    symptoms,
    root_cause,
    workaround,
    permanent_solution,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000501',
    'PRB-2026-0001',
    '00000000-0000-0000-0000-000000000001',
    'Saturación intermitente de conexiones y latencia elevada en cluster PostgreSQL',
    'Múltiples tickets reportan lentitud y timeout en consultas críticas durante los cierres contables y picos de tráfico de Helpdesk.',
    'known_error',
    4,
    4,
    4,
    '00000000-0000-0000-0000-000000000103', -- Carlos Méndez
    '00000000-0000-0000-0000-000000000101', -- Juan Pérez
    'Infraestructura / Base de Datos',
    'Aumento de latencia a >4500ms en endpoints de inventario y tickets. Mensaje en logs: FATAL: remaining connection slots are reserved for non-replication superuser connections.',
    'La aplicación y microservicios satélites carecen de connection pooling persistente con multiplexación adecuada, abriendo conexiones efímeras sin reutilización.',
    'Ejecutar pg_terminate_backend() sobre conexiones idle de más de 10 minutos y elevar temporalmente max_connections en PostgreSQL.',
    'Implementar PgBouncer en modo transaction pooling delante del nodo primario y coordinar ventana de mantenimiento mediante RFC-2026-0001.',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '3 hours'
) ON CONFLICT (id) DO NOTHING;

-- Link Problem to Ticket INC-2026-0002
INSERT INTO problem_tickets (problem_id, ticket_id)
VALUES (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000202'
) ON CONFLICT (problem_id, ticket_id) DO NOTHING;

-- Link Problem to Asset SRV-PROD-DB01
INSERT INTO problem_assets (problem_id, asset_id)
VALUES (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000304'
) ON CONFLICT (problem_id, asset_id) DO NOTHING;

-- Problem Followup / RCA note
INSERT INTO problem_followups (
    id,
    problem_id,
    author_id,
    content,
    item_type,
    is_private,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000511',
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000101',
    'Análisis de causa raíz concluido: El backend en Rust mantiene su pool bajo control, pero el scraper de telemetría y reportes nocturnos abren 80 conexiones simultáneas sin cerrar el socket al finalizar. Se documenta workaround en KEDB y se emite RFC-2026-0001.',
    'rca_note',
    FALSE,
    NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

-- 5.2 Seed KEDB Article
INSERT INTO kedb_articles (
    id,
    kedb_number,
    entity_id,
    problem_id,
    title,
    category,
    error_symptoms,
    root_cause,
    workaround,
    permanent_solution,
    author_id,
    status,
    view_count,
    is_public_kb,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000551',
    'KEDB-2026-0001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000501',
    'Mitigación ante saturación de conexiones en servidor PostgreSQL (SRV-PROD-DB01)',
    'Base de Datos / Performance',
    'Servicios web muestran errores 500 y tiempos de espera superiores a 5 segundos. En los logs del servidor aparece "FATAL: remaining connection slots are reserved".',
    'Consumo saturado de los 100 slots de conexión permitidos por scripts batch no optimizados.',
    '1. Conectarse vía SSH a SRV-PROD-DB01.\n2. Ejecutar comando de purga de conexiones en espera:\n   `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = ''idle'' AND state_change < current_timestamp - INTERVAL ''10 minutes'';`\n3. Verificar restablecimiento de latencia inferior a 20ms.',
    'Despliegue del pooler PgBouncer bajo ventana de cambio programada (RFC-2026-0001).',
    '00000000-0000-0000-0000-000000000101',
    'published',
    18,
    TRUE,
    NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO NOTHING;

-- 5.3 Seed Request for Change (RFC)
INSERT INTO changes (
    id,
    change_number,
    entity_id,
    name,
    content,
    change_type,
    status,
    urgency,
    impact,
    priority,
    risk_level,
    requester_id,
    assigned_technician_id,
    category,
    impact_assessment,
    implementation_plan,
    test_plan,
    rollback_plan,
    scheduled_start,
    scheduled_end,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000601',
    'RFC-2026-0001',
    '00000000-0000-0000-0000-000000000001',
    'Instalación y configuración de PgBouncer con Transaction Pooling en SRV-PROD-DB01',
    'Reconfiguración del subsistema de base de datos para desacoplar conexiones de clientes mediante PgBouncer, eliminando cuellos de botella y picos de latencia observados en PRB-2026-0001.',
    'normal',
    'cab_review',
    4,
    4,
    4,
    'medium',
    '00000000-0000-0000-0000-000000000101', -- Juan Pérez
    '00000000-0000-0000-0000-000000000102', -- María Rodríguez
    'Infraestructura / Base de Datos',
    'Breve indisponibilidad de 3 a 5 minutos durante el reinicio de servicios en ventana nocturna acordada. Afecta temporalmente autenticaciones y registro de tickets.',
    '1. Instalar pgbouncer en Debian 12.\n2. Configurar pool_mode = transaction y default_pool_size = 40 en /etc/pgbouncer/pgbouncer.ini.\n3. Redirigir puerto de conexión de la aplicación al 6432.\n4. Reiniciar daemon systemd.',
    '1. Validar healthcheck HTTP /api/v1/health.\n2. Ejecutar suite de pruebas de carga con 150 clientes concurrentes simulados.\n3. Verificar latencia promedio < 15ms en dashboard.',
    '1. Detener servicio pgbouncer: `systemctl stop pgbouncer`.\n2. Revertir string de conexión en .env al puerto nativo 5432.\n3. Reiniciar backend de ITILSuite.',
    NOW() + INTERVAL '2 days' + INTERVAL '2 hours',
    NOW() + INTERVAL '2 days' + INTERVAL '4 hours',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO NOTHING;

-- Link Change to Problem PRB-2026-0001
INSERT INTO change_problems (change_id, problem_id)
VALUES (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000501'
) ON CONFLICT (change_id, problem_id) DO NOTHING;

-- Link Change to Ticket INC-2026-0002
INSERT INTO change_tickets (change_id, ticket_id)
VALUES (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000202'
) ON CONFLICT (change_id, ticket_id) DO NOTHING;

-- Link Change to Asset SRV-PROD-DB01
INSERT INTO change_assets (change_id, asset_id)
VALUES (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000304'
) ON CONFLICT (change_id, asset_id) DO NOTHING;

-- 5.4 Seed CAB Approvals
INSERT INTO change_approvals (
    id,
    change_id,
    approver_id,
    approval_status,
    comments,
    decided_at,
    created_at
) VALUES 
(
    '00000000-0000-0000-0000-000000000621',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000101', -- Juan Pérez
    'approved',
    'Plan de rollback y pruebas verificado en ambiente staging. Ventana acordada de bajo impacto.',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '1 day'
),
(
    '00000000-0000-0000-0000-000000000622',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000102', -- María Rodríguez
    'pending',
    NULL,
    NULL,
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (change_id, approver_id) DO NOTHING;

-- 5.5 Seed Change Followup / CAB minute
INSERT INTO change_followups (
    id,
    change_id,
    author_id,
    content,
    item_type,
    is_private,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000631',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000100', -- Admin
    'Acta de reunión extraordinaria del CAB: Se revisa RFC-2026-0001. Aprobación favorable de líder técnico Juan Pérez. Pendiente confirmación de operaciones para autorizar ventana de ejecución.',
    'cab_minute',
    FALSE,
    NOW() - INTERVAL '3 hours'
) ON CONFLICT (id) DO NOTHING;
