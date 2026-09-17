-- 20260918000001_asset_management.sql: ITAM & CMDB Asset Management with GLPI-Agent compatibility

-- 1. Create Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL DEFAULT 'computer' CHECK (asset_type IN ('computer', 'network_equipment', 'monitor', 'printer', 'peripheral', 'server', 'phone', 'other')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_stock', 'in_repair', 'decommissioned', 'reserved')),
    serial_number VARCHAR(255),
    inventory_number VARCHAR(255),
    uuid VARCHAR(255),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    location VARCHAR(255),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_in_charge VARCHAR(255),
    comments TEXT,
    last_inventory_at TIMESTAMPTZ,
    agent_version VARCHAR(100),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Asset Connections Table (e.g. Computer <-> Monitor / Peripheral / Switch)
CREATE TABLE IF NOT EXISTS asset_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    computer_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    connected_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    connection_type VARCHAR(50) NOT NULL DEFAULT 'direct' CHECK (connection_type IN ('direct', 'network', 'usb', 'video', 'power')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(computer_id, connected_asset_id)
);

-- 3. Create Ticket Assets Link Table (Service Desk <-> CMDB association)
CREATE TABLE IF NOT EXISTS ticket_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticket_id, asset_id)
);

-- 4. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_assets_entity_id ON assets(entity_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_uuid ON assets(uuid);
CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_technician_id ON assets(technician_id);
CREATE INDEX IF NOT EXISTS idx_assets_specifications ON assets USING gin (specifications);

CREATE INDEX IF NOT EXISTS idx_asset_connections_computer ON asset_connections(computer_id);
CREATE INDEX IF NOT EXISTS idx_asset_connections_connected ON asset_connections(connected_asset_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assets_ticket ON ticket_assets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assets_asset ON ticket_assets(asset_id);

-- 5. Seed Realistic Asset Demonstrations
-- Root Entity ID: 00000000-0000-0000-0000-000000000001
-- Admin ID: 00000000-0000-0000-0000-000000000100
-- Juan Tech: 00000000-0000-0000-0000-000000000101

-- 5.1 Computer 1: Dell Precision 5570 Laptop (Inventoried by GLPI-Agent)
INSERT INTO assets (
    id,
    entity_id,
    name,
    asset_type,
    status,
    serial_number,
    inventory_number,
    uuid,
    manufacturer,
    model,
    location,
    user_id,
    technician_id,
    group_in_charge,
    comments,
    last_inventory_at,
    agent_version,
    is_locked,
    locked_fields,
    specifications
) VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    'WS-DEV-JUAN',
    'computer',
    'active',
    '8HG9TK3',
    'INV-2026-0045',
    '4c4c4544-0048-4710-8039-b2c04f353537',
    'Dell Inc.',
    'Precision 5570',
    'Edificio Central - Piso 3 - Depto Desarrollo',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000100',
    'Soporte TI Nivel 2',
    'Estación móvil de desarrollo fullstack asignada a Juan Pérez.',
    NOW() - INTERVAL '15 minutes',
    'GLPI-Agent_v1.11',
    false,
    '[]'::jsonb,
    '{
        "os": {
            "name": "Ubuntu 24.04.1 LTS",
            "version": "24.04",
            "arch": "x86_64",
            "kernel": "6.8.0-45-generic",
            "install_date": "2026-01-10 09:30:00"
        },
        "cpu": {
            "name": "12th Gen Intel(R) Core(TM) i7-12800H",
            "cores": 14,
            "threads": 20,
            "speed_mhz": 2400
        },
        "memory": {
            "total_mb": 32768,
            "type": "DDR5",
            "slots_used": 2,
            "slots_total": 2
        },
        "storage": [
            {
                "name": "NVMe PC801 SK hynix 1TB",
                "size_gb": 1024,
                "free_gb": 485,
                "filesystem": "ext4",
                "mount_point": "/"
            }
        ],
        "networks": [
            {
                "name": "wlp0s20f3",
                "mac": "38:68:dd:94:a1:b2",
                "ip": "192.168.10.142",
                "netmask": "255.255.255.0",
                "speed": "Wi-Fi 6E",
                "status": "up"
            }
        ],
        "softwares": [
            {"name": "Docker Engine", "version": "27.2.0", "publisher": "Docker Inc."},
            {"name": "Visual Studio Code", "version": "1.93.1", "publisher": "Microsoft Corporation"},
            {"name": "Rust Toolchain", "version": "1.80.1", "publisher": "Rust Foundation"},
            {"name": "PostgreSQL Client", "version": "16.4", "publisher": "PostgreSQL Global Development Group"}
        ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 5.2 Monitor 1: Dell UltraSharp 27" 4K Monitor
INSERT INTO assets (
    id,
    entity_id,
    name,
    asset_type,
    status,
    serial_number,
    inventory_number,
    uuid,
    manufacturer,
    model,
    location,
    user_id,
    technician_id,
    group_in_charge,
    comments,
    last_inventory_at,
    agent_version,
    is_locked,
    locked_fields,
    specifications
) VALUES (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000001',
    'MON-DELL-U2723QE',
    'monitor',
    'active',
    'CN-0M381P-74261',
    'INV-2026-0046',
    NULL,
    'Dell Inc.',
    'UltraSharp U2723QE',
    'Edificio Central - Piso 3 - Puesto 12',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000100',
    'Soporte TI Nivel 1',
    'Monitor 4K IPS Black conectado vía USB-C Thunderbolt a WS-DEV-JUAN.',
    NOW() - INTERVAL '15 minutes',
    'GLPI-Agent_v1.11',
    false,
    '[]'::jsonb,
    '{
        "screen_size_inches": 27.0,
        "resolution": "3840x2160 (4K UHD)",
        "refresh_rate_hz": 60,
        "inputs": ["USB-C 90W PD", "DisplayPort 1.4", "HDMI 2.0", "RJ45 Ethernet Hub"],
        "has_speakers": false
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Link Computer and Monitor
INSERT INTO asset_connections (computer_id, connected_asset_id, connection_type)
VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000302',
    'video'
) ON CONFLICT (computer_id, connected_asset_id) DO NOTHING;

-- 5.3 Network Gear: Cisco Catalyst 9200L Switch
INSERT INTO assets (
    id,
    entity_id,
    name,
    asset_type,
    status,
    serial_number,
    inventory_number,
    uuid,
    manufacturer,
    model,
    location,
    user_id,
    technician_id,
    group_in_charge,
    comments,
    last_inventory_at,
    agent_version,
    is_locked,
    locked_fields,
    specifications
) VALUES (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000001',
    'SW-CORE-P3-01',
    'network_equipment',
    'active',
    'FOC2419L0P1',
    'INV-2026-0010',
    '00000000-c15c-0920-0000-f0c2419l0p10',
    'Cisco Systems',
    'Catalyst 9200L 48P 4G',
    'Edificio Central - Rack Telecomunicaciones RACK-02 (U18-U19)',
    NULL,
    '00000000-0000-0000-0000-000000000100',
    'Redes e Infraestructura',
    'Switch PoE+ de distribución de planta 3 con 4 uplinks SFP Gigabit.',
    NOW() - INTERVAL '2 hours',
    'GLPI-SNMP_v1.11',
    true,
    '["location", "management_ip"]'::jsonb,
    '{
        "device_type": "switch",
        "firmware_version": "Cisco IOS-XE 17.09.04a",
        "ports_count": 48,
        "management_ip": "10.10.3.2",
        "mac_address": "70:ea:1a:24:bc:00",
        "vlans": [
            {"id": 10, "name": "VLAN-DATA-CORP", "subnet": "192.168.10.0/24"},
            {"id": 20, "name": "VLAN-VOIP", "subnet": "192.168.20.0/24"},
            {"id": 99, "name": "VLAN-MGMT", "subnet": "10.10.3.0/24"}
        ],
        "poe_budget_watts": 740,
        "poe_consumed_watts": 235
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 5.4 Server: HP ProLiant DL380 Gen10
INSERT INTO assets (
    id,
    entity_id,
    name,
    asset_type,
    status,
    serial_number,
    inventory_number,
    uuid,
    manufacturer,
    model,
    location,
    user_id,
    technician_id,
    group_in_charge,
    comments,
    last_inventory_at,
    agent_version,
    is_locked,
    locked_fields,
    specifications
) VALUES (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000001',
    'SRV-PROD-DB01',
    'server',
    'active',
    'CZ291807KQ',
    'INV-2026-0003',
    '34383330-3139-435a-3239-313830374b51',
    'HPE',
    'ProLiant DL380 Gen10',
    'Datacenter Principal - Rack R-01 (U20-U22)',
    NULL,
    '00000000-0000-0000-0000-000000000100',
    'Infraestructura y Base de Datos',
    'Nodo primario de PostgreSQL 16 para sistemas centrales.',
    NOW() - INTERVAL '30 minutes',
    'GLPI-Agent_v1.11',
    true,
    '["location"]'::jsonb,
    '{
        "os": {
            "name": "Debian GNU/Linux 12 (bookworm)",
            "version": "12.7",
            "arch": "x86_64",
            "kernel": "6.1.0-25-amd64",
            "install_date": "2025-06-15 14:00:00"
        },
        "cpu": {
            "name": "Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz (Dual)",
            "cores": 48,
            "threads": 96,
            "speed_mhz": 3000
        },
        "memory": {
            "total_mb": 131072,
            "type": "DDR4 ECC Reg",
            "slots_used": 8,
            "slots_total": 24
        },
        "storage": [
            {
                "name": "HPE Smart Array P408i-a RAID 10 (8x SAS SSD 1.92TB)",
                "size_gb": 7680,
                "free_gb": 5120,
                "filesystem": "xfs",
                "mount_point": "/var/lib/postgresql"
            }
        ],
        "networks": [
            {
                "name": "bond0 (eth0+eth1)",
                "mac": "94:40:c9:e1:33:40",
                "ip": "10.10.1.15",
                "netmask": "255.255.255.0",
                "speed": "20 Gbps",
                "status": "up"
            }
        ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- 5.5 In-Stock Laptop: Lenovo ThinkPad T14s
INSERT INTO assets (
    id,
    entity_id,
    name,
    asset_type,
    status,
    serial_number,
    inventory_number,
    uuid,
    manufacturer,
    model,
    location,
    user_id,
    technician_id,
    group_in_charge,
    comments,
    last_inventory_at,
    agent_version,
    is_locked,
    locked_fields,
    specifications
) VALUES (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0000-000000000001',
    'NB-STOCK-04',
    'computer',
    'in_stock',
    'PF48X91A',
    'INV-2026-0089',
    '23187210-9182-4112-9811-pf48x91a0001',
    'Lenovo',
    'ThinkPad T14s Gen 4',
    'Almacén Central TI - Estantería B',
    NULL,
    '00000000-0000-0000-0000-000000000101',
    'Soporte TI Nivel 1',
    'Equipo nuevo preparado para nuevas incorporaciones.',
    NOW() - INTERVAL '1 day',
    'GLPI-Agent_v1.11',
    false,
    '[]'::jsonb,
    '{
        "os": {
            "name": "Microsoft Windows 11 Pro",
            "version": "23H2",
            "arch": "x86_64",
            "kernel": "10.0.22631.4169"
        },
        "cpu": {
            "name": "AMD Ryzen 7 PRO 7840U w/ Radeon 780M Graphics",
            "cores": 8,
            "threads": 16,
            "speed_mhz": 3300
        },
        "memory": {
            "total_mb": 32768,
            "type": "LPDDR5x",
            "slots_used": 1,
            "slots_total": 1
        },
        "storage": [
            {
                "name": "Kioxia 512GB NVMe",
                "size_gb": 512,
                "free_gb": 440,
                "filesystem": "NTFS",
                "mount_point": "C:"
            }
        ]
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;
