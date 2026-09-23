<p align="center">
  <img src="backend/static/img/itilsuite-logo.svg" alt="ITILSuite Logo" width="360" />
</p>

<h3 align="center">Modern, High-Performance Open-Source ITSM, ITAM & CMDB Platform</h3>
<p align="center">Powered by <strong>Rust (Axum + Tokio + SQLx)</strong> & <strong>Native Server-Side Rendering (Askama + HTMX)</strong></p>

<div align="center">

[![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Version](https://img.shields.io/badge/version-0.0.8-informational.svg)](https://github.com/aalexanderdev/ITILSuite/releases)
[![Downloads](https://img.shields.io/github/downloads/aalexanderdev/ITILSuite/total.svg?color=blue)](https://github.com/aalexanderdev/ITILSuite/releases)
[![Mastodon](https://img.shields.io/badge/Mastodon-@aalexander-6364FF.svg?logo=mastodon&logoColor=white)](https://mastodon.social/@aalexander)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![HTMX](https://img.shields.io/badge/HTMX-2.0-blue.svg)](https://htmx.org/)

</div>

---

## Vision & Architectural Philosophy

GLPI is an industry standard for IT service and asset management across enterprises worldwide. **ITILSuite** takes the foundational concepts of GLPI (hierarchical multi-tenancy, complete ITIL ticket lifecycles, fine-grained inventory, agent reconciliation, and mail collectors) and re-engineers them with modern systems design:

* **High-Throughput, Memory-Safe Backend in Rust**: Asynchronous runtime powered by **Tokio** and **Axum**, sub-millisecond API response latencies, minimal RAM footprint (~20-40MB), and compile-time type safety across all ITIL state machines.
* **Native Server-Side Rendering (SSR) with HTMX**: Build-time compiled HTML templates via **Askama** and seamless reactive updates via **HTMX**, generating dynamic desktop-grade interfaces with sub-millisecond render times and zero Node.js/npm runtime dependencies.
* **Material Design 2 Warm Dark & Clean Light Themes**: Curated dual-theme design system featuring warm espresso surfaces (`#141210`), warm parchment typography (`#F6F0EA`), elevation overlays (`00dp` to `24dp`), and local Geist font bundles with zero external CDN dependencies.
* **Asynchronous Mail & Background Workers**: Asynchronous ingestion and dispatch workers driven by Tokio, separating long-running email polling and SMTP delivery from HTTP client requests.
* **Strict Hierarchical Multi-Tenancy**: Recursive entity tree scoping all assets, tickets, templates, collectors, and users across parent and child organizational units.
* **Automated Agent Ingestion**: High-concurrency ingestion of hardware and software inventory snapshots compatible with the GLPI-Agent ecosystem.

---

## Key Features (v0.0.8)

### 1. Multi-Tenant Entity Hierarchy & RBAC
* Recursive entity tree (`/entities`) with full hierarchical path calculation (`Root Entity > Regional > Dept`).
* Scope switching with parent-child inheritance.
* Role-based access control (Super-Admin, Admin, Technician, Self-Service) with Argon2id password hashing and session cookie/JWT authentication.
* User directory (`/users`) with role badges, transversal group memberships, and inline HTMX status toggles.

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
* **Dedicated Mail Console (`/mail-config`)**:
  * Outbound SMTP configuration with live HTMX connection testing against local Mailpit or remote relays.
  * Inbound mail collector controls with 1-click manual collection and active toggling.
  * Air-gap incoming email simulator to test ticket creation without external mailboxes.
  * Persistent outbound notification queue (`notification_queue`) with manual flush and retry actions.

### 4. Asset Management (ITAM & CMDB) & GLPI-Agent Compatibility
* **Unified Hardware Inventory (`/assets`, `/computers`, `/network`)**: Multi-category tracking for Computers, Servers, Network Equipments (Switches/Routers), and Monitors.
* **Serde-Typed JSONB Specifications**: Detailed diagnostic spec sheets (`/assets/:id`) for CPU telemetry, memory slots, disk partition gauges, and software packages.
* **Automated GLPI-Agent Ingestion Pipeline**: Dedicated REST endpoint `/api/v1/inventory/agent` compatible with the official `glpi-agent` daemon format.
* **Hierarchical Reconciliation Pipeline**:
  * Level 1: System BIOS UUID matching.
  * Level 2: Motherboard Serial Number matching.
  * Level 3: Network interface MAC address matching.
  * Level 4: Organizational entity hostname resolution.
* **GLPI Field Locks Protection**: Manual administrator field overrides shielded against automated agent overwriting.
* **Contracts, Warranties & Licenses (`/contracts`)**: Centralized tracking of vendor agreements, hardware maintenance warranties, and software licensing.

### 5. HelpdeskChat & Real-Time Telemetry Subsystem
* **Native Rust WebSockets (`/api/v1/chat/ws`)**: High-performance multi-channel WebSocket hub with `axum::extract::ws` and `tokio::sync::broadcast` for instantaneous messaging, typing indicators, reactions, and live presence updates.
* **Bi-directional Service Desk Integration**: One-click message-to-ticket conversion with ITIL priority calculations and live reciprocal links.
* **Automated Ticket Event Notifications**: Real-time push notifications dispatched to requesters and assigned technicians on ticket creation.
* **Live Telemetry & Floating Widget**: Analytics dashboard (`/chat-analytics`) and docked floating chat interface.

### 6. Business Rules & Dictionaries Normalization Engine
* **High-Throughput Rust Rule Engine (`RuleEngine`)**:
  * 11 conditional evaluation operators (`equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex_match` with capture interpolation `$1..$N`, `in_subnet` for CIDR blocks like `192.168.10.0/24`, `is_empty`, and `is_not_empty`).
  * Pipeline execution with configurable match logic (`AND` / `OR`), priority rankings, fallback catch-all rules, and `stop_on_first_match` short-circuiting.
* **4 Comprehensive Business Rule Domains (`/rules`, `/rules/new`)**:
  * **Helpdesk Rules**: Ticket mutation, entity assignment, and problem/change rules.
  * **Assets & Inventory Rules**: Hardware entity routing (CIDR, tags) and equipment reconciliation.
  * **Authorization & Authentication Rules**: Dynamic profile, entity, and transversal group assignment.
  * **Dictionaries & Normalization Engines (10 Specialized Subtypes)**: Manufacturers, OS, Architectures, Software, Hardware Models.

### 7. User Ingestion & Transversal Groups Architecture
* **High-Throughput Batch User Ingestion Engine**:
  * Multi-format bulk user onboarding via CSV and JSON (`/api/v1/users/batch-import`).
  * Conflict resolution policies (`skip` vs `overwrite`).
  * Schema validation, credential hashing (Argon2id), entity pre-assignment, and group joining.
* **Transversal Groups Architecture (`groups` & `group_users`)**:
  * Centralized group directory with transversal capabilities (`is_task`, `is_requester`, `is_user_group`, `is_recursive`).
  * Cross-cutting integration across Service Desk (team queues), HelpdeskChat (team rooms), Notifications (fan-out), and CMDB (asset custody).

### 8. Real-Time Service Level Agreements (SLAs) & Working Calendars
* **Real-Time Calendar Arithmetic Engine**: Precision computation of TTO (Time to Own) and TTR (Time to Resolve) targets across weekly shift segments (e.g. 9x5 or 24x7) skipping weekends and corporate holidays.
* **Automated Escalation Matrices**: Tiered multi-action escalations (priority bump, group reassignment, technician dispatch, alert notification) executed idempotently via `ticket_sla_escalations_log`.
* **Proactive Tokio SLA Monitor**: Real-time evaluation background worker scanning open tickets and transitioning status (`within_sla` -> `at_risk` -> `breached`).

### 9. Native Surveys & Customer Satisfaction Management (CSAT / NPS)
* **Multi-Entity Survey Management (`/surveys`)**: Scoped surveys with recursive child inheritance, default fallback, and customizable expiration (`ttl_days_override`).
* **9 Native Question Types**: 1-5 Star Ratings, NPS (0-10 Scale), Yes/No, Radio Choice, Multi-Checkbox, Dropdown, Short Text, Long Textarea, and Date.
* **Dynamic Conditional Logic**: Real-time question revelation based on previous answer values (e.g., prompting for improvement suggestions only when CSAT is `<=3`).
* **Starter Presets with 1-Click Instantiation**: Ready-to-use templates for CSAT Estándar, Net Promoter Score, and Technical Support Quality (FCR).
* **Deep Survey Cloning**: 1-click duplication replicating all nested questions, options, and conditional dependency graphs.
* **Cryptographic Access Tokens**: Tamper-proof 64-character tokens supporting draft autosave and single-use atomic completion.
* **Standalone Public Responder (`/survey/public/:token`)**: Zero-login responsive questionnaire with mobile and desktop support.
* **Ticket Lifecycle Automation**: Automatic token generation on ticket resolution, 1-click sharing (WhatsApp, Teams, Email), and customer responses logged as private timeline followups.

### 10. Floating Dock Navigation & User Experience
* **Interactive Floating Dock (`dock.html`)**: Bottom navigation bar providing one-click access and contextual flyout menus across all 11 system domains:
  * Service Desk (`/tickets`, `/tickets/new`)
  * CMDB & Assets (`/assets`, `/computers`, `/network`)
  * HelpdeskChat (`/chat-analytics`)
  * Customer Surveys (`/surveys`)
  * Contracts & Licenses (`/contracts`)
  * Entities & Hierarchy (`/entities`)
  * Users & Directory (`/users`)
  * Rules & Automation (`/rules`)
  * Mail & Collectors (`/mail-config`)
  * Administration & Settings (`/admin`)
* **100% Navigation Parity**: Zero broken links or 404s across the entire application shell.

---

## Project Architecture

```text
ITILSuite/
├── backend/                # Unified Rust Server (Axum + Tokio + SQLx + Askama + HTMX)
│   ├── src/
│   │   ├── api/            # REST & WebSocket API (/tickets, /entities, /users, /inventory, /chat, /rules, /surveys, etc.)
│   │   ├── domain/         # ITIL domain models (Tickets, Templates, Assets, Chat, Notifications, Rules, Groups, Surveys)
│   │   ├── services/       # Business logic (TicketService, AssetService, ChatService, MailService, RuleEngine, SurveyService)
│   │   ├── web/            # SSR Controllers & Askama template structs (routes.rs, templates.rs, auth.rs)
│   │   ├── config.rs       # Environment variable parsing and defaults
│   │   ├── error.rs        # Typed application errors
│   │   └── main.rs         # HTTP/WS server, SSR routing, background workers, and Swagger routes
│   ├── templates/          # Askama HTML templates (Base, Dock, Pages, Partials)
│   │   ├── components/     # Dock, navbar, chat widget, modals
│   │   ├── pages/          # Full SSR views (/tickets, /assets, /surveys, /mail-config, /rules, /entities, /users, /contracts)
│   │   └── partials/       # Reactive HTMX snippets (smtp_test_result, collect_result, etc.)
│   ├── static/             # Static web assets (main.css, fonts, icons, js)
│   ├── migrations/         # Deterministic SQLx PostgreSQL migrations
│   └── Cargo.toml
│
├── frontend/               # [ARCHIVED / LEGACY] Original React 19 + TypeScript prototype
│
├── docs/                   # Architectural documentation & ADRs
│   ├── architecture/       # Domain mapping and API design guidelines
│   └── adr/                # Architecture Decision Records (ADR 0001 to 0004)
│
├── docker-compose.yml      # Local dev environment (PostgreSQL 16, Mailpit)
├── CHANGELOG.md            # SemVer change log
└── README.md
```

For deeper architectural context, see:
* [ADR 0001: Initial Tech Stack & Architecture](docs/adr/0001_initial_tech_stack.md)
* [ADR 0002: Asset Management & GLPI-Agent Ingestion](docs/adr/0002_asset_management_and_glpi_agent.md)
* [ADR 0003: Transversal Groups & Batch User Ingestion](docs/adr/0003_transversal_groups_and_batch_user_ingestion.md)
* [ADR 0004: Web SSR Migration with Askama and HTMX](docs/adr/0004_web_ssr_migration_with_askama_and_htmx.md)
* [Domain Mapping: From Legacy ITSM to ITILSuite in Rust](docs/architecture/01_glpi_to_rust_domain.md)

---

## Quick Start (Local Development)

### Prerequisites
* **Rust** (1.75+) and **Cargo**
* **Docker** and **Docker Compose**
*(No Node.js, npm, or external frontend build tools required)*

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

### 3. Run ITILSuite
```bash
cd backend
cp .env.example .env
cargo run --bin itilsuite-backend
```
The server will listen on `http://localhost:8081`.
* **Web Application (SSR)**: [http://localhost:8081](http://localhost:8081) *(Default credentials: `admin` / `admin`)*
* **Healthcheck**: [http://localhost:8081/api/v1/health](http://localhost:8081/api/v1/health)
* **Swagger UI Documentation**: [http://localhost:8081/swagger-ui](http://localhost:8081/swagger-ui)

---

## Release Roadmap

- [x] **v0.0.1 - Architectural Foundation**: Axum backend skeleton, architecture docs, and Docker Compose.
- [x] **v0.0.2 - Multi-Tenancy & Authentication**: Hierarchical Entity tree, Users directory, RBAC profiles, and Argon2id/JWT authentication.
- [x] **v0.0.3 - ITIL Service Desk & Notification Engine**:
  - Incidents & Service Requests lifecycle pipeline.
  - Urgency x Impact priority matrix (5x5).
  - GLPI Ticket Templates (predefined, mandatory, hidden fields).
  - Mail Receivers (IMAP/POP3 collectors) with thread matching and anti-spam blacklists.
  - Dynamic notification templates with tag replacement.
  - Tokio asynchronous background outbox queue worker.
- [x] **v0.0.4 - Asset Management (ITAM / CMDB) & Real-Time HelpdeskChat**:
  - Inventory of computers, network gear, monitors, and servers with component telemetry.
  - GLPI-Agent compatible HTTP POST ingestion endpoint with 4-level reconciliation pipeline.
  - GLPI Field Lock protection to preserve manual technician edits.
  - Real-time WebSockets chat engine (`/api/v1/chat/ws`) with single-click conversion to ITIL tickets.
- [x] **v0.0.5 - Business Rules & Normalization Dictionaries**:
  - Unified metarule evaluation engine in Rust (`RuleEngine`) with 11 operators (regex interpolation `$1..$N`, CIDR subnets).
  - 4 Business Rule domains: Helpdesk, Assets & ITAM, Authorization, and 10 Normalization Dictionaries.
  - In-flight pipeline integrations across Agent Ingestion, Mail Receivers, and Service Desk.
- [x] **v0.0.6 - User Ingestion & Transversal Groups Management**:
  - **Batch User Ingestion**: Bulk CSV/JSON import parser with field mapping, schema validation, and role/entity pre-assignment.
  - **Transversal Groups Architecture**: Centralized group directory (`groups`, `group_users`, `group_entities`) supporting cross-cutting team structures, leader roles, and entity scoping.
  - **Cross-Platform Transversal Integrations**: HelpdeskChat team rooms, ITIL Service Desk queues, and CMDB asset custody.
- [x] **v0.0.7 - Advanced SLAs & Automated Escalation Matrices**:
  - **Real-Time SLA Engine**: Working calendar arithmetic (weekly schedules 9x5 / 24x7, corporate holidays, timezone shifts) calculating dynamic TTO and TTR deadlines.
  - **Automated Escalation Matrix**: Idempotent relative-trigger rules (`-30m`, `0m`, `+60m`) with automated priority elevation, group reassignment, and supervisor alert dispatch.
- [x] **v0.0.8 - Web SSR Migration & Customer Satisfaction (CSAT/NPS)**:
  - Complete 5-phase full-stack migration to native Server-Side Rendering (Axum + Askama + HTMX) with Material Design 2 Warm Dark & Clean Light design system.
  - Phase 1: Authentication, session cookies, and interactive floating Dock.
  - Phase 2 & 2.5: Service Desk views (`/tickets`, `/tickets/:id`, `/tickets/new`), timeline followups, and HelpdeskChat analytics (`/chat-analytics`).
  - Phase 3: Customer Satisfaction subsystem (`/surveys`) with 9 question types, conditional logic, cryptographic tokens, and public responder (`/survey/public/:token`).
  - Phase 4: CMDB inventory (`/assets`, `/assets/:id`), entity hierarchy (`/entities`), user management (`/users`), and business rules (`/rules`, `/rules/new`).
  - Phase 5: Mail configuration console (`/mail-config`), live SMTP test, inbound collectors, incoming simulator, contracts directory (`/contracts`), and 100% Dock link completion.
  - Deprecation and archival of the legacy React prototype.
- [ ] **v0.0.9 - ITIL Problem & Change Management**: Known error database (KEDB), root cause analysis, Change Advisory Board (CAB), and RFC approval lifecycles.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the Licenses or any later version (GPLv3+)**.

See the [LICENSE](LICENSE) file for details.
