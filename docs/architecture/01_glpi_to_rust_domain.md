# Domain Mapping: From GLPI 11 to ITILSuite in Rust

This document defines the conceptual mapping between GLPI 11 core modules and the Rust domain architecture for **ITILSuite**.

---

## 1. Core Module & Multi-Tenancy (Entities)

In GLPI, one of the most powerful architectural features is the **Hierarchical Entity Tree** (`glpi_entities`). All domain data (tickets, computers, users, contracts) belongs to an entity or cascades recursively into sub-entities.

### Rust Domain Representation
```rust
pub struct Entity {
    pub id: Uuid,
    pub parent_id: Option<Uuid>, // Hierarchical tree pointer
    pub name: String,
    pub completeness: String,   // Full qualified path: "Root > North Branch > IT"
    pub level: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

Every incoming request in the ITILSuite REST API carries the active entity context (`X-Entity-ID` or JWT claims), ensuring secure data isolation (Row-Level Security or automatic SQLx query scoping).

---

## 2. ITIL Service Desk (Helpdesk)

GLPI implements the three primary ITIL service management disciplines:
1. **Incidents**: Unplanned interruptions or quality reductions of an IT service.
2. **Service Requests**: Formal requests for access, hardware provisioning, or configuration changes.
3. **Problems & Changes**: Root-cause analysis across recurring incidents and structured change approval lifecycles.

### ITIL Priority Matrix
GLPI calculates priority dynamically based on the ITIL standard matrix:
$$\text{Priority} = f(\text{Urgency}, \text{Impact})$$

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TicketType {
    Incident,
    Request,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TicketStatus {
    New,                // Newly created, unassigned
    ProcessingAssigned, // Assigned to technician or group
    ProcessingPlanned,  // Scheduled for maintenance window
    Pending,            // Paused / waiting on user feedback (SLA paused)
    Solved,             // Solution submitted, pending requester sign-off
    Closed,             // Formally accepted and closed
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Level1To5 {
    VeryLow = 1,
    Low = 2,
    Medium = 3,
    High = 4,
    VeryHigh = 5,
}

pub fn calculate_priority(urgency: Level1To5, impact: Level1To5) -> Level1To5 {
    // Standard ITIL Matrix calculation
    let score = ((urgency as u8) + (impact as u8)) / 2;
    match score {
        1 => Level1To5::VeryLow,
        2 => Level1To5::Low,
        3 => Level1To5::Medium,
        4 => Level1To5::High,
        _ => Level1To5::VeryHigh,
    }
}
```

---

## 3. Asset Management (ITAM & CMDB)

GLPI tracks a wide spectrum of assets:
* **Computers & Servers**: CPU, RAM, Disks, Network Interfaces (IP, MAC), Operating Systems, Software packages.
* **Network Devices**: Switches, Routers, VLANs, Physical Ports.
* **Monitors & Peripherals**.
* **Printers & Consumables**.
* **Datacenter Infrastructure**: Racks, PDUs, Enclosures.
* **Software Licenses**: Seat assignments, expiration dates, activation keys.

### Architecture in Rust + PostgreSQL
Instead of GLPI's legacy model of hundreds of flat relational tables for every minute hardware component, ITILSuite leverages **PostgreSQL with Serde-typed JSONB**:
* Relational core for identity, governance, and audit trails (`Asset`, `AssetType`, `Location`, `Entity`, `Status`).
* Dynamic hardware and software specifications indexed via PostgreSQL GIN indexes on JSONB for sub-millisecond search capabilities without requiring continuous schema migrations.

---

## 4. Automated Agent Ingestion (GLPI-Agent Compatibility)

The GLPI-Agent transmits hardware/software inventory payloads via HTTP POST (JSON or XML format).
In Rust:
* A dedicated asynchronous endpoint `/api/v1/inventory/agent` streams and deserializes incoming payloads without blocking worker threads.
* An **Asset Reconciliation Pipeline** checks:
  1. Baseboard UUID / BIOS UUID.
  2. MAC addresses.
  3. Serial numbers.
  4. Hostname and network domain.
* If a matching asset exists, components are updated incrementally; otherwise, a new asset is registered within the appropriate entity based on incoming business rules.

---

## 5. Semantic Release Roadmap
* **v0.0.1**: Architectural foundation, Axum API skeleton, React shell, and Docker Compose.
* **v0.0.2**: Database schema for Hierarchical Entities, Users, RBAC Profiles, and JWT + Argon2 authentication.
* **v0.0.3**: ITIL Service Desk with Ticket lifecycles, SLA timers, and Priority calculation.
* **v0.0.4**: Asset Management & CMDB with GLPI-Agent inventory ingestion endpoint.
