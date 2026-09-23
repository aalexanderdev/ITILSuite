# Architecture Decision Record (ADR) 0004: Web SSR Migration with Askama and HTMX

## Context & Problem Statement

In the initial design phases (ADR 0001), ITILSuite adopted a decoupled architecture featuring a Rust backend (Axum + Tokio + SQLx) and a separate React 19 + TypeScript single-page application (SPA) built with Vite.

While the React frontend served as an effective prototype for proving high-density ITSM user interfaces, it introduced significant architectural and operational friction:
1. **Toolchain Complexity**: Requiring both a Rust toolchain and a Node.js (v20+) / npm / Vite ecosystem complicated local developer onboarding, container packaging, and CI/CD pipelines.
2. **Duplicate Domain Models**: Data Transfer Objects (DTOs), validation logic, and state enums had to be manually synchronized between Rust (`domain/`, `api/`) and TypeScript (`frontend/src/types.ts`).
3. **Deployment Friction**: Air-gapped enterprise environments and lightweight on-premise appliances benefit immensely from a single, self-contained, statically linked executable without node runtimes or CDN asset dependencies.
4. **Overhead & Memory**: Running a heavy client-side JavaScript bundle for enterprise administrative forms and tables resulted in unnecessary client memory consumption and hydration delays compared to pure HTML rendered directly in microseconds by the Rust runtime.

## Decision

We have replaced the React SPA with a native, compiled **Server-Side Rendering (SSR)** architecture directly embedded within the `itilsuite-backend` binary:

### 1. Template Engine: Askama
* **Compile-Time Verification**: Askama compiles HTML templates directly into Rust code at build time (`cargo build`). Syntax errors, type mismatches, and broken variable references fail at compile time rather than at runtime.
* **Microsecond Rendering Performance**: Template rendering is translated into direct memory writes to string buffers with zero runtime parsing overhead.
* **Component Modularity**: Structured with base templates (`base.html`), reusable navigation elements (`dock.html`, `navbar.html`), and feature page templates (`templates/pages/*`).

### 2. Reactive Interactivity: HTMX
* **SPA-Like Dynamism Without Client Frameworks**: HTMX attributes (`hx-get`, `hx-post`, `hx-target`, `hx-swap`) enable declarative, asynchronous partial page updates, search filtering, and inline toggles without full page reloads.
* **Partial Templates**: Dedicated partial templates (`templates/partials/*`) for live component updates, such as SMTP connection testing (`smtp_test_result.html`), receiver syncing (`collect_result.html`), and rule status switching.

### 3. Design System & Static Assets
* **Material Design 2 Warm Dark & Clean Light Themes**: Dual-theme design system implemented using pure Vanilla CSS tokens (`backend/static/css/main.css`) with elevation levels (`00dp` to `24dp`), warm espresso backgrounds (`#141210`), warm parchment typography (`#F6F0EA`), and crisp light mode alternatives.
* **Zero External CDN Dependencies**: All assets, including local Geist and Geist Mono font bundles, SVGs, and CSS, are served directly from `backend/static/`, making the platform 100% air-gap ready.

### 4. Authentication & Dual API Parity
* **Cookie-Based Web Sessions**: Secure HTTP-only cookie authentication (`itilsuite_session`) with Argon2id password verification and automatic redirect to `/login` for unauthenticated browser sessions.
* **Preserved REST API**: The entire JSON REST API (`/api/v1/*`) and WebSocket hub (`/api/v1/chat/ws`) remain completely intact and active, ensuring 100% backward compatibility for the GLPI-Agent ingestion pipeline, third-party integrations, and future native mobile clients.

### 5. Multi-Phase Migration Plan (Executed)
* **Phase 1**: Session authentication, dashboard metrics, floating Dock navigation system.
* **Phase 2 & 2.5**: Service Desk (`/tickets`, `/tickets/:id`, `/tickets/new`), timeline followups, and HelpdeskChat telemetry (`/chat-analytics`).
* **Phase 3**: Customer Satisfaction subsystem (CSAT & NPS) with 6-tab admin console (`/surveys`) and public token responder (`/survey/public/:token`).
* **Phase 4**: CMDB/ITAM (`/assets`, `/assets/:id`), multi-tenant entity tree (`/entities`), user management (`/users`), and business rule automation (`/rules`, `/rules/new`).
* **Phase 5**: Mail configuration console (`/mail-config`), live SMTP test, inbound collectors, incoming simulator, contracts directory (`/contracts`), and 100% Dock link completion.

### 6. Archival of React Frontend
* The legacy `frontend/` directory has been retired and archived for historical reference. Node.js, npm, and Vite are no longer required to build or run ITILSuite.

## Consequences

### Positive
* **Single Executable Deployment**: The entire application (HTTP web server, SSR pages, REST API, WebSocket hub, background workers, and static assets) is packaged into a single binary (`itilsuite-backend`).
* **Instantaneous Response Latencies**: HTML pages are generated and served in sub-millisecond times (~0.2–1.5ms).
* **Simplified Toolchain**: Contributors and deployers only require standard Rust (`cargo`) and Docker for PostgreSQL/Mailpit.
* **Eliminated Sync Bugs**: Type definitions and domain enums are shared directly between business logic, database queries, and view templates.
* **Zero 404s**: All dock and navigation links resolve to fully implemented SSR views.

### Trade-offs
* **Recompilation for Template Changes**: Modifying template files requires an incremental Rust build (though Askama integration with Cargo makes rebuilds very fast, typically <1-2s).
* **DOM-Centric State**: Dynamic client state transitions rely on standard DOM events and HTMX partial swaps rather than a centralized client-side Redux/Context state store.
