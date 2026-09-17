-- 20260916000002_ticket_templates.sql: ITIL Ticket Templates (Inspired by GLPI Architecture)

-- 1. Create Ticket Templates Table
CREATE TABLE IF NOT EXISTS ticket_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(255),
    ticket_type VARCHAR(20) NOT NULL DEFAULT 'incident' CHECK (ticket_type IN ('incident', 'request')),
    category VARCHAR(100),
    predefined_title VARCHAR(255),
    predefined_content TEXT,
    predefined_urgency INTEGER CHECK (predefined_urgency BETWEEN 1 AND 5),
    predefined_impact INTEGER CHECK (predefined_impact BETWEEN 1 AND 5),
    default_technician_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mandatory_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ticket_templates_entity_id ON ticket_templates(entity_id);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_type ON ticket_templates(ticket_type);
CREATE INDEX IF NOT EXISTS idx_ticket_templates_is_active ON ticket_templates(is_active);

-- 3. Seed Realistic Standard ITIL Templates for Root Entity (00000000-0000-0000-0000-000000000001)
INSERT INTO ticket_templates (
    id,
    entity_id,
    name,
    description,
    ticket_type,
    category,
    predefined_title,
    predefined_content,
    predefined_urgency,
    predefined_impact,
    default_technician_id,
    mandatory_fields,
    hidden_fields,
    is_active
) VALUES
(
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    'Falla de Impresora / Periférico',
    'Plantilla estándar para reportar problemas de atasco, consumibles o desconexión de impresoras',
    'incident',
    'Hardware / Equipos',
    '[FALLA IMPRESORA]: ',
    '**Dispositivo / Impresora afectada**: ' || E'\n' ||
    '**Ubicación física / Piso / Oficina**: ' || E'\n' ||
    '**Modelo / Número de Serie**: ' || E'\n' ||
    '**Descripción del síntoma**: (Ej. atasco de papel continuo, tóner agotado, sin conexión en red)' || E'\n' ||
    '**¿Muestra código de error en pantalla?**: ',
    2,
    2,
    '00000000-0000-0000-0000-000000000101', -- juan_tech
    '["content", "urgency"]'::jsonb,
    '[]'::jsonb,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    'Incidente de Correo Electrónico / Buzón',
    'Plantilla guiada para problemas de recepción, envío o sincronización en buzones corporativos',
    'incident',
    'Sistemas / Correo',
    '[CORREO]: ',
    '**Cuenta de correo afectada**: ' || E'\n' ||
    '**Cliente utilizado**: (Outlook Web, Outlook Desktop, Aplicación Móvil)' || E'\n' ||
    '**Tipo de fallo**: (No recibe correos, no puede enviar, error de sincronización, almacenamiento lleno)' || E'\n' ||
    '**Mensaje de rebote o código de error exacto**: ' || E'\n' ||
    '**Hora aproximada de inicio de la falla**: ',
    3,
    3,
    '00000000-0000-0000-0000-000000000102', -- maria_tech
    '["content", "urgency", "category"]'::jsonb,
    '[]'::jsonb,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000001',
    'Solicitud de Acceso y Credenciales VPN',
    'Petición de servicio para habilitación de túnel seguro VPN y acceso remoto',
    'request',
    'Cuentas y Accesos',
    '[SOLICITUD VPN]: ',
    '**Nombre del colaborador**: ' || E'\n' ||
    '**Correo corporativo**: ' || E'\n' ||
    '**Departamento / Área**: ' || E'\n' ||
    '**Justificación del acceso remoto**: ' || E'\n' ||
    '**Tipo de equipo a conectar**: (Equipo corporativo o equipo personal homologado)' || E'\n' ||
    '**Fecha requerida de habilitación**: ' || E'\n' ||
    '**Aprobador / Jefatura directa**: ',
    2,
    2,
    '00000000-0000-0000-0000-000000000102', -- maria_tech
    '["content", "category"]'::jsonb,
    '["urgency", "impact"]'::jsonb,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000204',
    '00000000-0000-0000-0000-000000000001',
    'Alta y Onboarding de Nuevo Empleado',
    'Requerimiento de provisión de puesto de trabajo, equipos e infraestructura para nuevo ingreso',
    'request',
    'Gestión de Personal',
    '[ALTA TI - ONBOARDING]: ',
    '**Nombre completo del nuevo ingreso**: ' || E'\n' ||
    '**Puesto / Cargo**: ' || E'\n' ||
    '**Fecha de inicio**: ' || E'\n' ||
    '**Sede / Ubicación física**: ' || E'\n' ||
    '**Equipamiento requerido**:' || E'\n' ||
    '- [ ] Laptop / Computadora portátil' || E'\n' ||
    '- [ ] Monitor secundario 24" / 27"' || E'\n' ||
    '- [ ] Teléfono IP / Anexo corporativo' || E'\n' ||
    '**Accesos y Software**:' || E'\n' ||
    '- [ ] Cuenta de correo y Microsoft 365' || E'\n' ||
    '- [ ] Acceso a VPN y ERP' || E'\n' ||
    '- [ ] Carpetas de red compartidas departamentales',
    3,
    2,
    '00000000-0000-0000-0000-000000000101', -- juan_tech
    '["content", "category"]'::jsonb,
    '[]'::jsonb,
    TRUE
),
(
    '00000000-0000-0000-0000-000000000205',
    '00000000-0000-0000-0000-000000000001',
    'Interrupción Crítica de Red / Enlace Caído',
    'Incidente de alta prioridad para caída total de fibra óptica, switch core o servidor crítico',
    'incident',
    'Redes / Infraestructura',
    '[CRÍTICO RED]: Enlace o Servidor no disponible',
    '**Servicio / Enlace afectado**: (Internet principal, enlace WAN entre sedes, switch core)' || E'\n' ||
    '**Sede / Sucursal afectada**: ' || E'\n' ||
    '**Impacto en la operación**: (Operación totalmente detenida, múltiples sucursales desconectadas)' || E'\n' ||
    '**Dirección IP / Gateway / VLAN afectada**: ' || E'\n' ||
    '**Pruebas preliminares realizadas**: (Verificación de LEDs en rack, prueba de ping hacia gateway)',
    5,
    5,
    '00000000-0000-0000-0000-000000000102', -- maria_tech
    '["content", "urgency", "impact", "category"]'::jsonb,
    '[]'::jsonb,
    TRUE
)
ON CONFLICT (id) DO NOTHING;
