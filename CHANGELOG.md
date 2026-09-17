# Changelog

All notable changes to this project will be documented in this file in accordance with [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning (SemVer)](https://semver.org/).

---

## [0.0.3] - 2026-09-17

### Added
* **ITIL Service Desk & Ticket Lifecycle**:
  * Incident and Service Request lifecycles (`New`, `Assigned`, `Planned`, `Pending`, `Solved`, `Closed`).
  * 5x5 Urgency x Impact calculation matrix generating ITIL Priority (`P1-Very High` to `P5-Very Low`) with SLA tracking.
  * Timeline support for public user followups, internal technician notes, and formal solution submissions.
  * Dedicated technician assignment and dispatch drawer.
* **GLPI Ticket Templates (Gabarits)**:
  * Predefined fields: standardized titles, technical questionnaires in ticket content, default urgency/impact, and auto-assigned technicians.
  * Mandatory field rules blocking submissions if boilerplate questions are left unedited.
  * Hidden fields simplifying user request forms for routine catalog items.
  * Dynamic category binding automatically applying matching templates upon category selection.
* **Mail Ingestion & Notification Engine**:
  * Mail Receivers (Collectors): Scheduled IMAP and POP3 ingestion with SSL/TLS encryption.
  * Thread Matching: Regex recognition of `[#INC-2026-XXXX]` and `[#REQ-2026-XXXX]` in subject lines to append followups directly to existing tickets.
  * Quoted Reply Stripping: Automatic cleanup of previous email chains (`>`, `On ... wrote:`, `--- Mensaje original ---`).
  * Anti-Spam Blacklists: Exclusion rules matching by sender email, domain name, or subject regex pattern.
  * Dynamic Notification Templates: Tag substitution engine (`##ticket.number##`, `##ticket.title##`, `##author.name##`, `##technician.name##`, `##signature##`, etc.) for all core lifecycle events.
  * Asynchronous Outbox Queue: Persistent `notification_queue` processed by a dedicated Tokio background worker with automatic retries and audit logging.
  * Air-Gap / Offline Mail Simulator: Built-in tool for injecting simulated incoming emails to test ticket creation and reply matching without external mail servers.
  * Mail Management View (`MailConfigView`): 4-tab interface for SMTP settings, Collectors, Templates with live HTML preview, and Outbox queue audit.
* **UX & Design Improvements**:
  * Air-gap ready typography: 100% locally served Geist and Geist Mono font bundles (`@fontsource-variable/geist` and `@fontsource-variable/geist-mono`).
  * Shimmer Skeleton Loaders: High-density placeholder animations for ticket tables and detail views.
  * Native Accessible Tooltips: Zero-dependency floating tooltips for ITIL priorities, status definitions, and dock actions.
  * Global Toast Notification System: Non-blocking notifications for lifecycle transitions, ticket assignments, and error feedback.

---

## [0.0.2] - 2026-09-16

### Added
* **Multi-Tenant Hierarchical Entities**:
  * Recursive entity tree structure following the GLPI organizational model.
  * Entity scope switching in the top navigation bar with parent-child inheritance.
  * Dedicated hierarchical tree visualizer (`EntityTreeView`).
* **Users & RBAC Authentication**:
  * Role-based access control with profiles: `Super-Admin`, `Admin`, `Technician`, and `Self-Service`.
  * Secure password hashing with Argon2id.
  * JWT token issuance and stateless bearer token authentication.
  * User directory view (`UsersListView`) with search, profile tags, and status indicators.
* **Application Shell & Layout**:
  * OpenITIL-inspired floating bottom navigation dock (`BottomNavDock`).
  * Integrated right-side helpdesk support chat dock (`HelpdeskChatWidget`).
  * Dual-theme system: Dark Cyber-Navy and Clean Light modes with persistent state in `ThemeContext`.

---

## [0.0.1] - 2026-09-15

### Added
* **Base Repository Architecture**:
  * Decoupled monorepo structure with a Rust backend and a React + TypeScript frontend.
  * Comprehensive `.gitignore` configuration for Rust, Node.js, and Docker environments.
  * `docker-compose.yml` for local development services (PostgreSQL 16 and Mailpit for notification testing).
  * Project license set to **GPL-3.0-or-later (GPLv3+)**.
* **Documentation**:
  * Exhaustive `README.md` with architectural vision, local setup instructions, and release roadmap.
  * ADR 0001: Architecture Decision Record on technology stack selection (Rust + Axum + Tokio + SQLx + React/TS).
  * Architecture Guide: Conceptual domain mapping from GLPI 11 to Rust.
* **Backend (Rust + Axum)**:
  * Asynchronous web server built on Tokio, Axum, and Tower.
  * Extensible environment configuration system via `dotenvy`.
  * Structured logging and observability with `tracing` and `tracing-subscriber`.
  * Unified error handling producing standard JSON error responses.
  * Core endpoints:
    * `GET /api/v1/health` (uptime, service status, UTC timestamp, environment).
    * `GET /api/v1/version` (application name, version `0.0.1`, git commit).
  * OpenAPI 3.1 specification generation and Swagger UI hosted at `/swagger-ui`.
  * CORS middleware pre-configured for local frontend integration on port `8081`.
  * Automated integration and health tests passing in `cargo test`.
* **Frontend (TypeScript + React + Vite)**:
  * SPA project scaffolded with Vite and TypeScript in strict mode.
  * Enterprise-grade IT management layout inspired by GLPI 11 density:
    * Sidebar navigation featuring core ITIL modules (Service Desk, Assets & CMDB, Management, Administration).
    * Topbar navigation with multi-tenant hierarchical Entity selector (Root Entity).
    * Real-time connectivity pill monitoring the live Rust backend API.
    * Interactive diagnostics card with one-click API test and live JSON response viewer.
    * Initial KPI metrics cards and SemVer roadmap tracker.
