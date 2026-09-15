# ITILSuite 🚀

> **Modern, high-performance open-source ITSM (IT Service Management), ITAM (IT Asset Management), and CMDB platform inspired by GLPI 11**, powered by **Rust (Axum + Tokio)** on the backend and **React + TypeScript** on the frontend.

[![License: GPL v3+](https://img.shields.io/badge/License-GPLv3%2B-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Node](https://img.shields.io/badge/node-v20%2B-green.svg)](https://nodejs.org/)
[![Version](https://img.shields.io/badge/version-0.0.1-brightgreen.svg)](CHANGELOG.md)

---

## 📖 Vision & Architectural Philosophy

GLPI is an industry pillar for IT service and asset management across enterprises worldwide. **ITILSuite** takes the foundational strengths of GLPI (hierarchical multi-tenancy, complete ITIL ticket lifecycles, fine-grained inventory, and agent reconciliation) and rebuilds them using modern systems engineering:

* **High-Throughput, Memory-Safe Backend in Rust**: Massive concurrency natively powered by **Tokio** and **Axum**, sub-millisecond API response latencies, minimal memory consumption, and compile-time type guarantees across all ITIL state machines.
* **Modern High-Density Frontend**: Built with **TypeScript, React, and Vite** to deliver a responsive Single Page Application (SPA) with zero page reloads, advanced column filtering, and interactive CMDB relationship topologies.
* **Automated Agent Ingestion**: Ready for high-concurrency ingestion of hardware and software inventory snapshots via HTTP POST (compatible with the GLPI-Agent ecosystem).

---

## 🏛️ Project Architecture

```text
ITILSuite/
├── backend/                # REST API backend in Rust (Axum + Tokio + SQLx)
│   ├── src/
│   │   ├── api/            # HTTP routes and controllers (/api/v1)
│   │   ├── domain/         # ITIL domain models (Tickets, Assets, Entities)
│   │   ├── config.rs       # Environment variable parsing and defaults
│   │   ├── error.rs        # Application error handling and JSON responses
│   │   └── main.rs         # HTTP server initialization and Swagger routes
│   ├── migrations/         # Deterministic SQLx PostgreSQL migrations
│   └── Cargo.toml
│
├── frontend/               # Single-page web client in React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # Application shell, navigation, and dashboard widgets
│   │   ├── services/       # HTTP API clients and connectivity diagnostics
│   │   └── App.tsx         # Root dashboard application
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

## 🚀 Quick Start (Local Development)

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

## 🗺️ Release Roadmap

- [x] **v0.0.1 - Architectural Foundation**: Axum backend skeleton, React/TS frontend shell, architecture docs, and Docker Compose.
- [ ] **v0.0.2 - Multi-Tenancy & Authentication**: Hierarchical Entity tree, Users, RBAC profiles (Super-Admin, Technician, Self-Service), and JWT authentication.
- [ ] **v0.0.3 - ITIL Service Desk**: Incidents & Service Requests, urgency/impact priority matrix, ITIL ticket states, and technician assignment.
- [ ] **v0.0.4 - Asset Management (ITAM / CMDB)**: Inventory of computers, network gear, monitors, and GLPI-Agent ingestion endpoint.
- [ ] **v0.0.5 - Business Rules Engine & Email Notifications**: Automated ticket routing and SLA triggers.

---

## 📄 License

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version (GPLv3+)**.

See the [LICENSE](LICENSE) file for details.
