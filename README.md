# ITILSuite

> **Modern, high-performance open-source ITSM (IT Service Management), ITAM (IT Asset Management), and CMDB platform inspired by GLPI 11**, powered by **Rust (Axum + Tokio + SQLx)** on the backend and **React + TypeScript** on the frontend.

[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Node](https://img.shields.io/badge/node-v20%2B-green.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-0.0.4-brightgreen.svg)](CHANGELOG.md)

---

## Vision & Architectural Philosophy

GLPI is an industry standard for IT service and asset management across enterprises worldwide. **ITILSuite** takes the foundational concepts of GLPI (hierarchical multi-tenancy, complete ITIL ticket lifecycles, fine-grained inventory, agent reconciliation, and mail collectors) and re-engineers them with modern systems design:

* **High-Throughput, Memory-Safe Backend in Rust**: Asynchronous runtime powered by **Tokio** and **Axum**, sub-millisecond API response latencies, minimal RAM footprint, and compile-time type safety across all ITIL state machines.
* **Asynchronous Mail & Background Workers**: Asynchronous ingestion and dispatch workers driven by Tokio, separating long-running email polling and SMTP delivery from HTTP client requests.
* **High-Density, Dual-Theme Frontend**: Built with **React 19, TypeScript, and Vite** delivering an enterprise-grade high-density desktop experience (Dark Cyber-Navy and Clean Light themes) using local Geist fonts and accessible native components with zero third-party UI framework bloat.
* **Strict Hierarchical Multi-Tenancy**: Recursive entity tree scoping all assets, tickets, templates, collectors, and users across parent and child organizational units.
* **Automated Agent Ingestion (Planned)**: Architecture prepared for high-concurrency ingestion of hardware and software inventory snapshots compatible with the GLPI-Agent ecosystem.

---

## Key Features (v0.0.3)

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

### 5. User Experience & Design
* Dual-theme support: Dark Cyber-Navy and Clean Light modes.
* Air-gap ready typography: 100% locally served Geist and Geist Mono font bundles.
* Native, zero-dependency UX primitives: Shimmer skeleton loaders, accessible directional tooltips, and non-blocking toast notifications.

---

## Project Architecture

```text
ITILSuite/
├── backend/                # REST API backend in Rust (Axum + Tokio + SQLx)
│   ├── src/
│   │   ├── api/            # HTTP routes (/health, /tickets, /entities, /users, /mail, /receivers)
│   │   ├── domain/         # ITIL domain models (Tickets, Templates, Entities, Notifications)
│   │   ├── services/       # Business logic (TicketService, MailService, ReceiverService, AuthService)
│   │   ├── config.rs       # Environment variable parsing and defaults
│   │   ├── error.rs        # Typed application errors and JSON responses
│   │   └── main.rs         # HTTP server, background workers, and OpenAPI / Swagger routes
│   ├── migrations/         # Deterministic SQLx PostgreSQL migrations
│   └── Cargo.toml
│
├── frontend/               # Web client in React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # High-density UI modules (tickets, notifications, entities, users, layout)
│   │   ├── context/        # React context providers (AuthContext, ThemeContext, ToastContext)
│   │   ├── services/       # Typed HTTP API clients and connectivity diagnostics
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
* [Domain Mapping: From GLPI 11 to ITILSuite in Rust](docs/architecture/01_glpi_to_rust_domain.md)

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
- [x] **v0.0.4 - Asset Management (ITAM / CMDB)**:
  - Inventory of computers, network gear, monitors, and servers.
  - GLPI-Agent compatible HTTP POST ingestion endpoint.
  - 4-level reconciliation pipeline with field lock protection.
  - Interactive agent preset simulator and high-density CMDB workspace.
- [ ] **v0.0.5 - Business Rules Engine & Advanced SLAs**: Automated routing rules, escalation matrices, and SLA breach monitors.

---

## License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version (GPLv3+)**.

See the [LICENSE](LICENSE) file for details.
