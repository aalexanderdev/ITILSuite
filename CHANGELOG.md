# Changelog

All notable changes to this project will be documented in this file in accordance with [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning (SemVer)](https://semver.org/).

---

## [Unreleased]

### Planned (v0.0.7 - Advanced SLAs & Automated Escalation Matrices)
* **Real-Time SLA Engine**: Dynamic TTO (Time to Own) and TTR (Time to Resolve) targets with working calendar hours.
* **Escalation Rules & Actions**: Automatic re-assignment, priority elevation, and supervisory alerts on impending SLA breaches.
* **SLA Dashboard & Breach Indicators**: Visual SLA progress bars and risk badges across Service Desk ticket views.

---

## [0.0.6] - 2026-09-20

### Added
* **Transversal Groups Architecture (`groups` & `group_users`)**:
  * Centralized, multi-tenant transversal group management inspired by GLPI 11 (`is_task`, `is_requester`, `is_user_group`, `is_recursive`).
  * Scoping flexibility: Global transversal groups (`entity_id IS NULL`) accessible across all entities, or entity-specific groups with optional recursive inheritance.
  * Hierarchical group roles with supervisor/leader designation (`is_manager`).
  * Dedicated backend domain (`Group`, `GroupUser`, DTOs) and REST endpoints (`/api/v1/groups`, `/api/v1/groups/:id`, `/api/v1/groups/:id/members`, `/api/v1/groups/:id/members/:user_id/role`).
* **High-Throughput Batch User Ingestion Engine**:
  * Dual-format ingestion endpoint (`POST /api/v1/users/batch-import`) supporting both structured JSON and raw CSV with field auto-detection.
  * Deterministic conflict resolution modes (`skip` to preserve existing records or `overwrite` for mass updates).
  * Automated credential handling with secure Argon2id default hashes and profile ID resolution with fallback to `Self-Service`.
  * Pre-assignment to target entities and transversal groups during ingestion.
  * Single-user creation modal with profile selection and instant activation.
  * Interactive user status toggling (`is_active`) and group filtering in the User Directory.
* **Cross-Cutting Transversal Integrations**:
  * **ITIL Service Desk**:
    * Direct ticket assignment to transversal groups (`assigned_group_id`) and requester group tracking (`requester_group_id`).
    * Group technician queue filtering and assignment picker in ticket creation and detail views.
    * Visual badges for assigned and requester groups in ticket lists.
  * **HelpdeskChat Synchronization**:
    * Automated provisioning of group team rooms (`chat_conversations.group_id`, e.g., `#soporte-nivel-1`, `#ciberseguridad-soc`).
    * Dynamic roster synchronization upon member addition or removal.
  * **Notification Outbox Dispatch**:
    * Asynchronous Tokio outbox worker resolves all active members of an assigned group to fan out multi-recipient email notifications.
  * **IT Asset Management (CMDB)**:
    * Custodial and maintenance team responsibility linked directly to transversal groups (`assets.group_id`).
* **Interactive Frontend Workspace (`UsersListView.tsx`)**:
  * Three-tab administrative console:
    1. *Directorio de Usuarios*: User metrics, live search, status filtering (`all`/`active`/`inactive`), transversal group filtering, and active toggle.
    2. *Grupos Transversales*: Card grid with global/entity badges, member counts, leader indicators, interactive drawer for roster management, and group creation modal.
    3. *Ingesta Masiva (CSV / JSON)*: Ingestion wizard with CSV template generator, JSON sample loader, syntax validation, conflict mode selector, and real-time execution report.

---

## [0.0.5] - 2026-09-18

### Added
* **Business Rules & Dictionaries Normalization Suite (Inspired by GLPI)**:
  * Unified metarule database schema with deterministic PostgreSQL migration (`rules`, `rule_criteria`, `rule_actions`, `rule_execution_logs`).
  * High-performance asynchronous Rust rule evaluation engine (`RuleEngine`) featuring 11 conditional operators (`equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `regex_match` with capture interpolation `$1..$N`, `in_subnet` for CIDR blocks like `192.168.10.0/24`, `is_empty`, and `is_not_empty`).
  * Priority rankings, configurable match logic (`AND` / `OR`), fallback catch-all rules, and `stop_on_first_match` execution pipeline halting.
  * **4 Complete Business Rule Domains**:
    * **Helpdesk Rules**: Ticket business rules (urgency, impact, priority, category, technician mutation based on subject/content/sender keywords), ticket entity assignment rules (routing to corporate entity via email, domain, IP), and problem/change rules.
    * **Assets & Inventory Rules**: Equipment entity assignment (routing incoming hardware to entities/branches by CIDR subnets and inventory tags), equipment import & link reconciliation rules (replaces hardcoded matching with configurable Link, Create, Reject, or Trash decisions).
    * **Authorization & Authentication Rules**: Initial profile and entity assignments upon first login or LDAP/AD/SAML auth, including transversal group assignments.
    * **Dictionaries & Normalization Engines (10 Specialized Subtypes)**: Hardware Manufacturers, Operating Systems, OS Versions, OS Architectures, Software & Licensable Programs, Computer Models, Monitor Models, Printer Models, Peripheral Models, and Phone Models.
  * In-flight pipeline integrations:
    * `AgentService`: Ingest normalization for GLPI-Agent payloads (manufacturer, model, OS, software) and reconciliation decisions.
    * `ReceiverService`: Entity routing and ticket business rules for all incoming email collectors.
    * `TicketService`: Dynamic rule evaluation during ticket creation via API and UI.
  * **Interactive Frontend Workspace (`RuleManagementView.tsx`)**:
    * Domain tabs and subtype pills for intuitive navigation across all rule categories.
    * Interactive rule cards with dynamic priority reordering (`#10`, `#20` up/down buttons), status toggles, logic badges (`AND`/`OR`, `Detener flujo`, `Recursiva`), and live criteria/action tag previews.
    * **Rule Editor Modal (`RuleEditorModal.tsx`)**: Dynamic criteria and action builder with contextual field suggestions and regex capture interpolation hints.
    * **Rule Sandbox Simulator Modal (`RuleSimulatorModal.tsx`)**: Zero-side-effect test console with real-world presets, microsecond execution benchmarking, step-by-step checklist validation, and output payload JSON diff inspection.
    * Responsive Warm Tones and Material Design 2 Dark Theme styling integrated into `index.css`.

### Added
* **Material Design 2 Dark Theme & Warm Tones Revamp**:
  * Implemented official Material Design 2 Dark Theme elevation system with explicit overlay scale (`--surface-00dp` through `--surface-24dp`) using deep espresso charcoal (`#141210`) as base surface.
  * Warm Tones color palette: warm parchment off-white typography (`#F6F0EA`, 88% high-emphasis, 14:1 contrast ratio), warm soft sand (`#B8ACA0`, 62% medium-emphasis), and warm stone (`#7C7269`).
  * Desaturated, glare-free dark accents: terracotta coral brand primary (`#EB4D3D` / `#F06455`), golden honey amber (`#FBBF24`), warm sage emerald (`#34D399`), and warm lavender amethyst (`#C084FC`).
  * Warm atmospheric shadows (`rgba(10, 8, 7, 0.4)` to `0.65`) and ambient background gradients replacing harsh cold blues.
  * Harmonized primary buttons, floating dock, modal dialogs, and navigation states across the entire application.
* **HelpdeskChat Subsystem & Real-Time Telemetry Engine (Inspired by GLPI helpdesk-chat)**:
  * Native WebSocket connection `/api/v1/chat/ws` powered by Rust `axum::extract::ws` and `tokio::sync::broadcast` supporting multi-client real-time messaging, typing indicators, presence tracking, reactions, and automated notifications.
  * Bidirectional Service Desk integration: Single-click conversion from chat message to ITIL ticket (`/api/v1/chat/messages/:id/convert-to-ticket`) with automatic ITIL priority matrix calculation and backlink badges (`chat_message_tickets`).
  * Automated Chat Event Notifications: Instant dispatch to requester and assigned technicians upon ticket creation (`chat_tickets_dispatch`).
  * Interactive React 19 Support Chat Dock (`HelpdeskChatWidget.tsx`):
    * Collapsible accordion sections: *En Línea* (live online users), *Destacados / Fijados* (pinned conversations), *Canales de Grupo* (team rooms), and *Directos & Sistema* (private & system channels).
    * Shortcut buttons bar (`chat_shortcut_buttons`) with quick external links (Self-Service Portal, ITIL Knowledge Base).
    * Atomic emoji reactions (👍, ❤️, 🚀, 👀) with live aggregate counts.
    * Inline `:shortcode` emoji autocomplete popup (:rocket, :fire, :smile, :check, etc.).
    * Group `@mention` autocomplete popup (`@all` and channel members).
    * Multi-attachment support: file attachments, clipboard image paste (`Ctrl+V`), and click-to-zoom Lightbox modal.
    * Real-time typing indicators with debounce dispatch.
    * Full keyboard shortcuts (`Ctrl+Alt+.` toggle dock, `Esc` dismiss, `Ctrl+Alt+?` shortcuts modal).
  * Chat Analytics & Session Telemetry Dashboard (`ChatDashboardView.tsx`):
    * KPI summary cards: Total messages, daily averages, real-time online count, team channel share, and average open session duration.
    * 24-Hour Session Gantt Timeline: Visual chronogram of user presence intervals across the workday based on periodic heartbeats.
    * CSV Export endpoint `/api/v1/chat/export.csv` for external audit and reporting.
* **IT Asset Management (ITAM) & Configuration Management Database (CMDB)**:
  * Hybrid storage architecture combining strict relational PostgreSQL tables (`assets`, `asset_connections`, `ticket_assets`) with Serde-typed JSONB specifications indexed by GIN indexes.
  * Unified inventory catalog supporting Computers, Enterprise Servers, Network Equipment (Switches, Routers, Firewalls), and Monitors.
  * Rich component telemetry tracking: CPU clock speed, cores/threads, RAM capacity/slots, storage drives with free/total capacity gauges, and network interface MAC/IP addresses.
* **GLPI-Agent Protocol & Ingestion Pipeline**:
  * Dedicated REST ingestion endpoint `/api/v1/inventory/agent` supporting HTTP POST JSON payloads formatted according to the official GLPI-Agent schema.
  * 4-level hierarchical reconciliation algorithm:
    1. System BIOS / Hardware UUID matching.
    2. Motherboard Serial Number matching.
    3. Network interface MAC address matching within JSONB arrays.
    4. Target organizational entity hostname matching.
  * GLPI Field Locks: Ability for technicians to lock manual overrides (physical location, assigned user, custom comments) preventing automated agent overwriting.
  * Connected Display Discovery: Automatic provisioning and relational linking of monitors detected during workstation inventory sweeps.
* **In-App Agent Simulator**:
  * Interactive simulation modal in the web client with realistic hardware presets (Lenovo ThinkPad T14s, Apple MacBook Pro M3 Max, Dell Precision 5570) to validate agent ingestion and reconciliation in real time.
* **CMDB Workspace Frontend**:
  * High-density React 19 interface (`AssetsListView`) with quick category filtering, live search, status badges, and relative agent synchronization indicators.
  * GLPI-style multi-tab detail view (`AssetDetailModal`) with dedicated General, Hardware, Operating System & Software, Network, and Connections panels.
* **Architecture Decision Records (ADR)**:
  * Published `ADR 0002: ITAM / CMDB Asset Model and GLPI-Agent Ingestion Pipeline`.

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
