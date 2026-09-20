<p align="center">
  <img src="frontend/public/itilsuite-logo.svg" alt="ITILSuite Logo" width="360" />
</p>

<h3 align="center">Modern, High-Performance Open-Source ITSM, ITAM & CMDB Platform</h3>
<p align="center">Powered by <strong>Rust (Axum + Tokio + SQLx)</strong> & <strong>React 19 + TypeScript</strong></p>

<div align="center">

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/version-0.0.7-informational.svg)](https://github.com/aalexanderdev/ITILSuite/releases)
[![Downloads](https://img.shields.io/github/downloads/aalexanderdev/ITILSuite/total.svg?color=blue)](https://github.com/aalexanderdev/ITILSuite/releases)
[![Mastodon](https://img.shields.io/badge/Mastodon-@aalexander-6364FF.svg?logo=mastodon&logoColor=white)](https://mastodon.social/@aalexander)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Node](https://img.shields.io/badge/node-v20%2B-green.svg)](https://nodejs.org/)

</div>

---

## Vision & Architectural Philosophy

GLPI is an industry standard for IT service and asset management across enterprises worldwide. **ITILSuite** takes the foundational concepts of GLPI (hierarchical multi-tenancy, complete ITIL ticket lifecycles, fine-grained inventory, agent reconciliation, and mail collectors) and re-engineers them with modern systems design:

* **High-Throughput, Memory-Safe Backend in Rust**: Asynchronous runtime powered by **Tokio** and **Axum**, sub-millisecond API response latencies, minimal RAM footprint, and compile-time type safety across all ITIL state machines.
* **Asynchronous Mail & Background Workers**: Asynchronous ingestion and dispatch workers driven by Tokio, separating long-running email polling and SMTP delivery from HTTP client requests.
* **High-Density, Dual-Theme Frontend**: Built with **React 19, TypeScript, and Vite** delivering an enterprise-grade high-density desktop experience (Dark Cyber-Navy and Clean Light themes) using local Geist fonts and accessible native components with zero third-party UI framework bloat.
* **Strict Hierarchical Multi-Tenancy**: Recursive entity tree scoping all assets, tickets, templates, collectors, and users across parent and child organizational units.
* **Automated Agent Ingestion**: High-concurrency ingestion of hardware and software inventory snapshots compatible with the GLPI-Agent ecosystem.

---

## Key Features (v0.0.5)

### 1. Multi-Tenant Entity Hierarchy & RBAC
* Recursive entity tree (GLPI-compatible hierarchical structure).
* Scope switching with parent-child inheritance.
* Role-based access control (Super-Admin, Admin, Technician, Self-Service) with Argon2id password hashing and JWT authentication.

### 2. ITIL Service Desk (Tickets & Lifecycles)
* Incident and Service Request lifecycles (`New`, `Assigned`, `Planned`, `Pending`, `Solved`, `Closed`).
* Urgency (1-5) x Impact (1-5) 5x5 matrix computing ITIL Priority (`P1-Very High` to `P5-Very Low`) with SLA tracking.
* Followup timeline with support for private technician notes and formal solution proposals.
* GLPI-style Ticket Templates:
  * Predefined fields (standardized titles, technical questionnaire descriptions, default technician assignment).
  * Mandatory field validation rules.
  * Hidden fields to streamline simplified user request forms.
  * Automatic template binding based on ITIL category selection.

### 3. Mail Ingestion & Notification Engine
* **Mail Receivers (Collectors)**: Ingestion via IMAP and POP3 with SSL/TLS encryption.
* **Thread Matching & Reply Stripping**: Regex parsing (`[#INC-2026-XXXX]` and `[#REQ-2026-XXXX]`) to append followups directly to existing tickets while cleaning previous email quote headers.
* **Anti-Spam Blacklists**: Exclusion rules by sender email, domain, or subject regex pattern.
* **Dynamic Notification Templates (Gabarits)**: Tag substitution engine (`##ticket.number##`, `##ticket.title##`, `##author.name##`, `##technician.name##`, `##signature##`, etc.) with real-time HTML/text preview.
* **Asynchronous Outbox Queue**: Persistent `notification_queue` processed by a dedicated Tokio background worker with automatic retry policies and audit status (`pending`, `sent`, `failed`).
* **Air-Gap / Offline Mail Simulator**: In-app simulator for testing incoming mail ticket generation and replies in isolated or air-gapped deployments.

### 4. Asset Management (ITAM & CMDB) & GLPI-Agent Compatibility
* **Unified Hardware Inventory**: Multi-category tracking for Computers, Servers, Network Equipments (Switches/Routers), and Monitors.
* **Serde-Typed JSONB Specifications**: CPU telemetry, memory slots, disk partition gauges, and software lists indexed via PostgreSQL GIN indexes for sub-millisecond retrieval.
* **Automated GLPI-Agent Ingestion Pipeline**: Dedicated REST endpoint `/api/v1/inventory/agent` compatible with the official `glpi-agent` daemon format.
* **Hierarchical Reconciliation Pipeline**:
  * Level 1: System BIOS UUID matching.
  * Level 2: Motherboard Serial Number matching.
  * Level 3: Network interface MAC address matching.
  * Level 4: Organizational entity hostname resolution.
* **GLPI Field Locks Protection**: Manual administrator field overrides (locations, technician assignment) shielded against agent overwriting.
* **Automated Connected Monitor Discovery**: Automatic detection, registration, and linking of connected displays reported by workstations.
* **Interactive Agent Simulator**: In-app simulator with realistic hardware presets for rapid local/offline validation.

### 5. HelpdeskChat & Real-Time Telemetry Subsystem (Inspired by GLPI helpdesk-chat)
* **Native Rust WebSockets (`/api/v1/chat/ws`)**: High-performance multi-channel WebSocket hub with `axum::extract::ws` and `tokio::sync::broadcast` for instantaneous messaging, typing indicators, reactions, and live presence updates.
* **Bi-directional Service Desk Integration**: One-click message-to-ticket conversion with ITIL priority calculations and live reciprocal links.
* **Automated Ticket Event Notifications**: Real-time push notifications dispatched to requesters and assigned technicians on ticket creation.
* **Docked Interactive Chat Widget (`HelpdeskChatWidget`)**:
  * Collapsible sections: Live online agents, pinned channels, group rooms, and direct/system notices.
  * Shortcut buttons bar for instant navigation to self-service portals and knowledge bases.
  * Atomic emoji reactions (👍, ❤️, 🚀, 👀) with live counts.
* Incident and Service Request lifecycles.
* GLPI-style Urgency x Impact priority matrix (5x5).
* Ticket templates with predefined, mandatory, and hidden fields.
* Technician dispatch, group assignments (`assigned_group_id`), and requester group attribution (`requester_group_id`).

### 3. Asynchronous Notification Engine
* Mail Receivers (IMAP/POP3 collectors) with ticket thread matching and spam filtering.
* Dynamic notification templates with macro tag replacement.
* Asynchronous outbox delivery worker powered by Tokio, resolving individual and group recipients.

### 4. Asset Management (ITAM / CMDB)
* Hardware inventory (computers, servers, monitors, networking gear).
* GLPI-Agent compatible HTTP ingestion endpoint with a 4-level reconciliation pipeline.
* Field lock mechanism protecting technician-defined fields from automated overwrite.
* Group asset custody and maintenance responsibility (`group_id`).

### 5. Real-Time HelpdeskChat
* Native WebSocket endpoint (`/api/v1/chat/ws`) with typing indicators, presence, and reactions.
* Direct conversion of chat conversations into ITIL tickets.
* Automated synchronization with transversal group channels.

### 6. Business Rules & Dictionaries Normalization Engine (Inspired by GLPI)
* **High-Throughput Rust Rule Engine (`RuleEngine`)**:
  * 11 conditional evaluation operators (`equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex_match` with capture interpolation `$1..$N`, `in_subnet` for CIDR blocks like `192.168.10.0/24`, `is_empty`, and `is_not_empty`).
  * Pipeline execution with configurable match logic (`AND` / `OR`), priority rankings, fallback catch-all rules, and `stop_on_first_match` short-circuiting.
* **4 Comprehensive Business Rule Domains**:
  * **Helpdesk Rules**: Ticket mutation, entity assignment, and problem/change rules.
  * **Assets & Inventory Rules**: Hardware entity routing (CIDR, tags) and equipment reconciliation.
  * **Authorization & Authentication Rules**: Dynamic profile, entity, and transversal group assignment.
  * **Dictionaries & Normalization Engines (10 Specialized Subtypes)**: Manufacturers, OS, Architectures, Software, Hardware Models.
* **Interactive Frontend Workspace (`RuleManagementView`)**: Rule cards, inline priority reordering, Criteria/Action builders, and zero-side-effect Sandbox Simulator.

### 7. User Ingestion & Transversal Groups Architecture
* **High-Throughput Batch User Ingestion Engine**:
  * Multi-format bulk user onboarding via CSV and JSON (`/api/v1/users/batch-import`).
  * Conflict resolution policies (`skip` vs `overwrite`).
  * Schema validation, credential hashing (Argon2id), entity pre-assignment, and group joining.
  * Interactive import wizard with downloadable CSV template and syntax validation.
* **Transversal Groups Architecture (`groups` & `group_users`)**:
  * Centralized group directory with transversal capabilities (`is_task`, `is_requester`, `is_user_group`, `is_recursive`).
  * Flexible scoping: Global transversal teams or entity-scoped with recursive inheritance.
  * Hierarchical leadership roles (`is_manager`) distinguishing supervisors from regular members.
* **Cross-Cutting Transversal Integrations**:
  * **Service Desk**: Team queues, group assignment picker, and requester group attribution.
  * **HelpdeskChat**: Dynamic team rooms synchronized with group rosters (e.g. `#soporte-nivel-1`).
  * **Notifications**: Asynchronous fan-out resolving all active group members in the Tokio outbox worker.
  * **CMDB**: Asset responsible team ownership (`group_id`).

### 8. User Experience & Design
* **Dual-theme support**:
  * **Warm Tones Dark Mode**: Built on the official Material Design 2 Dark Theme specification with elevation overlay levels (`00dp` to `24dp`), deep espresso charcoal surface (`#141210`), warm parchment typography (`#F6F0EA`), desaturated accents, and cozy atmospheric ambient glow.
  * **Clean Light Mode**: Crisp corporate OpenITIL layout with high-contrast slate surfaces.
* Air-gap ready typography: 100% locally served Geist and Geist Mono font bundles.
* Native, zero-dependency UX primitives: Shimmer skeleton loaders, accessible directional tooltips, and non-blocking toast notifications.

---

## Project Architecture

```text
ITILSuite/
├── backend/                # REST & WebSocket backend in Rust (Axum + Tokio + SQLx)
│   ├── src/
│   │   ├── api/            # HTTP & WS routes (/health, /tickets, /entities, /users, /groups, /mail, /inventory, /chat, /rules)
│   │   ├── domain/         # ITIL domain models (Tickets, Templates, Assets, Chat, Notifications, Rules, Groups)
│   │   ├── services/       # Business logic (TicketService, AssetService, ChatService, MailService, RuleEngine)
│   │   ├── config.rs       # Environment variable parsing and defaults
│   │   ├── error.rs        # Typed application errors and JSON responses
│   │   └── main.rs         # HTTP server, WS broadcast hub, background workers, and Swagger routes
│   ├── migrations/         # Deterministic SQLx PostgreSQL migrations
│   └── Cargo.toml
│
├── frontend/               # Web client in React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # High-density UI modules (tickets, assets, chat, rules, users, notifications, layout)
│   │   ├── context/        # React context providers (AuthContext, ThemeContext, ToastContext)
│   │   ├── services/       # Typed HTTP & WebSocket API clients
│   │   ├── types.ts        # TypeScript interfaces and DTOs
│   │   ├── index.css       # Unified CSS design system and tokens
│   │   └── App.tsx         # Main application shell and workspace routing
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                   # Architectural documentation & ADRs
│   ├── architecture/       # Domain mapping and API design guidelines
│   └── adr/                # Architecture Decision Records (ADR 0001, etc.)
│
├── docker-compose.yml      # Local dev environment (PostgreSQL 16, Mailpit)
├── CHANGELOG.md            # SemVer change log
└── README.md
```

For deeper architectural context, see:
* [ADR 0001: Architecture and Tech Stack Selection](docs/adr/0001_initial_tech_stack.md)
* [Domain Mapping: From Legacy ITSM to ITILSuite in Rust](docs/architecture/01_glpi_to_rust_domain.md)

---

## Quick Start (Local Development)

### Prerequisites
* **Rust** (1.75+) and **Cargo**
* **Node.js** (v20+) and **npm**
* **Docker** and **Docker Compose**

### 1. Clone the Repository
```bash
git clone https://github.com/aalexanderdev/ITILSuite.git
cd ITILSuite
```

### 2. Start Auxiliary Services (Database & Mailpit)
```bash
docker compose up -d
```
* **PostgreSQL**: `localhost:5432` (user: `itilsuite`, password: `itilsuite_dev_password`, db: `itilsuite_db`)
* **Mailpit (Web UI)**: [http://localhost:8025](http://localhost:8025)

### 3. Run the Rust Backend
```bash
cd backend
cp .env.example .env
cargo run
```
The backend server will listen on `http://localhost:8081`.
* **Healthcheck**: [http://localhost:8081/api/v1/health](http://localhost:8081/api/v1/health)
* **Swagger UI Documentation**: [http://localhost:8081/swagger-ui](http://localhost:8081/swagger-ui)

### 4. Run the React Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
The web dashboard will be available at [http://localhost:5173](http://localhost:5173).

---

## Release Roadmap

- [x] **v0.0.1 - Architectural Foundation**: Axum backend skeleton, React/TS frontend shell, architecture docs, and Docker Compose.
- [x] **v0.0.2 - Multi-Tenancy & Authentication**: Hierarchical Entity tree, Users directory, RBAC profiles, and Argon2id/JWT authentication.
- [x] **v0.0.3 - ITIL Service Desk & Notification Engine**:
  - Incidents & Service Requests lifecycle pipeline.
  - Urgency x Impact priority matrix (5x5).
  - GLPI Ticket Templates (predefined, mandatory, hidden fields).
  - Mail Receivers (IMAP/POP3 collectors) with thread matching and anti-spam blacklists.
  - Dynamic notification templates with tag replacement.
  - Tokio asynchronous background outbox queue worker.
  - High-density dual theme (Dark Cyber-Navy & Clean Light) with local Geist fonts.
- [x] **v0.0.4 - Asset Management (ITAM / CMDB) & Real-Time HelpdeskChat**:
  - Inventory of computers, network gear, monitors, and servers with component telemetry.
  - GLPI-Agent compatible HTTP POST ingestion endpoint with 4-level reconciliation pipeline.
  - GLPI Field Lock protection to preserve manual technician edits.
  - Interactive agent preset simulator and high-density CMDB workspace.
  - Real-time WebSockets chat engine (`/api/v1/chat/ws`) with single-click conversion to ITIL tickets.
  - Material Design 2 Dark Theme Elevation System with Warm Tones palette (WCAG AAA).
- [x] **v0.0.5 - Business Rules & Normalization Dictionaries**:
  - Unified metarule evaluation engine in Rust (`RuleEngine`) with 11 operators (regex interpolation `$1..$N`, CIDR subnets).
  - 4 Business Rule domains: Helpdesk, Assets & ITAM, Authorization, and 10 Normalization Dictionaries.
  - In-flight pipeline integrations across Agent Ingestion, Mail Receivers, and Service Desk.
  - Interactive visual Rule Management console, dynamic Criteria/Action editor modal, and zero-side-effect Sandbox Simulator with microsecond benchmarks.
- [x] **v0.0.6 - User Ingestion & Transversal Groups Management**:
  - **Batch User Ingestion**: Bulk CSV/JSON import parser with field mapping, schema validation, and role/entity pre-assignment.
  - **Transversal Groups Architecture**: Centralized group directory (`groups`, `group_users`, `group_entities`) supporting cross-cutting team structures, leader roles, and entity scoping.
  - **Cross-Platform Transversal Integrations**:
    - **HelpdeskChat**: Dynamic team rooms synchronized with group rosters, group-level `@mention` targeting (`@soporte-l1`, `@redes`), and broadcast announcements.
    - **ITIL Service Desk**: Group-based ticket assignment, technician team queues, requester group tracking, and escalation routing.
    - **ITAM / CMDB**: Group asset custody, department allocation, and maintenance responsibility (`group_in_charge`).
- [x] **v0.0.7 - Advanced SLAs & Automated Escalation Matrices**:
  - **Real-Time SLA Engine**: Working calendar arithmetic (weekly schedules 9x5 / 24x7, corporate holidays, timezone shifts) calculating dynamic TTO and TTR deadlines.
  - **Automated Escalation Matrix**: Idempotent relative-trigger rules (`-30m`, `0m`, `+60m`) with automated priority elevation, group reassignment, and supervisor alert dispatch.
  - **Interactive Management Workspace**: 3-tab SLA management console (SLA Profiles, Escalation Matrix, Working Calendars with live deadline simulation).
  - **Service Desk Visual Indicators**: SLA risk badges, real-time countdowns, mini progress bars, and SLA filter dropdowns across ticket lists and detail dialogs.
- [ ] **v0.0.8 - ITIL Problem & Change Management**: Known error database (KEDB), root cause analysis, Change Advisory Board (CAB), and RFC approval lifecycles.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the Licenses or any later version (GPLv3+)**.

See the [LICENSE](LICENSE) file for details.
