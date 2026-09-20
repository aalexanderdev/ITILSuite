# Architecture Decision Record (ADR) 0003: Transversal Groups Architecture and High-Throughput Batch User Ingestion

## Context & Problem Statement

In enterprise IT service management (ITSM) and GLPI 11 environments, user identity and group management are central to all operational workflows. However, legacy implementations face structural limitations:

1. **Siloed Group Scopes**: In many legacy systems, user groups are strictly tied to a single organizational unit or silo, preventing cross-functional teams (e.g., Ciberseguridad & SOC, Infraestructura Cloud, Soporte Nivel 1) from operating seamlessly across multiple entities, sites, and departments.
2. **Manual & Fragmented Onboarding**: User onboarding often requires manual GUI entry per user or external script dependencies, lacking an integrated, validated batch ingestion pipeline with deterministic conflict resolution (`skip` vs `overwrite`).
3. **Disconnected Subsystems**: Groups in legacy platforms often require duplicate management across helpdesk queues, chat channels, email notification lists, and CMDB asset assignments, leading to out-of-sync rosters and dropped tickets.

## Decision

We implement a **Transversal Groups Architecture** coupled with a **Validated Batch Ingestion Engine** and **Cross-Cutting Transversal Integrations** across all ITILSuite modules.

### 1. Transversal Groups Data Model (`groups`, `group_users`)

* **Entity Scoping**:
  - `entity_id IS NULL`: Global transversal groups accessible across the entire multi-tenant entity hierarchy.
  - `entity_id = <UUID>` with `is_recursive = true`: Groups scoped to a specific parent entity and automatically inherited by all sub-entities.
* **GLPI 11 Functional Capabilities**:
  - `is_task` (`is_assign`): Defines whether tickets and tasks can be assigned directly to the group in Service Desk.
  - `is_requester`: Enables end users to submit incidents and service requests on behalf of the group.
  - `is_user_group`: Enables general categorization and organizational directory grouping.
* **Hierarchical Leadership Roles**:
  - `group_users.is_manager`: Distinguishes group leaders/supervisors from regular team members for notification routing and queue escalations.

### 2. Batch User Ingestion Engine (`/api/v1/users/batch-import`)

* **Multi-Format Ingestion**: Supports both structured JSON payloads and raw tabular CSV formats.
* **Validation & Defaults**:
  - Auto-normalizes usernames, emails, and display names.
  - Defaults unset passwords to secure, cryptographically hashed initial credentials.
  - Resolves profile IDs (`Super-Admin`, `Admin`, `Technician`, `Self-Service`) with fallback to `Self-Service`.
  - Automatically associates users with target entities and optional transversal groups.
* **Conflict Resolution Modes**:
  - `skip`: Preserves existing users with matching usernames or emails without modification.
  - `overwrite`: Idempotently updates user metadata, profiles, and group memberships while preserving account security.
* **Transactional Atomicity**: Reports detailed execution metrics (`total_processed`, `created`, `updated`, `skipped`, `errors`) per item.

### 3. Cross-Cutting Transversal Integrations

1. **ITIL Service Desk (`tickets`)**:
   - Schema fields: `assigned_group_id` (technician queue dispatch) and `requester_group_id` (departmental ticket tracking).
   - API endpoints filter tickets by group assignments, supporting team queues.
2. **HelpdeskChat Synchronization**:
   - `chat_conversations.group_id`: Group creation automatically provisions a synchronized team room (e.g., `#soporte-nivel-1`, `#ciberseguridad-soc`).
   - Group membership mutations (`POST /api/v1/groups/:id/members`, `DELETE /api/v1/groups/:id/members/:user_id`) automatically update chat participants.
3. **Notification Outbox Resolution**:
   - When a ticket is dispatched to an assigned group, the Tokio background outbox worker resolves all active users belonging to that group and enqueues individual notifications.
4. **IT Asset Management (`assets.group_id`)**:
   - Enables custodial and maintenance responsibility for hardware assets to be assigned directly to transversal teams.

## Consequences

### Positive
* **Zero Duplication**: A single group definition governs Service Desk ticket queues, HelpdeskChat team rooms, notification fan-out, and CMDB ownership.
* **High Efficiency Onboarding**: Organizations can ingest hundreds of employee accounts in a single batch API call or CSV upload with deterministic feedback.
* **GLPI 11 Feature Parity**: Retains all essential GLPI group flags (`is_task`, `is_requester`, `is_manager`, `is_recursive`) with native multi-tenant entity inheritance.

### Trade-offs
* Multi-recipient notification fan-out for large groups requires asynchronous background processing (handled cleanly by the Tokio outbox worker).
