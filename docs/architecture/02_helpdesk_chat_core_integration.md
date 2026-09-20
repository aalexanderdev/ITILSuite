# Architecture Specification: Integrating HelpdeskChat into the Core of ITILSuite

## 1. Executive Summary & Source Analysis

This document synthesizes the architectural review of two reference implementations by `@aalexanderdev`:
1. **[`aalexanderdev/helpdesk-chat`](https://github.com/aalexanderdev/helpdesk-chat.git)**: The original helpdesk plugin (`plugins/chat`), providing a floating helpdesk widget, 11 database tables, an HTTP polling engine, message-to-ticket conversion, and ITIL notification hooks.
2. **[`aalexanderdev/ITIL`](https://github.com/aalexanderdev/ITIL.git)**: The Ruby on Rails 8 implementation (OpenITIL) which adapted the plugin into a native core subsystem with Active Record models (`chat_*`), dedicated namespaced controllers (`Chat::*`), and asset integration.

In **ITILSuite**, we take this proven workflow and elevate it into a **first-class native subsystem** built directly into the **Rust (Axum + Tokio)** backend and the **React + TypeScript** frontend.

---

## 2. Why ITILSuite (Rust + Tokio) Transforms HelpdeskChat

In standard legacy PHP helpdesk systems, the chat relies on periodic HTTP polling (every 2–10 seconds) because PHP processes are synchronous and WebSockets require external daemons or services (like Redis + Node.js or Swoole).

In **ITILSuite with Rust + Axum + Tokio**:
* **Native WebSockets (`axum::extract::ws`)**: Tokio provides asynchronous event broadcasting (`tokio::sync::broadcast`) directly in-memory with sub-millisecond message delivery and zero external infrastructure.
* **Extreme Concurrency**: Thousands of concurrent technicians and users maintain persistent, low-overhead WebSocket connections consuming a fraction of the RAM of PHP-FPM or Ruby Puma workers.
* **Dual Transport Support**:
  1. **WebSocket Channel (`/api/v1/chat/ws`)**: For instant message delivery, live typing indicators, and presence heartbeats.
  2. **REST API Fallback (`/api/v1/chat/*`)**: For initial state bootstrapping, message history pagination, and environments with restrictive proxy rules.

---

## 3. Database Schema Mapping (PostgreSQL + SQLx)

Derived from `helpdesk-chat` and `OpenITIL`, adapted with UUIDs and foreign key relationships to ITILSuite's Entity hierarchy:

### `chat_conversations`
Represents direct 1-on-1 threads, department channels, and entity-scoped rooms.
* `id`: `UUID PRIMARY KEY`
* `entity_id`: `UUID REFERENCES entities(id) ON DELETE CASCADE` *(Inherited from GLPI multi-tenancy)*
* `department_id`: `Option<UUID>`
* `name`: `Option<String>`
* `is_group`: `BOOLEAN DEFAULT FALSE`
* `is_self`: `BOOLEAN DEFAULT FALSE` *(Personal System Notification stream)*
* `created_at`: `TIMESTAMPTZ`
* `updated_at`: `TIMESTAMPTZ`

### `chat_conversation_users`
Tracks participant membership, unread pointers, and favorite pins.
* `conversation_id`: `UUID REFERENCES chat_conversations(id) ON DELETE CASCADE`
* `user_id`: `UUID REFERENCES users(id) ON DELETE CASCADE`
* `is_featured`: `BOOLEAN DEFAULT FALSE` *(Starred/pinned chats)*
* `last_read_message_id`: `Option<UUID>`
* `last_typing`: `TIMESTAMPTZ`
* `PRIMARY KEY (conversation_id, user_id)`

### `chat_messages`
Stores conversation messages with ticket linking metadata.
* `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
* `conversation_id`: `UUID REFERENCES chat_conversations(id) ON DELETE CASCADE`
* `user_id`: `Option<UUID> REFERENCES users(id) ON DELETE SET NULL` *(NULL for automated system messages)*
* `content`: `TEXT NOT NULL`
* `link_url`: `Option<String>` *(e.g., direct link to generated ticket #1234)*
* `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
* `updated_at`: `TIMESTAMPTZ DEFAULT NOW()`

### `chat_message_tickets` (Bi-directional Linking)
Tracks the conversion of chat messages into formal ITIL support tickets.
* `id`: `UUID PRIMARY KEY`
* `message_id`: `UUID REFERENCES chat_messages(id) ON DELETE CASCADE`
* `ticket_id`: `UUID REFERENCES tickets(id) ON DELETE CASCADE`
* `converted_by_user_id`: `UUID REFERENCES users(id)`
* `created_at`: `TIMESTAMPTZ DEFAULT NOW()`

### `chat_message_reactions`
* `id`: `UUID PRIMARY KEY`
* `message_id`: `UUID REFERENCES chat_messages(id) ON DELETE CASCADE`
* `user_id`: `UUID REFERENCES users(id) ON DELETE CASCADE`
* `emoji`: `VARCHAR(16) NOT NULL` *(e.g., "👍", "❤️", "👀")*
* `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
* `UNIQUE (message_id, user_id, emoji)`

### `chat_presences`
* `user_id`: `UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
* `status`: `VARCHAR(20) DEFAULT 'offline'` *(online, away, busy, offline)*
* `last_seen`: `TIMESTAMPTZ DEFAULT NOW()`

### `chat_settings`
Global and entity-level configuration for appearance, retention, and ITIL automations.
* `launcher_color`: `VARCHAR(7) DEFAULT '#3b82f6'`
* `bubble_color`: `VARCHAR(7) DEFAULT '#2563eb'`
* `panel_width_px`: `INTEGER DEFAULT 380`
* `ticket_conversion_enabled`: `BOOLEAN DEFAULT TRUE`
* `ticket_conversion_on_received`: `BOOLEAN DEFAULT TRUE`
* `ticket_conversion_on_sent`: `BOOLEAN DEFAULT FALSE`
* `notify_on_ticket_creation`: `BOOLEAN DEFAULT TRUE`
* `notify_on_ticket_assignment`: `BOOLEAN DEFAULT TRUE`
* `notify_on_ticket_solution`: `BOOLEAN DEFAULT TRUE`

---

## 4. Key Workflows & Signature Features

### 1. Message-to-Ticket Conversion
1. A technician clicks the **"Convert to Ticket"** button next to a requester's chat message.
2. The modal captures:
   * Category / Domain (Hardware, Software, Network).
   * Urgency & Impact level.
   * Auto-generated Title (truncated preview) and Description (full message content).
3. The backend:
   * Creates the formal ITIL `Ticket`.
   * Inserts the `chat_message_tickets` link.
   * Posts an automated notification in the chat thread: `📋 Converted to Ticket #1042`.

### 2. Automated ITIL Event Notifications
Whenever an event occurs in the Service Desk:
* Ticket created: Requester receives confirmation in their `is_self` notification stream.
* Ticket assigned: Assigned technician receives a toast notification and chat ping.
* Solution proposed: Requester receives an instant notification to validate resolution.

### 3. Integrated Dashboard Analytics
From `helpdesk-chat`'s dashboard design:
* Total Chat Volume & Daily Message Average.
* Group vs Direct message ratio.
* Active concurrent online users and peak interaction hours.

---

## 5. Integration Roadmap for ITILSuite

* **v0.0.2**: Users & Multi-Tenant Entities (Prerequisite).
* **v0.0.3**: Service Desk (Tickets & SLA engine) (Prerequisite for ticket conversion).
* **v0.0.4 / v0.0.5**:
  * Backend: Axum WebSocket hub + SQLx migrations for `chat_*` tables.
  * Frontend: Floating `<HelpdeskChatWidget />` with real-time WebSocket connection, message thread views, emoji reaction bar, and ticket conversion modal.
