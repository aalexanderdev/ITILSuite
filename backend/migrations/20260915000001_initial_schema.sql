-- 0001_initial_schema.sql: Initial ITILSuite Schema for v0.0.2

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Hierarchical Entities (Multi-Tenancy)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    completeness VARCHAR(1000) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_parent_id ON entities(parent_id);

-- 2. RBAC Profiles (Super-Admin, Admin, Technician, Self-Service, Observer)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    rights JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    realname VARCHAR(100) NOT NULL DEFAULT '',
    firstname VARCHAR(100) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 4. User Profiles per Entity (GLPI-style Authorization Link)
CREATE TABLE IF NOT EXISTS user_profiles_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    is_recursive BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, profile_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_upe_user_id ON user_profiles_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_upe_entity_id ON user_profiles_entities(entity_id);

-- 5. Seed Initial Data
-- Seed Root Entity
INSERT INTO entities (id, parent_id, name, completeness, level)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Root Entity',
    'Root Entity',
    0
) ON CONFLICT (id) DO NOTHING;

-- Seed Default Profiles
INSERT INTO profiles (id, name, description, is_default, rights)
VALUES 
(
    '00000000-0000-0000-0000-000000000010',
    'Super-Admin',
    'Full administrative authority across all entities and settings',
    FALSE,
    '{"all": true}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000011',
    'Technician',
    'Operational management of tickets, assets, and service tasks',
    FALSE,
    '{"ticket:read": true, "ticket:write": true, "asset:read": true, "asset:write": true}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000012',
    'Self-Service',
    'End-user portal access for submitting tickets and viewing personal inventory',
    TRUE,
    '{"ticket:create": true, "ticket:read_own": true, "asset:read_own": true}'::jsonb
),
(
    '00000000-0000-0000-0000-000000000013',
    'Observer',
    'Read-only oversight for compliance, audits, and SLA reporting',
    FALSE,
    '{"all:read": true}'::jsonb
) ON CONFLICT (id) DO NOTHING;
