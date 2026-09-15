# Architecture Decision Record (ADR) 0001: Initial Tech Stack & Architecture

## Context & Problem Statement

GLPI is one of the most comprehensive and widely deployed open-source solutions for IT Service Management (ITSM), IT Asset Management (ITAM), and Configuration Management Databases (CMDB). However, its traditional monolithic architecture (PHP, mixed server-side rendering, session-bound state) faces architectural constraints when modern workloads demand:
1. Sub-millisecond API response latencies and high throughput.
2. Concurrent ingestion of large hardware/network inventories sent by automated agents (GLPI-Agent / FusionInventory) without exhausting server resources.
3. Strict compile-time type safety for complex ITIL business logic (ticket state transitions, urgency/impact priority calculations, SLA/OLA timers).
4. A high-density single-page application (SPA) with responsive data tables, live filtering, and interactive relationship diagrams.

## Decision

We adopt a decoupled architecture structured as a monorepo under the **GPL-3.0-or-later (GPLv3+)** license:

### 1. Backend: Rust + Axum + Tokio + SQLx
* **Runtime**: **Tokio**, the de-facto asynchronous runtime standard for high-concurrency systems in Rust.
* **Web Framework**: **Axum**, officially maintained by the Tokio team. It natively integrates the **Tower** middleware ecosystem (CORS, tracing, rate limiting, compression).
* **Persistence**: **PostgreSQL 16** paired with **SQLx** for compile-time verified queries and deterministic migrations.
* **API Documentation**: **Utoipa** for automated OpenAPI 3.1 schema generation and integrated Swagger UI.
* **Observability**: **Tracing** and **tracing-subscriber** providing structured JSON logging and request correlation.

### 2. Frontend: TypeScript + React + Vite
* **Bundler**: **Vite** for near-instantaneous Hot Module Replacement (HMR) and optimized client builds.
* **Language**: **TypeScript** in strict mode for type parity with backend schema models.
* **Key Libraries**:
  * *TanStack Table*: For enterprise-grade column filtering, sorting, and large-scale pagination.
  * *TanStack Query*: For server-state caching, optimistic mutations, and background polling.
  * *Lucide Icons*: Clean, consistent iconography tailored for IT operations.

### 3. Local Development Environment
* Docker Compose running PostgreSQL 16 and Mailpit (simulated SMTP server with a web UI for inspecting ticket and SLA notification emails).

## Consequences

### Positive
* Sub-millisecond baseline API latency (<5ms across typical CRUD operations).
* Minimal memory footprint (~15-30MB baseline RAM vs hundreds of megabytes in PHP-FPM processes).
* Total elimination of runtime type errors across ticket status transitions and hardware inventory structures.
* Modular architecture ready for horizontal scaling.

### Trade-offs
* Steeper learning curve for contributors unfamiliar with Rust idioms and the borrow checker.
* Initial Rust compilation overhead, mitigated through incremental builds and `cargo check`.
