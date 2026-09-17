# Architecture Decision Record (ADR) 0002: ITAM / CMDB Asset Model and GLPI-Agent Ingestion Pipeline

## Context & Problem Statement

GLPI 11 and its predecessor versions track IT hardware assets (Computers, Servers, Switches, Routers, Monitors, Peripherals, and Software) across dozens of highly granular, flat relational database tables (e.g. `glpi_computers`, `glpi_items_devicemotherboards`, `glpi_items_devicecpus`, `glpi_items_devicememories`, `glpi_items_devicenetworkcards`, `glpi_networkports`, etc.).

While this traditional schema allows normalized relational joins, it introduces severe bottlenecks:
1. **Extreme schema migration fragility**: Adding a new hardware sensor or peripheral specification requires running complex multi-table DDL migrations.
2. **High-concurrency ingestion lockups**: When hundreds of `glpi-agent` instances transmit automated inventory payloads simultaneously (e.g., during morning logon storms), the relational fan-out generates dozens of cascading INSERT/UPDATE operations and row locks per device.
3. **Overhead on simple queries**: Retrieving a full workstation profile requires joining 15+ tables.

## Decision

We adopt a **Hybrid Relational Core + Serde-Typed JSONB Specifications** architecture with a dedicated **Hierarchical Reconciliation Pipeline**:

### 1. Relational Core (`assets`, `asset_connections`, `ticket_assets`)
* **Identity & Governance**: ID (UUID), multi-tenant entity tree scoping (`entity_id`), asset type (`computer`, `server`, `network_equipment`, `monitor`, `printer`, etc.), operational status (`active`, `in_stock`, `in_repair`, `decommissioned`, `reserved`), serial number, inventory number, and system BIOS UUID.
* **Responsible Ownership**: Assigned user (`user_id`), technician in charge (`technician_id`), physical location, and group in charge.
* **Audit & Automation Metadata**: `last_inventory_at`, `agent_version`, `is_locked`, and `locked_fields`.
* **Topology & Links**:
  - `asset_connections`: Relational M:N mapping between computers and connected monitors, peripherals, and network switch ports.
  - `ticket_assets`: Direct integration between the Service Desk (`tickets`) and CMDB configuration items (`assets`).

### 2. Hardware & Software Specifications in PostgreSQL JSONB with GIN Indexes
* Dynamic component telemetry (CPU details, RAM modules, hard drive partitions with free/total sizes, network interfaces with IPs/MACs, operating system metadata, and installed software packages) is stored in the `specifications` column.
* **PostgreSQL GIN Indexing**: `CREATE INDEX idx_assets_specifications ON assets USING gin (specifications);` enables sub-millisecond lookups on nested properties (e.g., querying any computer with a specific MAC address: `specifications->'networks' @> '[{"mac": "..."}]'`).
* **Rust Type Safety**: Serialization and deserialization are handled through compile-time Serde models (`ComputerSpecs`, `NetworkEquipmentSpecs`, `MonitorSpecs`).

### 3. GLPI-Agent Ingestion & Hierarchical Reconciliation Pipeline
* The backend exposes `/api/v1/inventory/agent` accepting JSON payloads conforming to the official GLPI-Agent format.
* **Reconciliation Order**:
  1. Priority 1: BIOS / System UUID (`hardware.uuid`).
  2. Priority 2: Serial Number (`bios.ssn`).
  3. Priority 3: Network Interface MAC Address (`networks[].mac`).
  4. Priority 4: Hostname match within the target organizational entity.
* **GLPI Field Locks Protection**: Fields present in `locked_fields` (such as manually assigned locations or user responsibilities) are preserved and shielded from automated agent overwrites.
* **Automatic Connected Asset Provisioning**: Connected monitors reported in the workstation's agent payload are automatically registered and linked into `asset_connections`.

### 4. Interactive Air-Gap / Local Agent Simulator
* To facilitate offline testing and development without requiring an active external `glpi-agent` daemon, the platform includes an in-app simulation endpoint (`/api/v1/inventory/agent/simulate`) with presets (Lenovo ThinkPad T14s, Apple MacBook Pro M3 Max, Dell Precision 5570, HPE ProLiant Server).

## Consequences

### Positive
* **Sub-millisecond inventory ingestion**: Processing an entire agent inventory snapshot executes in a single optimized database transaction.
* **Zero schema migration churn**: Adding custom fields or hardware properties does not require database downtime or alter table operations.
* **GLPI-Agent ecosystem compatibility**: Existing corporate fleets running `glpi-agent` on Windows, Linux, and macOS can connect directly to ITILSuite.
* **Protection of administrative overrides**: IT technicians can lock specific fields to prevent automated overwrites.

### Trade-offs
* Analytics queries requiring deep ad-hoc aggregation across JSONB software lists require JSONB operators instead of standard SQL joins, which is mitigated via GIN indexing and Serde DTOs.
