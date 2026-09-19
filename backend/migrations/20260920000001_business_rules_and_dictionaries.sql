-- ============================================================================
-- Migration: 20260920000001_business_rules_and_dictionaries.sql
-- Description: Unified Business Rules Engine & Normalization Dictionaries
-- Covers:
--  1. Helpdesk Rules (Ticket business, Ticket entity, Problem, Change)
--  2. Asset & Inventory Rules (Equipment entity, Import & Link reconciliation)
--  3. Authorization & User Rules (Profile & Entity assignments)
--  4. 10 Normalization Dictionaries (Manufacturer, Software, Models, OS, etc.)
-- ============================================================================

-- 1. Rules Master Table
CREATE TABLE IF NOT EXISTS rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ranking INTEGER NOT NULL DEFAULT 100,
    match_logic VARCHAR(10) NOT NULL DEFAULT 'AND', -- 'AND' | 'OR'
    stop_on_first_match BOOLEAN NOT NULL DEFAULT FALSE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE, -- NULL = Global
    is_recursive BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rules_type_active_ranking ON rules(rule_type, is_active, ranking ASC);
CREATE INDEX IF NOT EXISTS idx_rules_entity ON rules(entity_id);

-- 2. Rule Criteria Table
CREATE TABLE IF NOT EXISTS rule_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    field VARCHAR(100) NOT NULL,
    operator VARCHAR(50) NOT NULL,
    pattern TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_criteria_rule_id ON rule_criteria(rule_id);

-- 3. Rule Actions Table
CREATE TABLE IF NOT EXISTS rule_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    field VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_actions_rule_id ON rule_actions(rule_id);

-- 4. Rule Execution Audit Logs
CREATE TABLE IF NOT EXISTS rule_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_type VARCHAR(64) NOT NULL,
    rule_id UUID REFERENCES rules(id) ON DELETE SET NULL,
    entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
    target_id UUID,
    matched_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
    execution_time_us BIGINT NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_logs_type_date ON rule_execution_logs(rule_type, executed_at DESC);

-- ============================================================================
-- SEED DATA: Preconfigured System Rules & Dictionaries
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Dictionary: Manufacturer (Normalizes hardware manufacturers)
-- ----------------------------------------------------------------------------
-- HP Normalization
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0001-000000000001', 'dict_manufacturer', 'Normalizar HP / Hewlett-Packard', 'Estandariza variantes de HP a "HP"', 10, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0001-000000000001', 'raw_manufacturer', 'regex_match', '(?i)^(hewlett[- ]?packard|hp inc\.?|hp)$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0001-000000000001', 'assign', 'normalized_manufacturer', 'HP')
ON CONFLICT DO NOTHING;

-- Dell Normalization
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0001-000000000002', 'dict_manufacturer', 'Normalizar Dell', 'Estandariza Dell Inc / Dell Computer', 20, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0001-000000000002', 'raw_manufacturer', 'regex_match', '(?i)^dell( inc\.?| computer.*)?$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0001-000000000002', 'assign', 'normalized_manufacturer', 'Dell')
ON CONFLICT DO NOTHING;

-- Lenovo Normalization
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0001-000000000003', 'dict_manufacturer', 'Normalizar Lenovo', 'Estandariza Lenovo Group Limited', 30, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0001-000000000003', 'raw_manufacturer', 'regex_match', '(?i)^lenovo.*$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0001-000000000003', 'assign', 'normalized_manufacturer', 'Lenovo')
ON CONFLICT DO NOTHING;

-- Cisco Normalization
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0001-000000000004', 'dict_manufacturer', 'Normalizar Cisco', 'Estandariza Cisco Systems Inc.', 40, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0001-000000000004', 'raw_manufacturer', 'regex_match', '(?i)^cisco( systems.*)?$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0001-000000000004', 'assign', 'normalized_manufacturer', 'Cisco Systems')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Dictionary: OS Architecture
-- ----------------------------------------------------------------------------
-- x86_64 Architecture
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0002-000000000001', 'dict_os_architecture', 'Normalizar x86_64 (64-bits)', 'Unifica AMD64, x64 y EM64T a x86_64', 10, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0002-000000000001', 'raw_arch', 'regex_match', '(?i)^(amd64|x86_64|x64|em64t|intel64)$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0002-000000000001', 'assign', 'normalized_arch', 'x86_64')
ON CONFLICT DO NOTHING;

-- ARM64 Architecture
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0002-000000000002', 'dict_os_architecture', 'Normalizar ARM64', 'Unifica aarch64 y arm64 a ARM64', 20, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0002-000000000002', 'raw_arch', 'regex_match', '(?i)^(aarch64|arm64.*)$')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0002-000000000002', 'assign', 'normalized_arch', 'ARM64')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Dictionary: Operating Systems
-- ----------------------------------------------------------------------------
-- Windows 11
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0003-000000000001', 'dict_os', 'Normalizar Windows 11', 'Estandariza Microsoft Windows 11 (Home/Pro/Enterprise)', 10, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0003-000000000001', 'raw_os_name', 'regex_match', '(?i)windows.*11')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0003-000000000001', 'assign', 'normalized_os_name', 'Windows 11')
ON CONFLICT DO NOTHING;

-- Windows 10
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0003-000000000002', 'dict_os', 'Normalizar Windows 10', 'Estandariza Microsoft Windows 10', 20, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0003-000000000002', 'raw_os_name', 'regex_match', '(?i)windows.*10')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0003-000000000002', 'assign', 'normalized_os_name', 'Windows 10')
ON CONFLICT DO NOTHING;

-- Ubuntu
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0003-000000000003', 'dict_os', 'Normalizar Ubuntu Linux', 'Estandariza distribuciones Ubuntu', 30, 'OR', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0003-000000000003', 'raw_os_name', 'regex_match', '(?i)ubuntu')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0003-000000000003', 'assign', 'normalized_os_name', 'Ubuntu Linux')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Rules: Asset Import & Link Reconciliation
-- ----------------------------------------------------------------------------
-- Rule 1: Match by BIOS / System UUID
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0004-000000000001', 'asset_import_link', 'Reconciliación: Coincidencia por UUID de BIOS', 'Enlaza el activo si el UUID coincide y no está vacío', 10, 'AND', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0004-000000000001', 'bios_uuid', 'is_not_empty', '')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0004-000000000001', 'link_or_create', 'reconciliation_decision', 'link_by_uuid')
ON CONFLICT DO NOTHING;

-- Rule 2: Match by Serial Number + Manufacturer
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0004-000000000002', 'asset_import_link', 'Reconciliación: Coincidencia por Número de Serie', 'Enlaza el activo si el Serial Number coincide', 20, 'AND', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0004-000000000002', 'serial_number', 'is_not_empty', '')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0004-000000000002', 'link_or_create', 'reconciliation_decision', 'link_by_serial')
ON CONFLICT DO NOTHING;

-- Rule 3: Match by MAC Address
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0004-000000000003', 'asset_import_link', 'Reconciliación: Coincidencia por Dirección MAC', 'Enlaza si la interfaz de red primaria coincide', 30, 'AND', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0004-000000000003', 'mac_address', 'is_not_empty', '')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0004-000000000003', 'link_or_create', 'reconciliation_decision', 'link_by_mac')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- Rules: Helpdesk Ticket Business Rules
-- ----------------------------------------------------------------------------
-- Urgent Subject Escalation Rule
INSERT INTO rules (id, rule_type, name, description, ranking, match_logic, stop_on_first_match, is_active)
VALUES ('00000000-0000-0000-0005-000000000001', 'ticket_business', 'Escalamiento de Incidencia Crítica por Asunto', 'Si el asunto contiene palabras de emergencia, asigna Urgencia 5 e Impacto 4', 10, 'OR', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rule_criteria (rule_id, field, operator, pattern)
VALUES 
  ('00000000-0000-0000-0005-000000000001', 'subject', 'regex_match', '(?i)(urgente|emergencia|ca[ií]d[oa]|outage|bloqueante|paralizado)')
ON CONFLICT DO NOTHING;

INSERT INTO rule_actions (rule_id, action_type, field, value)
VALUES 
  ('00000000-0000-0000-0005-000000000001', 'assign', 'urgency', '5'),
  ('00000000-0000-0000-0005-000000000001', 'assign', 'impact', '4')
ON CONFLICT DO NOTHING;
